import { expect, test, type Page } from '@playwright/test';

/** Chromium's virtual WebAuthn authenticator stands in for Face ID / Touch ID. */
async function addAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
}

async function signUp(page: Page, username: string) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'New game' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await expect(page.getByTestId('recovery-codes').locator('li')).toHaveCount(8);
  await page.getByLabel('I have saved my codes').check();
  await page.getByRole('button', { name: "Let's go!" }).click();
  await expect(page.getByRole('heading', { name: `Hey ${username}!` })).toBeVisible();
}

test('sign up, train, see summary, reuse routine, leaderboard and another profile', async ({ browser }) => {
  const suffix = Date.now().toString(36).slice(-6);
  const rival = `rival_${suffix}`;
  const hero = `hero_${suffix}`;
  const errors: string[] = [];

  // A second athlete exists so we can view and follow their profile.
  const rivalCtx = await browser.newContext({ locale: 'en-US' });
  const rivalPage = await rivalCtx.newPage();
  await addAuthenticator(rivalPage);
  await signUp(rivalPage, rival);
  await rivalCtx.close();

  const ctx = await browser.newContext({ locale: 'en-US' });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await addAuthenticator(page);
  await signUp(page, hero);

  // Start a workout and add exercises through the filtered picker.
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByTestId('workout-timer')).toBeVisible();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  const picker = page.getByRole('dialog', { name: 'Add exercises' });
  await picker.getByRole('group', { name: 'Equipment' }).getByRole('button', { name: 'Barbell' }).click();
  await picker.getByRole('searchbox').fill('bench');
  await picker.getByRole('button', { name: 'Select Bench Press' }).click();
  await picker.getByRole('searchbox').fill('');
  await picker.getByRole('group', { name: 'Equipment' }).getByRole('button', { name: 'Barbell' }).click();
  await picker.getByRole('searchbox').fill('push-up');
  await picker.getByRole('button', { name: 'Select Push-Up' }).click();
  await picker.getByRole('button', { name: 'Add 2 exercises' }).click();
  await expect(picker).toBeHidden();

  // Log sets.
  for (let n = 1; n <= 3; n++) {
    await page.getByRole('textbox', { name: `Weight (kg), Set ${n}` }).fill('60');
    await page.getByRole('textbox', { name: `Reps, Set ${n}` }).first().fill('10');
    await page.getByRole('button', { name: `Mark set ${n} done` }).first().click();
  }
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('textbox', { name: 'Reps, Set 1' }).nth(1).fill('20');
  await page.getByRole('button', { name: 'Mark set 1 done' }).nth(1).click();

  // The timer survives a reload because only the start timestamp is stored.
  await page.reload();
  await expect(page.getByTestId('workout-timer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark set 3 done' }).first()).toHaveAttribute('aria-pressed', 'true');

  // Finish → summary with XP, PBs, trophies and muscle map.
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('dialog', { name: 'Finish workout?' }).getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete!' }).first()).toBeVisible();
  await expect(page.getByTestId('xp-total')).toContainText('XP');
  await expect(page.getByTestId('pb-list')).toContainText('Bench Press');
  await expect(page.getByText('Press Start')).toBeVisible();
  await expect(page.getByRole('img', { name: /Body map.*Chest/ })).toBeVisible();

  // Save as routine, then start it next time.
  await page.getByRole('button', { name: 'Save as routine' }).click();
  await expect(page.getByRole('button', { name: 'Saved as routine' })).toBeDisabled();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('link', { name: 'Routines' }).click();
  await page.getByRole('button', { name: /^Start: / }).first().click();
  await expect(page.getByRole('textbox', { name: 'Weight (kg), Set 1' })).toHaveValue('60');
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard workout' }).click();

  // Leaderboard shows us.
  await page.getByRole('link', { name: 'Progress' }).click();
  await page.getByRole('tab', { name: 'Ranking' }).click();
  await expect(page.getByTestId('leaderboard')).toContainText(hero);

  // Find and follow the rival.
  await page.getByRole('link', { name: 'Profile' }).click();
  await page.getByRole('link', { name: 'Find friends' }).click();
  await page.getByRole('searchbox', { name: 'Search by username' }).fill(rival);
  await page.getByRole('link', { name: new RegExp(rival) }).click();
  await expect(page.getByTestId('profile-name')).toHaveText(rival);
  await page.getByRole('button', { name: 'Follow' }).click();
  await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible();

  expect(errors).toEqual([]);
  await ctx.close();
});

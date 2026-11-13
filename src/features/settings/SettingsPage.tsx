import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { useState, type ReactNode } from 'react';
import type { MeUser } from '@shared/api.ts';
import { WEEKLY_GOAL_MAX, WEEKLY_GOAL_MIN } from '@shared/game/constants.ts';
import { Page } from '@/app/Layout.tsx';
import { Modal, Sheet } from '@/components/glass/dialog.tsx';
import { confirm, toast } from '@/components/glass/feedback.tsx';
import { Avatar } from '@/components/game.tsx';
import { AVATAR_IDS } from '@/components/pixel/sprites.ts';
import { Button, Card, cx, ErrorNote, Field, IconButton, Loading, Segmented, Toggle } from '@/components/ui.tsx';
import { errorMessage, useT } from '@/i18n/index.ts';
import { api } from '@/lib/api.ts';
import { fmtDateLong } from '@/lib/format.ts';
import { clearLocalData, keys, queryClient, useMe, usePasskeys } from '@/lib/queries.ts';
import { useLive } from '@/stores/live.ts';
import { useOutbox } from '@/stores/outbox.ts';
import { usePrefs, type Theme } from '@/stores/prefs.ts';
import { RecoveryCodes } from '../auth/RecoveryCodes.tsx';

type Patch = Partial<Pick<MeUser, 'displayName' | 'avatar' | 'locale' | 'theme' | 'units' | 'weeklyGoal' | 'leaderboardVisible' | 'workoutsPublic'>>;

/** Optimistic settings update: local cache first, then the server. */
async function saveSettings(patch: Patch) {
  queryClient.setQueryData(keys.me, (old: { user: MeUser } | undefined) => old && { ...old, user: { ...old.user, ...patch } });
  const prefs = usePrefs.getState();
  if (patch.locale) prefs.set({ lang: patch.locale });
  if (patch.theme) prefs.set({ theme: patch.theme });
  if (patch.units) prefs.set({ units: patch.units });
  await api('/me', { method: 'PATCH', body: patch }).catch(() => undefined);
  void queryClient.invalidateQueries({ queryKey: keys.me });
  if ('weeklyGoal' in patch) void queryClient.invalidateQueries({ queryKey: keys.game });
  if ('leaderboardVisible' in patch || 'avatar' in patch || 'displayName' in patch) void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
  useLive.getState().discard();
  useOutbox.getState().clear();
  clearLocalData();
  queryClient.setQueryData(keys.me, null);
  location.href = '/';
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-1 text-[11px]">{title}</h2>
      <Card className="space-y-3">{children}</Card>
    </section>
  );
}

export function SettingsPage() {
  const { t, lang } = useT();
  const me = useMe().data;
  const prefs = usePrefs();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  if (!me) return <Loading label={t('common.loading')} />;
  const u = me.user;
  const on = t('common.on');
  const off = t('common.off');

  return (
    <Page title={t('settings.title')} back="/profile">
      <Section title={t('settings.profile')}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setAvatarOpen(true)} aria-label={t('settings.avatar')}>
            <Avatar id={u.avatar} size={56} />
          </button>
          <Field label={t('auth.displayName')}>
            <input
              className="px-input"
              maxLength={40}
              value={displayName ?? u.displayName ?? ''}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => {
                if (displayName !== null && displayName !== (u.displayName ?? '')) {
                  void saveSettings({ displayName: displayName.trim() || null });
                  toast(t('settings.saved'));
                }
              }}
            />
          </Field>
        </div>
        <p className="text-sm text-ink-soft">@{u.username}</p>
      </Section>

      <Section title={t('settings.appearance')}>
        <Segmented value={lang} label={t('settings.language')} onChange={(l) => void saveSettings({ locale: l })} options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]} />
        <h3 className="px-1 font-sans text-sm font-semibold">{t('settings.theme')}</h3>
        <Segmented<Theme> value={prefs.theme} label={t('settings.theme')} onChange={(v) => void saveSettings({ theme: v })} options={(['light', 'dark', 'system'] as const).map((v) => ({ value: v, label: t(`settings.theme.${v}`) }))} />
        <h3 className="px-1 font-sans text-sm font-semibold">{t('settings.units')}</h3>
        <Segmented value={prefs.units} label={t('settings.units')} onChange={(v) => void saveSettings({ units: v })} options={(['kg', 'lb'] as const).map((v) => ({ value: v, label: t(`settings.units.${v}`) }))} />
      </Section>

      <Section title={t('settings.training')}>
        <div>
          <p className="font-semibold">{t('settings.weeklyGoal')}</p>
          <p className="mb-2 text-sm text-ink-soft">{t('settings.weeklyGoalHint')}</p>
          <div className="flex gap-1" role="radiogroup" aria-label={t('settings.weeklyGoal')}>
            {Array.from({ length: WEEKLY_GOAL_MAX - WEEKLY_GOAL_MIN + 1 }, (_, i) => i + WEEKLY_GOAL_MIN).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={u.weeklyGoal === n} className={cx('h-11 flex-1 border-2 border-line font-pixel text-xs', u.weeklyGoal === n ? 'bg-ink text-bg' : 'bg-surface')} onClick={() => void saveSettings({ weeklyGoal: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <Toggle label={t('settings.rest')} checked={prefs.restEnabled} onChange={(v) => prefs.set({ restEnabled: v })} onText={on} offText={off} />
        {prefs.restEnabled && (
          <Field label={`${t('settings.restSeconds')}: ${prefs.restSeconds} s`}>
            <input type="range" min={15} max={300} step={15} className="w-full accent-[var(--primary)]" value={prefs.restSeconds} onChange={(e) => prefs.set({ restSeconds: Number(e.target.value) })} />
          </Field>
        )}
        <Toggle label={t('settings.sound')} checked={prefs.sound} onChange={(v) => prefs.set({ sound: v })} onText={on} offText={off} />
        <Toggle label={t('settings.vibrate')} checked={prefs.vibrate} onChange={(v) => prefs.set({ vibrate: v })} onText={on} offText={off} />
      </Section>

      <Section title={t('settings.privacy')}>
        <Toggle label={t('settings.leaderboardVisible')} hint={t('settings.leaderboardHint')} checked={u.leaderboardVisible} onChange={(v) => void saveSettings({ leaderboardVisible: v })} onText={on} offText={off} />
        <Toggle label={t('settings.workoutsPublic')} hint={t('settings.workoutsPublicHint')} checked={u.workoutsPublic} onChange={(v) => void saveSettings({ workoutsPublic: v })} onText={on} offText={off} />
      </Section>

      <Security />

      <Section title={t('settings.data')}>
        <a href="/api/me/export" download className="px-btn w-[calc(100%-6px)]">
          {t('settings.export')}
        </a>
        <Button block onClick={() => void logout()}>
          {t('settings.logout')}
        </Button>
        <DeleteAccount username={u.username} />
      </Section>

      <Sheet open={avatarOpen} onClose={() => setAvatarOpen(false)} title={t('settings.avatar')}>
        <div className="grid grid-cols-4 gap-3" role="radiogroup" aria-label={t('settings.avatar')}>
          {AVATAR_IDS.map((id, i) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={u.avatar === id}
              aria-label={t('settings.avatarPick', { n: i + 1 })}
              className={cx('flex justify-center p-1', u.avatar === id && 'outline-4 outline-[var(--primary)]')}
              onClick={() => {
                void saveSettings({ avatar: id });
                setAvatarOpen(false);
              }}
            >
              <Avatar id={id} size={56} />
            </button>
          ))}
        </div>
      </Sheet>
    </Page>
  );
}

function Security() {
  const { t, lang } = useT();
  const { data } = usePasskeys();
  const me = useMe().data;
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.passkeys });

  const add = async () => {
    setError(null);
    try {
      const { challengeId, options } = await api<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }>('/me/passkeys/options', { method: 'POST' });
      const response = await startRegistration({ optionsJSON: options });
      await api('/me/passkeys/verify', { method: 'POST', body: { challengeId, response } });
      toast(t('settings.passkeyAdded'), 'lock');
      sessionStorage.removeItem('himbo-recovered');
      void refresh();
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setError(name === 'NotAllowedError' || name === 'AbortError' ? t('auth.cancelled') : errorMessage(t, e));
    }
  };
  const remove = async (id: string) => {
    if (!(await confirm({ title: t('settings.passkeyRemove'), message: t('settings.passkeyRemoveConfirm'), danger: true, confirmLabel: t('common.delete') }))) return;
    try {
      await api(`/me/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      void refresh();
    } catch (e) {
      setError(errorMessage(t, e));
    }
  };
  const regenerate = async () => {
    if (!(await confirm({ title: t('settings.recoveryRegen'), message: t('settings.recoveryRegenConfirm') }))) return;
    try {
      setCodes((await api<{ recoveryCodes: string[] }>('/me/recovery-codes', { method: 'POST' })).recoveryCodes);
      void refresh();
    } catch (e) {
      setError(errorMessage(t, e));
    }
  };

  return (
    <Section title={t('settings.security')}>
      {error && <ErrorNote>{error}</ErrorNote>}
      <h3 className="text-sm font-semibold">{t('settings.passkeys')}</h3>
      <ul className="space-y-1.5">
        {data?.passkeys.map((p) => (
          <li key={p.id} className="flex items-center gap-2 border-2 border-line p-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">🔑 {p.deviceName || t('settings.passkeyUnknown')}</span>
              <span className="block text-xs text-ink-soft">{t('settings.passkeyCreated', { date: fmtDateLong(p.createdAt, lang) })}</span>
            </span>
            <IconButton icon="trash" size={14} label={t('settings.passkeyRemove')} disabled={data.passkeys.length <= 1} onClick={() => void remove(p.id)} />
          </li>
        ))}
      </ul>
      <Button block icon="plus" onClick={() => void add()}>
        {t('settings.passkeyAdd')}
      </Button>
      {data && <p className="text-sm">{t('settings.recoveryLeft', { n: data.recoveryCodesLeft })}</p>}
      <Button block small onClick={() => void regenerate()}>
        {t('settings.recoveryRegen')}
      </Button>
      <Modal open={!!codes} onClose={() => setCodes(null)} title={t('auth.recoveryTitle')}>
        {codes && <RecoveryCodes codes={codes} username={me?.user.username ?? ''} onDone={() => setCodes(null)} />}
      </Modal>
    </Section>
  );
}

function DeleteAccount({ username }: { username: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await api('/me', { method: 'DELETE' });
      await logout();
    } catch (e) {
      toast(errorMessage(t, e), 'close');
      setBusy(false);
    }
  };
  return (
    <>
      <Button block variant="danger" onClick={() => setOpen(true)}>
        {t('settings.delete')}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('settings.delete')}>
        <p className="mb-3 text-sm">{t('settings.deleteConfirm')}</p>
        <input className="px-input mb-3" aria-label={t('auth.username')} placeholder={username} autoCapitalize="none" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <div className="flex gap-2">
          <Button block onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button block variant="danger" disabled={busy || typed.trim().toLowerCase() !== username.toLowerCase()} onClick={() => void remove()}>
            {t('settings.deleteButton')}
          </Button>
        </div>
      </Modal>
    </>
  );
}

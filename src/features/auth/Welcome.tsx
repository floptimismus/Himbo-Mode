import { browserSupportsWebAuthn, startAuthentication, startRegistration, type PublicKeyCredentialCreationOptionsJSON, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { useState, type FormEvent } from 'react';
import { PixelSprite } from '@/components/pixel/PixelSprite.tsx';
import { Button, Card, ErrorNote, Field, Segmented } from '@/components/ui.tsx';
import { errorMessage, useT } from '@/i18n/index.ts';
import { api } from '@/lib/api.ts';
import { clearLocalData } from '@/lib/queries.ts';
import { usePrefs } from '@/stores/prefs.ts';
import { RecoveryCodes } from './RecoveryCodes.tsx';

type Mode = 'signup' | 'login' | 'recover';

/** The user dismissing the OS passkey prompt is not an error worth a red box. */
const isCancel = (e: unknown) => (e as { name?: string })?.name === 'NotAllowedError' || (e as { name?: string })?.name === 'AbortError';

export function AppLogo({ size = 72 }: { size?: number }) {
  return <img src="/icons/icon.svg" alt="" width={size} height={size} className="sprite px px-flat" style={{ imageRendering: 'pixelated' }} />;
}

export function Welcome() {
  const { t, lang } = useT();
  const setPrefs = usePrefs((s) => s.set);
  const [mode, setMode] = useState<Mode>('signup');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const supported = browserSupportsWebAuthn();

  const enter = () => clearLocalData();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(isCancel(e) ? t('auth.cancelled') : errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  const signUp = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { challengeId, options } = await api<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }>('/auth/register/options', {
        method: 'POST',
        body: { username: username.trim(), displayName: displayName.trim() || undefined },
      });
      const response = await startRegistration({ optionsJSON: options });
      const res = await api<{ recoveryCodes: string[] }>('/auth/register/verify', { method: 'POST', body: { challengeId, response, locale: lang } });
      setCodes(res.recoveryCodes);
    });
  };

  const logIn = () =>
    run(async () => {
      const { challengeId, options } = await api<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }>('/auth/login/options', { method: 'POST' });
      const response = await startAuthentication({ optionsJSON: options });
      await api('/auth/login/verify', { method: 'POST', body: { challengeId, response } });
      enter();
    });

  const recover = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api('/auth/recover', { method: 'POST', body: { username: username.trim(), code: code.trim() } });
      sessionStorage.setItem('himbo-recovered', '1');
      enter();
    });
  };

  if (codes) {
    return (
      <Shell>
        <RecoveryCodes codes={codes} username={username.trim()} onDone={enter} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 flex flex-col items-center gap-4 text-center">
        <span className="anim-bob">
          <AppLogo />
        </span>
        <h1 className="text-xl text-primary [text-shadow:3px_3px_0_var(--line)]">HIMBO-MODE</h1>
        <p className="font-pixel text-[9px] leading-5 text-ink-soft">{t('auth.tagline')}</p>
      </div>

      {mode !== 'recover' && (
        <Segmented
          label={t('auth.login')}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { value: 'signup', label: t('auth.signup') },
            { value: 'login', label: t('auth.login') },
          ]}
        />
      )}

      <Card dialog className="mt-3">
        {!supported && <ErrorNote>{t('auth.noWebauthn')}</ErrorNote>}
        {error && <ErrorNote>{error}</ErrorNote>}

        {mode === 'signup' && (
          <form onSubmit={signUp} className="space-y-4">
            <Field label={t('auth.username')} hint={t('auth.usernameHint')}>
              <input className="px-input" name="username" autoComplete="username webauthn" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]{3,20}" value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label={`${t('auth.displayName')} (${t('common.optional')})`}>
              <input className="px-input" name="displayName" autoComplete="nickname" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <p className="text-sm text-ink-soft">{t('auth.passkeyInfo')}</p>
            <Button type="submit" variant="primary" block disabled={busy || !supported} icon="lock">
              {t('auth.createPasskey')}
            </Button>
          </form>
        )}

        {mode === 'login' && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">{t('auth.passkeyInfo')}</p>
            <Button variant="primary" block disabled={busy || !supported} icon="lock" onClick={logIn}>
              {t('auth.loginPasskey')}
            </Button>
            <button type="button" className="min-h-11 w-full text-center text-sm font-semibold underline" onClick={() => setMode('recover')}>
              {t('auth.useRecovery')}
            </button>
          </div>
        )}

        {mode === 'recover' && (
          <form onSubmit={recover} className="space-y-4">
            <Field label={t('auth.username')}>
              <input className="px-input" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label={t('auth.recoveryCode')}>
              <input className="px-input font-mono uppercase" name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} required placeholder="XXXXX-XXXXX" value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" block disabled={busy}>
              {t('auth.recoverLogin')}
            </Button>
            <button type="button" className="min-h-11 w-full text-center text-sm font-semibold underline" onClick={() => setMode('login')}>
              {t('auth.backToPasskey')}
            </button>
          </form>
        )}
      </Card>

      <div className="mt-6 flex justify-center gap-2">
        {(['de', 'en'] as const).map((l) => (
          <button key={l} type="button" className="chip" aria-pressed={lang === l} onClick={() => setPrefs({ lang: l })}>
            {l === 'de' ? 'Deutsch' : 'English'}
          </button>
        ))}
      </div>
      <div className="mt-8 flex justify-center gap-3 opacity-80" aria-hidden="true">
        <PixelSprite sprite="dumbbell" size={20} />
        <PixelSprite sprite="ball" size={24} palette={{ k: 'var(--line)', x: '#a8683f', w: '#fff' }} />
        <PixelSprite sprite="star" size={24} palette={{ k: 'var(--line)', x: 'var(--gold)', w: '#fff' }} />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">{children}</main>;
}

import { useState } from 'react';
import { toast } from '@/components/glass/feedback.tsx';
import { Button, Card } from '@/components/ui.tsx';
import { useT } from '@/i18n/index.ts';

/** Shows freshly generated recovery codes exactly once, with copy and download helpers. */
export function RecoveryCodes({ codes, username, onDone }: { codes: string[]; username: string; onDone: () => void }) {
  const { t } = useT();
  const [saved, setSaved] = useState(false);
  const text = `Himbo-Mode recovery codes (${username})\n\n${codes.join('\n')}\n`;

  const copy = async () => {
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    toast(t('common.copied'));
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `himbo-mode-recovery-${username}.txt` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card dialog>
      <h1 className="mb-3 text-xs">{t('auth.recoveryTitle')}</h1>
      <p className="mb-4 text-sm">{t('auth.recoveryIntro')}</p>
      <ul className="mb-4 grid grid-cols-2 gap-2" data-testid="recovery-codes">
        {codes.map((c) => (
          <li key={c} className="border-2 border-line bg-surface-2 px-2 py-2 text-center font-mono text-sm font-bold tracking-wider">
            {c}
          </li>
        ))}
      </ul>
      <div className="mb-4 flex gap-2">
        <Button block small icon="copy" onClick={copy}>
          {t('common.copy')}
        </Button>
        <Button block small icon="down" onClick={download}>
          {t('auth.download')}
        </Button>
      </div>
      <label className="mb-4 flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
        <input type="checkbox" className="h-6 w-6 accent-[var(--primary)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        {t('auth.recoverySaved')}
      </label>
      <Button variant="primary" block disabled={!saved} onClick={onDone}>
        {t('auth.letsGo')}
      </Button>
    </Card>
  );
}

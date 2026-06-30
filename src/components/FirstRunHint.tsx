'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';

const KEY = 'stellarfund.hintDismissed';

export default function FirstRunHint() {
  const { locale } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(typeof localStorage !== 'undefined' && !localStorage.getItem(KEY));
  }, []);

  if (!show) return null;

  const steps =
    locale === 'tr'
      ? ['Cüzdan bağla', 'Tek tık “Get Test USDC”', 'Bir kampanyaya katkı yap']
      : ['Connect a wallet', 'One tap “Get Test USDC”', 'Contribute to a campaign'];

  function dismiss() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div className="glass flex items-center justify-between gap-3 rounded-xl border border-indigo-400/30 bg-indigo-400/10 p-3 text-sm">
      <span>
        {locale === 'tr' ? 'Yeni misin? 3 adımda başla: ' : 'New here? Start in 3 steps: '}
        <span className="opacity-80">{steps.map((s, i) => `${i + 1}) ${s}`).join('  ·  ')}</span>
      </span>
      <button onClick={dismiss} className="shrink-0 text-xs opacity-60 hover:opacity-100">
        ✕
      </button>
    </div>
  );
}

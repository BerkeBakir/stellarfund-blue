'use client';
import Link from 'next/link';
import WalletBar from '@/components/WalletBar';
import AnchorRamp from '@/components/AnchorRamp';
import { ANCHOR_HOME_DOMAIN } from '@/lib/config';

export default function RampPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-xs text-indigo-300 underline">
          ← back
        </Link>
        <h1 className="text-2xl font-bold text-gradient">Fiat ↔ USDC ramp</h1>
        <p className="text-sm opacity-70">
          A backer pays in local fiat; a Stellar <strong>anchor</strong> converts it to USDC behind
          the scenes — and back to fiat on withdrawal. This is the real SEP-10 + SEP-24 protocol
          flow against the <span className="font-mono">{ANCHOR_HOME_DOMAIN}</span> sandbox (no real
          money). It demonstrates how StellarFund lets anyone fund anyone across borders.
        </p>
      </header>

      <WalletBar />
      <AnchorRamp />

      <div className="glass rounded-xl border border-white/10 p-4 text-xs opacity-70">
        <p className="mb-1 font-semibold uppercase tracking-wide">How it works</p>
        <ol className="list-decimal pl-4">
          <li>SEP-10: your wallet signs a challenge to authenticate with the anchor.</li>
          <li>SEP-24: the anchor opens an interactive window to collect payment / KYC.</li>
          <li>The status is polled until the transfer settles (USDC in, or fiat out).</li>
        </ol>
      </div>
    </main>
  );
}

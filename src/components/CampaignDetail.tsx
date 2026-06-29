'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getSummary,
  getMilestones,
  contribute,
  release,
  refund,
  contributionOf,
  STATUS_LABEL,
  type Summary,
  type Milestone,
} from '@/lib/campaign';
import { getTestUsdc, getUsdcBalance } from '@/lib/onboard';
import { useAppStore } from '@/store';
import { stroopsToXlm, xlmToStroops, pct, timeLeft, truncate } from '@/lib/format';
import { explorerContractUrl } from '@/lib/config';
import TxStatus from './TxStatus';
import ReputationBadge from './ReputationBadge';

export default function CampaignDetail({ id }: { id: string }) {
  const { connected, publicKey, events, setTxStatus, setTxResult } = useAppStore();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [myContribution, setMyContribution] = useState<bigint>(0n);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([getSummary(id), getMilestones(id)]);
      setSummary(s);
      setMilestones(m);
      if (publicKey) {
        setMyContribution(await contributionOf(id, publicKey));
        setUsdcBalance(await getUsdcBalance(publicKey));
      }
    } catch {
      /* ignore */
    }
  }, [id, publicKey]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [s, m] = await Promise.all([
        getSummary(id).catch(() => null),
        getMilestones(id).catch(() => [] as Milestone[]),
      ]);
      if (!active) return;
      if (s) setSummary(s);
      setMilestones(m);
      if (publicKey) {
        const c = await contributionOf(id, publicKey).catch(() => null);
        if (!active) return;
        if (c !== null) setMyContribution(c);
        const bal = await getUsdcBalance(publicKey).catch(() => null);
        if (!active) return;
        setUsdcBalance(bal);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, publicKey, events]);

  async function run(action: () => Promise<string>, label: string) {
    if (!publicKey) return;
    setBusy(true);
    setTxStatus('pending');
    setTxResult(null, null);
    try {
      const hash = await action();
      setTxResult(hash, null);
      setTxStatus('success');
      toast.success(`${label} succeeded`);
      await refresh();
    } catch (e) {
      let msg = e instanceof Error ? e.message : `${label} failed`;
      if (/#13|trustline/i.test(msg)) {
        msg = 'You need test USDC first — tap “Get Test USDC”.';
        setUsdcBalance(null);
      }
      setTxResult(null, msg);
      setTxStatus('fail');
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleGetUsdc() {
    if (!publicKey) return;
    setBusy(true);
    const tid = toast.loading('Funding account, setting USDC trustline, minting…');
    try {
      await getTestUsdc(publicKey);
      toast.success('Got 500 Test USDC!', { id: tid });
      setUsdcBalance(await getUsdcBalance(publicKey));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not get test USDC.', { id: tid });
    } finally {
      setBusy(false);
    }
  }

  if (!summary) return <p className="text-sm opacity-60">Loading campaign…</p>;

  // null = no USDC trustline yet; 0 = trustline but empty. Either way the user
  // must get test USDC before contributing.
  const needsUsdc = usdcBalance === null || usdcBalance <= 0;

  const percent = pct(summary.raised, summary.goal);
  const ended = now > summary.deadline;
  const goalMet = summary.raised >= summary.goal;
  const isCreator = publicKey === summary.creator;
  const completed = summary.status === 2;
  const releasable = summary.status === 0 || summary.status === 1;
  const nextIndex = summary.releasedCount; // sequential release pointer
  let amtOk = false;
  try {
    amtOk = xlmToStroops(amount) > 0n;
  } catch {
    amtOk = false;
  }

  const canContribute =
    connected && summary.status === 0 && !ended && amtOk && !busy && !needsUsdc;
  const canRelease =
    connected && isCreator && releasable && ended && goalMet && nextIndex < milestones.length && !busy;
  const canRefund =
    connected && !completed && ended && !goalMet && myContribution > 0n && !busy;

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-xl border border-white/10 p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-mono opacity-70">by {truncate(summary.creator)}</span>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
              {STATUS_LABEL[summary.status]}
            </span>
            <ReputationBadge creator={summary.creator} />
          </div>
        </div>
        <div className="mb-1 text-xl font-semibold">
          {stroopsToXlm(summary.raised)} / {stroopsToXlm(summary.goal)}{' '}
          <span className="text-sm opacity-60">USDC</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-indigo-400 to-fuchsia-500 transition-[width] duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs opacity-70">
          <span>{percent}%</span>
          <span>{timeLeft(summary.deadline, now)}</span>
        </div>
        <a
          href={explorerContractUrl(id)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-indigo-300 underline"
        >
          Contract on Stellar Expert
        </a>
      </div>

      {/* Milestone timeline */}
      <div className="glass rounded-xl border border-white/10 p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-70">
          Milestones
        </h3>
        <ol className="flex flex-col gap-3">
          {milestones.map((m, i) => {
            const isNext = i === nextIndex && goalMet && ended;
            return (
              <li key={i} className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    m.released
                      ? 'bg-emerald-500 text-black'
                      : isNext
                        ? 'bg-fuchsia-500 text-black'
                        : 'bg-white/10'
                  }`}
                >
                  {m.released ? '✓' : i + 1}
                </span>
                <div className="flex flex-1 items-center justify-between">
                  <span className="text-sm">Milestone {i + 1}</span>
                  <span className="font-mono text-sm">{stroopsToXlm(m.amount)} USDC</span>
                </div>
                {m.released && <span className="text-xs text-emerald-400">released</span>}
              </li>
            );
          })}
        </ol>
      </div>

      {summary.status === 0 && !ended && (
        <div className="glass flex flex-col gap-2 rounded-xl border border-white/10 p-5">
          <label className="text-sm font-medium">Support with USDC</label>
          {connected && needsUsdc && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
              <span>
                You need test USDC before contributing. One tap funds your wallet, sets the USDC
                trustline, and mints 500 test USDC.
              </span>
              <button
                onClick={handleGetUsdc}
                disabled={busy}
                className="w-fit rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Get Test USDC'}
              </button>
            </div>
          )}
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="10"
            className="rounded-lg border border-white/10 bg-transparent px-3 py-2"
          />
          {connected && !needsUsdc && usdcBalance !== null && (
            <span className="text-xs opacity-60">Balance: {usdcBalance} USDC</span>
          )}
          <button
            onClick={() => run(() => contribute(publicKey!, id, xlmToStroops(amount)), 'Contribution')}
            disabled={!canContribute}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 font-medium text-white disabled:opacity-40"
          >
            {busy ? 'Sending…' : 'Contribute'}
          </button>
          {!connected && <span className="text-xs opacity-60">Connect a wallet first.</span>}
        </div>
      )}

      {ended && goalMet && isCreator && releasable && (
        <button
          onClick={() => run(() => release(publicKey!, id, nextIndex), `Release milestone ${nextIndex + 1}`)}
          disabled={!canRelease}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium disabled:opacity-40"
        >
          {busy ? 'Releasing…' : `Release milestone ${nextIndex + 1}`}
        </button>
      )}
      {ended && !goalMet && myContribution > 0n && (
        <button
          onClick={() => run(() => refund(publicKey!, id), 'Refund')}
          disabled={!canRefund}
          className="rounded-lg border border-white/10 px-4 py-2 font-medium disabled:opacity-40"
        >
          {busy ? 'Refunding…' : `Refund my ${stroopsToXlm(myContribution)} USDC`}
        </button>
      )}

      <TxStatus />
    </div>
  );
}

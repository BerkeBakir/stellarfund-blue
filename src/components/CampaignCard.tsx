import Link from 'next/link';
import type { Summary } from '@/lib/campaign';
import type { CampaignMeta } from '@/lib/metadata';
import { STATUS_LABEL, stroopsToXlm, pct, timeLeft, truncate } from '@/lib/format';

export default function CampaignCard({
  id,
  summary,
  now,
  meta,
}: {
  id: string;
  summary: Summary;
  now: number;
  meta?: CampaignMeta;
}) {
  const percent = pct(summary.raised, summary.goal);
  const statusLabel = STATUS_LABEL[summary.status] ?? 'Active';
  const heading = meta?.title || truncate(summary.creator);
  const by = meta?.creatorName || truncate(summary.creator);

  return (
    <Link
      href={`/campaign/${id}`}
      className="glass block overflow-hidden rounded-xl border border-white/10 transition hover:border-fuchsia-400/50 hover:shadow-[0_0_24px_-6px_rgba(217,70,239,0.5)]"
    >
      <div className="relative h-28 w-full bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30">
        {meta?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meta.imageUrl} alt={heading} className="h-full w-full object-cover" />
        )}
        {meta?.category && (
          <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs backdrop-blur">
            {meta.category}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="mb-1 flex items-center justify-between gap-2 text-sm">
          <span className="truncate font-semibold">{heading}</span>
          <span className="shrink-0 opacity-70">{timeLeft(summary.deadline, now)}</span>
        </div>
        <div className="mb-2 text-xs opacity-60">by {by}</div>
        <div className="mb-1 text-sm">
          {stroopsToXlm(summary.raised)} / {stroopsToXlm(summary.goal)}{' '}
          <span className="opacity-60">USDC</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-indigo-400 to-fuchsia-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-xs opacity-70">
          <span>{percent}%</span>
          <span>
            {statusLabel} · {summary.releasedCount}/{summary.milestoneCount} milestones
          </span>
        </div>
      </div>
    </Link>
  );
}

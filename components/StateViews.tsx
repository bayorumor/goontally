import Link from "next/link";
import { Sparkles } from "lucide-react";

export function EmptyState({
  title,
  sub,
  actionLabel,
  actionHref,
  action,
}: {
  title: string;
  sub?: string;
  actionLabel?: string;
  actionHref?: string;
  // A custom action (e.g. a client button) instead of a link.
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary-text">
        <Sparkles size={20} />
      </span>
      <p className="text-[16px] font-semibold">{title}</p>
      {sub && <p className="max-w-xs text-[14px] text-muted">{sub}</p>}
      {actionLabel && actionHref && (
        <Link className="btn btn-primary mt-3" href={actionHref}>
          {actionLabel}
        </Link>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-[26px] font-bold tracking-tight">
          {title}
        </h1>
        {sub && <p className="mt-0.5 text-[14px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

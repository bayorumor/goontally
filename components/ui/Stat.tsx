// Small labelled number tile used in page heroes and Insights.
export default function Stat({
  value,
  label,
}: {
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="edge min-w-0 rounded-md bg-surface-1 px-3.5 py-2.5">
      <p className="truncate font-display text-[20px] font-bold leading-tight">
        {value}
      </p>
      <p className="truncate text-[12px] font-medium text-muted">{label}</p>
    </div>
  );
}

"use client";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-[16px] font-semibold">This page didn&apos;t load</p>
      <p className="text-[14px] text-muted">
        Check your connection, then try again.
      </p>
      <button className="btn btn-secondary mt-2" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}

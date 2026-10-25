import { EmptyState, PageHeader } from "@/components/StateViews";

// Stands in for pages that don't read data from the phone yet.
export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <EmptyState
        title="Nothing here yet"
        sub="This page arrives in a later version of the app."
      />
    </div>
  );
}

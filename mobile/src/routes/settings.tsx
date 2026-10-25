import { useLoaderData } from "react-router";
import BackupCard from "@/components/BackupCard";
import { PageHeader } from "@/components/StateViews";
import AutoBackupCard from "../components/AutoBackupCard";
import { getAutoBackup } from "../local/autoBackup";

// The phone's stand-in for the web Profile page: no account, just settings.
export const loader = () => getAutoBackup();

export function Component() {
  const autoBackup = useLoaderData<typeof loader>();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <PageHeader title="Settings" />
      <BackupCard anyFile />
      <AutoBackupCard settings={autoBackup} />
    </div>
  );
}

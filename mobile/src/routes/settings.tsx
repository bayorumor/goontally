import { useLoaderData } from "react-router";
import BackupCard from "@/components/BackupCard";
import { PageHeader } from "@/components/StateViews";
import AutoBackupCard from "../components/AutoBackupCard";
import SecurityCard from "../components/SecurityCard";
import AboutCard from "../components/AboutCard";
import TermsCard from "@/components/terms/TermsCard";
import OptionsCard from "@/components/options/OptionsCard";
import { getAutoBackup } from "../local/autoBackup";

// The phone's stand-in for the web Profile page: no account, just settings.
export const loader = () => getAutoBackup();

export function Component() {
  const autoBackup = useLoaderData<typeof loader>();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <PageHeader title="Settings" />
      <OptionsCard />
      <BackupCard anyFile />
      <AutoBackupCard settings={autoBackup} />
      <SecurityCard />
      <TermsCard where="phone" />
      <AboutCard />
    </div>
  );
}

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/api";
import { getUser } from "@/lib/queries";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import TimezoneCookie from "@/components/TimezoneCookie";
import { FeedbackProvider } from "@/components/ui/Feedback";
import { QuickLogProvider } from "@/components/log/QuickLog";
import OpenLogFromQuery from "@/components/log/OpenLogFromQuery";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  // A password set by someone else gets replaced before anything else.
  if (viewer.mustChangePassword) redirect("/change-password");
  const user = await getUser(viewer.id);

  return (
    <FeedbackProvider>
      <QuickLogProvider>
        <TimezoneCookie />
        <Suspense>
          <OpenLogFromQuery />
        </Suspense>
        <TopNav
          user={{
            username: user?.username ?? "",
            avatar: user?.avatar ?? null,
          }}
        />
        <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+32px)] pt-5 md:px-6 md:pb-16 md:pt-8">
          {children}
        </main>
        <BottomNav />
      </QuickLogProvider>
    </FeedbackProvider>
  );
}

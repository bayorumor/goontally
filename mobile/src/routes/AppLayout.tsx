import { Outlet, ScrollRestoration } from "react-router";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import { FeedbackProvider } from "@/components/ui/Feedback";
import { QuickLogProvider } from "@/components/log/QuickLog";

// The web app's signed-in layout, minus the account: the phone has one user
// and no login.
export default function AppLayout() {
  return (
    <FeedbackProvider>
      <QuickLogProvider>
        <TopNav user={{ username: "Goontally", avatar: null }} />
        <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+32px)] pt-5 md:px-6 md:pb-16 md:pt-8">
          <Outlet />
        </main>
        <BottomNav />
        {/* Next scrolls new pages to the top and restores on back. */}
        <ScrollRestoration />
      </QuickLogProvider>
    </FeedbackProvider>
  );
}

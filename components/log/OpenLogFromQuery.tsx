"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuickLog } from "./QuickLog";

// Opens the quick-log sheet for URLs ending in ?log=1, then drops the param.
export default function OpenLogFromQuery() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { openLog } = useQuickLog();
  const wantsLog = params.get("log") === "1";

  useEffect(() => {
    if (!wantsLog) return;
    openLog();
    router.replace(pathname);
  }, [wantsLog, openLog, router, pathname]);

  return null;
}

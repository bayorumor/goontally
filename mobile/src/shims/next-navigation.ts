import { useLayoutEffect, useRef, useState } from "react";
import {
  redirect as routerRedirect,
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useRevalidator,
  useSearchParams as useRouterSearchParams,
} from "react-router";

// Stands in for next/navigation in the Android app. The routes load their
// data from the phone, so router.refresh() re-runs the current route's
// loaders, just as it re-renders the server pages on the web.

export interface AppRouter {
  push(href: string, options?: { scroll?: boolean }): void;
  replace(href: string, options?: { scroll?: boolean }): void;
  back(): void;
  forward(): void;
  refresh(): void;
  prefetch(href: string): void;
}

// The same object on every render, as with Next, so components can list it
// in effect dependencies without re-running them.
export function useRouter(): AppRouter {
  const navigate = useNavigate();
  const { revalidate } = useRevalidator();
  const latest = useRef({ navigate, revalidate });
  useLayoutEffect(() => {
    latest.current = { navigate, revalidate };
  });

  const [router] = useState<AppRouter>(() => ({
    push: (href, options) =>
      void latest.current.navigate(href, {
        preventScrollReset: options?.scroll === false,
      }),
    replace: (href, options) =>
      void latest.current.navigate(href, {
        replace: true,
        preventScrollReset: options?.scroll === false,
      }),
    back: () => void latest.current.navigate(-1),
    forward: () => void latest.current.navigate(1),
    refresh: () => void latest.current.revalidate(),
    prefetch: () => {},
  }));
  return router;
}

export const usePathname = () => useLocation().pathname;

export const useSearchParams = () => useRouterSearchParams()[0];

export const useParams = useRouterParams;

// For route loaders; Next throws these from server code the same way.
export function redirect(href: string): never {
  throw routerRedirect(href);
}

export function notFound(): never {
  throw new Response("Not found", { status: 404 });
}

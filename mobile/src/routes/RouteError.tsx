import { isRouteErrorResponse, useRouteError } from "react-router";
import Link from "next/link";
import { EmptyState } from "@/components/StateViews";

// Shown when a route throws, instead of a blank screen. A missing person or
// group reads like the web app's 404.
export default function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404)
    return (
      <EmptyState
        title="Not found"
        sub="It may have been deleted."
        action={
          <Link href="/" className="btn btn-primary">
            Go home
          </Link>
        }
      />
    );

  return (
    <EmptyState
      title="Something went wrong"
      sub={error instanceof Error ? error.message : undefined}
      action={
        <button className="btn btn-primary" onClick={() => location.reload()}>
          Reload
        </button>
      }
    />
  );
}

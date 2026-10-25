import { isRouteErrorResponse, useRouteError } from "react-router";

// Shown when a route throws, instead of a blank screen.
export default function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Something went wrong";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[17px] font-semibold">Something went wrong</p>
      <p className="text-[14px] text-muted">{message}</p>
      <button className="btn btn-primary mt-2" onClick={() => location.reload()}>
        Reload
      </button>
    </div>
  );
}

import { createBrowserRouter, redirect } from "react-router";
import AppLayout from "./routes/AppLayout";
import Placeholder from "./routes/Placeholder";
import RouteError from "./routes/RouteError";
import { notFound } from "./routes/util";
import * as home from "./routes/home";
import * as library from "./routes/library";
import * as person from "./routes/person";
import * as group from "./routes/group";
import * as add from "./routes/add";

// Same paths as the web app, so shared components link to the right place.
// Each route's loader stands in for the web page's server code: it reads
// from the phone's database, and router.refresh() runs it again.
//
// A function, because creating the router runs the first page's loader
// straight away: call it once the database is open.
export const createRouter = () =>
  createBrowserRouter([
    {
      element: <AppLayout />,
      errorElement: <RouteError />,
      children: [
        {
          // Errors in a page show inside the layout, nav and all.
          errorElement: <RouteError />,
          children: [
            { index: true, ...home },
            { path: "library", ...library },
            { path: "persons", loader: () => redirect("/library") },
            { path: "persons/:id", ...person },
            { path: "groups", loader: () => redirect("/library?tab=groups") },
            { path: "groups/:id", ...group },
            { path: "add", ...add },
            { path: "history", element: <Placeholder title="History" /> },
            { path: "insights", element: <Placeholder title="Insights" /> },
            { path: "profile", element: <Placeholder title="Settings" /> },
            { path: "*", loader: () => notFound() },
          ],
        },
      ],
    },
  ]);

import { createBrowserRouter } from "react-router";
import AppLayout from "./routes/AppLayout";
import Placeholder from "./routes/Placeholder";
import RouteError from "./routes/RouteError";

// Same paths as the web app, so shared components link to the right place.
// Each route will load its data from the phone; until then they're
// placeholders.
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Placeholder title="Goontally" /> },
      { path: "library", element: <Placeholder title="Library" /> },
      { path: "history", element: <Placeholder title="History" /> },
      { path: "insights", element: <Placeholder title="Insights" /> },
      { path: "profile", element: <Placeholder title="Settings" /> },
      { path: "persons/:id", element: <Placeholder title="Person" /> },
      { path: "groups/:id", element: <Placeholder title="Group" /> },
      { path: "*", element: <Placeholder title="Not found" /> },
    ],
  },
]);

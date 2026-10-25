import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "@fontsource-variable/rubik";
import "@fontsource-variable/geom";
import "./index.css";
import { openDb } from "./local/db";
import { initPhotos } from "./local/photos";
import { App } from "@capacitor/app";
import { installLocalApi } from "./local/api";
import { runAutoBackupIfDue } from "./local/autoBackup";
import { checkIfDue } from "./local/updates";
import { createRouter } from "./router";
import LockGate from "./lock/LockGate";
import { installBackButton } from "./backButton";

const root = createRoot(document.getElementById("root")!);

// The database and photo folder are opened before anything renders, so
// every route can read from them straight away.
Promise.all([openDb(), initPhotos()])
  .then(() => {
    installLocalApi();
    const router = createRouter();
    installBackButton(router);
    root.render(
      <StrictMode>
        <LockGate>
          <RouterProvider router={router} />
        </LockGate>
      </StrictMode>,
    );
    // An automatic backup and the daily update check, if due, once the
    // first screen is up, and again whenever the app comes back to the front.
    const whenDue = () => {
      void runAutoBackupIfDue();
      void checkIfDue();
    };
    setTimeout(whenDue, 3000);
    void App.addListener("resume", whenDue);
  })
  .catch((err: unknown) => {
    console.error(err);
    root.render(
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-[17px] font-semibold">
          Couldn&apos;t open your data
        </p>
        <p className="text-[14px] text-muted">{String(err)}</p>
      </div>,
    );
  });

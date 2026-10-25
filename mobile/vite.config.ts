import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json" with { type: "json" };

// The Android app's web layer. It reuses the web app's components from the
// repo root; the next/* imports in them are pointed at small react-router
// versions in src/shims.
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The app's version, from package.json: shown in Settings and compared
  // with the newest release by the update check.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: here("src/shims/next-link.tsx") },
      {
        find: /^next\/navigation$/,
        replacement: here("src/shims/next-navigation.ts"),
      },
      // Backups download on the web; the phone hands them to the share menu.
      {
        find: /^@\/lib\/backup\/client$/,
        replacement: here("src/shims/backup-client.ts"),
      },
      // Same "@/…" imports as the web app.
      { find: /^@\//, replacement: here("../") },
    ],
    // Shared components live outside this folder; they must use the one
    // React the app runs on.
    dedupe: ["react", "react-dom"],
  },
  server: {
    // Lets the dev server read the shared components and fonts.
    fs: { allow: [here("..")] },
  },
});

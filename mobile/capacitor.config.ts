import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // The app's permanent identity on Android; it can't change after the
  // first release, or phones see it as a different app.
  appId: "app.goontally",
  // Shown under the icon. Kept short and discreet; Android reads it from
  // android/app/src/main/res/values/strings.xml, which matches.
  appName: "GT",
  // Vite's build output, copied into the APK by `cap sync`.
  webDir: "dist",
  // Shown behind the page while it loads: the Plum background.
  backgroundColor: "#120e17",
  plugins: {
    SystemBars: {
      // Light clock and icons on the dark page, whatever the phone's theme.
      style: "DARK",
      // index.html asks for viewport-fit=cover; saying so up front avoids a
      // layout jump on start.
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;

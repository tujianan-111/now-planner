import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.nowplanner.mobile",
  appName: "Now Planner",
  webDir: "dist",
  server: {
    androidScheme: "https"
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#F7F3E9"
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: "#F7F3E9",
      androidSplashResourceName: "splash",
      showSpinner: false
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#F7F3E9",
      overlaysWebView: false
    },
    LocalNotifications: {
      smallIcon: "ic_stat_now_planner",
      iconColor: "#244236"
    },
    Badge: {
      persist: true,
      autoClear: false
    }
  }
};

export default config;

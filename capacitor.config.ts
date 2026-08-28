const config = {
  appId: "com.track.lifting",
  appName: "Track II",
  webDir: "work/cloudflare-pages",
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_track",
      iconColor: "#F7F7F4",
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;

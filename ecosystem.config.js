module.exports = {
  apps: [
    {
      name: "discord",
      script: "./index.js",
      watch: ["commands", "events", "index.js", "hf.js"],
      ignore_watch: ["node_modules", "download_files"],
      watch_options: {
        followSymlinks: false,
      },
    },
  ],
};

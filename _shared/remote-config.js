// === ES Remote Config (edit me) ===
window.ES_REMOTE_CFG = {
  // Base URL for RAW reads (public, no token needed)
  readBase: "https://msoft83.github.io/opsportal/data/",
  // GitHub write settings (Contents API)
  repo: "msoft83/opsportal",   // "user/repo"
  branch: "main",
  // Set a GitHub token with 'repo' scope to enable writes. Leave empty for read-only.
  token: "",
  author: { name: "OpsPortal Bot", email: "opsportal@example.com" },
  files: {
    dataset: "dataset.json",
    stations:"stations.json",
    holder:  "holder_cache.json",
    training:"training.json"
  },
  pollSeconds: 12
};

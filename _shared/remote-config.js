// _shared/remote-config.js
// EDIT THESE FOUR to point to your repo. Keep basePath = "data" unless you change folder names.
window.__ES_REMOTE_CFG__ = {
  owner: "msoft83",           // <-- GitHub username or org
  repo: "opsportal",          // <-- repository name
  branch: "main",             // e.g., "main" or "gh-pages"
  basePath: "data",           // folder containing dataset.json / stations.json
  token: "",                  // OPTIONAL for direct writes (GitHub PAT with 'repo' scope). If empty => READ-ONLY
  forceHijack: true,          // keep true to force all pages to use remote only
  verbose: true               // set false to silence logs
};
/*
  _shared/remote-bridge.js
  Drop-in adapter to force ALL pages to read/write from GitHub (shared JSON) instead of localStorage.
  - Default: READ-ONLY (no token required). Pages will fetch latest JSON from your repo on every load (cache-busted).
  - Optional WRITE: If you add a GitHub token in remote-config.js, writes (replace/append/clear) will commit directly to the repo.
  - Zero-UI change: hijacks existing helper functions (readJSON/writeJSON/currentDataset/setDataset) when present.
*/

(function(){
  const GLOBAL = (typeof window !== "undefined") ? window : globalThis;

  // ---- Config (loaded from _shared/remote-config.js) ----
  const cfg = GLOBAL.__ES_REMOTE_CFG__ || {
    owner: "msoft83",
    repo: "opsportal",
    branch: "main",
    basePath: "data",
    // token: "", // PAT with repo scope (optional, for direct writes). If empty => read-only
    forceHijack: true,
    verbose: true
  };

  // --- Utilities ---
  function log(...a){ if(cfg.verbose) console.log("[ES-Remote]", ...a); }
  function err(...a){ console.error("[ES-Remote]", ...a); }

  function rawUrl(file){
    const u = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.basePath}/${file}`;
    const t = Date.now(); // cache-bust
    return `${u}?_=${t}`;
  }

  function apiUrlPath(file){
    // GitHub Contents API path
    const path = `${cfg.basePath}/${file}`.replace(/^\/+/,"");
    return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(path)}`;
  }

  async function fetchJSON(file, fallback){
    try{
      const res = await fetch(rawUrl(file), { cache: "no-store" });
      if(!res.ok) throw new Error("HTTP "+res.status);
      return await res.json();
    }catch(e){
      log("fetchJSON fallback for", file, e);
      return fallback !== undefined ? fallback : null;
    }
  }

  // GitHub write helpers (optional)
  async function getSha(file){
    const url = apiUrlPath(file);
    const res = await fetch(url, {
      headers: { "Accept": "application/vnd.github+json", ...(cfg.token? { "Authorization": `Bearer ${cfg.token}` } : {}) }
    });
    if(res.status === 404) return null;
    if(!res.ok) throw new Error("getSha HTTP "+res.status);
    const js = await res.json();
    return js.sha || null;
  }

  async function commitJSON(file, data, message="Update "+file){
    if(!cfg.token) throw new Error("No token provided for write.");
    const url = apiUrlPath(file);
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const sha = await getSha(file);
    const body = { message, content, branch: cfg.branch };
    if(sha) body.sha = sha;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.token}`
      },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const t = await res.text().catch(()=>"?");
      throw new Error("commitJSON HTTP "+res.status+" "+t);
    }
    return await res.json();
  }

  // Public API
  const ESRemote = {
    config: cfg,
    fetchJSON,
    saveJSON: async (name, data, msg) => { 
      return await commitJSON(name, data, msg || ("Update "+name)); 
    },
    getDataset: async () => await fetchJSON("dataset.json", []),
    getStations: async () => await fetchJSON("stations.json", {}),
    getTraining: async () => await fetchJSON("training.json", []),
    setDataset: async (arr) => await commitJSON("dataset.json", arr, "Update dataset.json"),
    setStations: async (obj) => await commitJSON("stations.json", obj, "Update stations.json"),
    setTraining: async (arr) => await commitJSON("training.json", arr, "Update training.json"),
    // Hijack common helpers AFTER pages define them
    hijack: function(){
      const TARGET_DATASET_KEY = (GLOBAL.STORE_KEY || "ES_DATASET_V4");
      const TARGET_STATIONS_KEY = (GLOBAL.STORE_STATIONS || "ES_STATIONS_V4");

      // replace "currentDataset" / "setDataset"
      GLOBAL.currentDataset = async function(){ 
        const ds = await ESRemote.getDataset();
        return Array.isArray(ds) ? ds : [];
      };
      GLOBAL.setDataset = async function(arr){ 
        if(!cfg.token){ log("READ-ONLY: setDataset ignored (no token). Export and commit manually)."); return; }
        await ESRemote.setDataset(Array.isArray(arr)?arr:[]); 
      };

      // Replace readJSON / writeJSON so existing code paths route to remote
      GLOBAL.readJSON = function(k, fallback){
        // Return fallback but warn — actual data should come via currentDataset/getStations
        if(k === TARGET_DATASET_KEY){ log("readJSON(dataset) -> remote only"); return fallback; }
        if(k === TARGET_STATIONS_KEY){ log("readJSON(stations) -> remote only"); return fallback; }
        return fallback;
      };

      GLOBAL.writeJSON = async function(k, v){
        if(k === TARGET_DATASET_KEY){
          if(!cfg.token){ log("READ-ONLY: writeJSON(dataset) ignored — export & push manually."); return; }
          await ESRemote.setDataset(v);
          return;
        }
        if(k === TARGET_STATIONS_KEY){
          if(!cfg.token){ log("READ-ONLY: writeJSON(stations) ignored — export & push manually."); return; }
          await ESRemote.setStations(v);
          return;
        }
        // ignore other keys
        log("writeJSON ignored key", k);
      };

      // Common helpers used in some pages
      GLOBAL.getStationsRemote = ESRemote.getStations;
      GLOBAL.saveStationsRemote = ESRemote.setStations;

      log("Hijack ready — pages now use GitHub JSON.");
    }
  };

  GLOBAL.ESRemote = ESRemote;

  // Auto-hijack right after load (but ensure page scripts had a chance to define their helpers)
  if(cfg.forceHijack){
    if(document.readyState === "complete" || document.readyState === "interactive"){
      setTimeout(()=>ESRemote.hijack(), 50);
    }else{
      document.addEventListener("DOMContentLoaded", ()=> setTimeout(()=>ESRemote.hijack(), 50));
    }
  }

})();
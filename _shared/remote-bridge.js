(function(){
  const GLOBAL = (typeof window !== "undefined") ? window : globalThis;
  const cfg = GLOBAL.__ES_REMOTE_CFG__ || {
    owner: "msoft83", repo: "opsportal", branch: "main", basePath: "data", forceHijack: true, verbose: true
  };
  function log(...a){ if(cfg.verbose) console.log("[ES-Remote]", ...a); }
  function rawUrl(file){ return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.basePath}/${file}?_=${Date.now()}`; }
  async function fetchJSON(file, fallback){
    try{ const r = await fetch(rawUrl(file), {cache:"no-store"}); if(!r.ok) throw 0; return await r.json(); }
    catch(e){ log("fallback", file, e); return fallback ?? null; }
  }
  async function getSha(file){
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent((cfg.basePath+"/"+file).replace(/^\/+/,""))}`;
    const res = await fetch(url, { headers: { "Accept":"application/vnd.github+json", ...(cfg.token? {"Authorization":`Bearer ${cfg.token}`}:{}) } });
    if(res.status===404) return null; if(!res.ok) throw new Error("getSha "+res.status); const js = await res.json(); return js.sha||null;
  }
  async function commitJSON(file, data, message){
    if(!cfg.token) throw new Error("No token for write");
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent((cfg.basePath+"/"+file).replace(/^\/+/,""))}`;
    const sha = await getSha(file);
    const body = { message: message||("Update "+file), content: btoa(unescape(encodeURIComponent(JSON.stringify(data,null,2)))), branch: cfg.branch };
    if(sha) body.sha = sha;
    const res = await fetch(url, { method:"PUT", headers:{ "Accept":"application/vnd.github+json","Content-Type":"application/json","Authorization":`Bearer ${cfg.token}` }, body: JSON.stringify(body)});
    if(!res.ok) throw new Error("commitJSON "+res.status+" "+await res.text());
    return await res.json();
  }
  const ESRemote = {
    config: cfg,
    fetchJSON,
    saveJSON: async (name, data, msg)=> commitJSON(name, data, msg||("Update "+name)),
    getDataset: async ()=> await fetchJSON("dataset.json", []),
    getStations: async ()=> await fetchJSON("stations.json", {}),
    getTraining: async ()=> await fetchJSON("training.json", []),
    setDataset: async (arr)=> await commitJSON("dataset.json", Array.isArray(arr)?arr:[], "Update dataset.json"),
    setStations: async (obj)=> await commitJSON("stations.json", obj||{}, "Update stations.json"),
    setTraining: async (arr)=> await commitJSON("training.json", Array.isArray(arr)?arr:[], "Update training.json"),
    hijack: function(){
      const GLOBAL = window;
      GLOBAL.currentDataset = async ()=> { const ds = await ESRemote.getDataset(); return Array.isArray(ds)?ds:[]; };
      GLOBAL.setDataset = async (arr)=> { if(!cfg.token){ log("READ-ONLY setDataset ignored"); return; } await ESRemote.setDataset(arr); };
      GLOBAL.readJSON = function(){ return null; };
      GLOBAL.writeJSON = async function(){ return null; };
      GLOBAL.getStationsRemote = ESRemote.getStations;
      GLOBAL.saveStationsRemote = ESRemote.setStations;
      log("Hijack ready");
    }
  };
  GLOBAL.ESRemote = ESRemote;
  if(cfg.forceHijack){
    if(document.readyState === "complete" || document.readyState === "interactive"){
      setTimeout(()=>ESRemote.hijack(), 50);
    }else{
      document.addEventListener("DOMContentLoaded", ()=> setTimeout(()=>ESRemote.hijack(), 50));
    }
  }
})();
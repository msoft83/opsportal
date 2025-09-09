// == ES Remote Bridge: single source of truth on GitHub (Raw + Contents API) ==
// This script avoids localStorage and keeps all data on GitHub under /data/*.
// It also monkey-patches localStorage getItem/setItem/removeItem for the three known keys
// so legacy code continues to work without edits.
(function(){
  const CFG = (window.ES_REMOTE_CFG||{});
  const READ = String(CFG.readBase||"").replace(/\/+$/,"") + "/";
  const FILES = CFG.files || {dataset:"dataset.json",stations:"stations.json",holder:"holder_cache.json",training:"training.json"};
  const KEYS  = { DATASET:"ES_DATASET_V4", STATIONS:"ES_STATIONS_V4", HOLDER:"ES_HOLDER_CACHE_V1" };

  // in-memory state (session-only; do not persist to localStorage)
  const mem = { [KEYS.DATASET]: [], [KEYS.STATIONS]: {}, [KEYS.HOLDER]: {} };
  const etag = { dataset:null, stations:null, holder:null, training:null };

  function onUpdate(k, v){
    mem[k] = v;
    try { if (typeof window.onStoreUpdate === "function") window.onStoreUpdate(k, v); } catch(e){}
    try { const bc = new BroadcastChannel('es-sync-v4'); bc.postMessage({type:k, value:v}); } catch(e){}
  }

  async function getJSON(remotePath, prevEtag){
    const res = await fetch(remotePath, {
      cache: "no-store",
      headers: Object.assign(
        {"Cache-Control":"no-cache","Pragma":"no-cache"},
        prevEtag ? {"If-None-Match": prevEtag} : {}
      )
    });
    if (res.status === 304) return { unchanged:true, etag: prevEtag };
    if (!res.ok) throw new Error("Fetch failed: "+remotePath+" — "+res.status);
    const j = await res.json();
    return { data:j, etag: res.headers.get("ETag") || null };
  }

  async function pull(name, key){
    const url = READ + FILES[name];
    try{
      const {data, etag:tg, unchanged} = await getJSON(url, etag[name]);
      if (!unchanged && data!==undefined){
        etag[name]=tg||null; onUpdate(key, data);
      }
    }catch(e){ /* keep old mem */ }
  }
  async function pullAll(){
    await Promise.all([
      pull("dataset", KEYS.DATASET),
      pull("stations", KEYS.STATIONS),
      pull("holder", KEYS.HOLDER),
      (FILES.training ? pull("training", "ES_TRAINING_RAW") : Promise.resolve())
    ]);
  }

  async function getSha(path){
    const gh = "https://api.github.com/repos/"+CFG.repo+"/contents/"+path+"?ref="+encodeURIComponent(CFG.branch||"main");
    const headers = {};
    if (CFG.token) headers.Authorization = "Bearer "+CFG.token;
    const r = await fetch(gh, { headers });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.sha ? j.sha : null;
  }
  function b64(s){ return btoa(unescape(encodeURIComponent(s))); }

  async function putFile(path, obj, message){
    if(!CFG.token){ throw new Error("No GitHub token configured in remote-config.js"); }
    const gh = "https://api.github.com/repos/"+CFG.repo+"/contents/"+path;
    const body = {
      message: message || ("opsportal: update "+path),
      branch: CFG.branch || "main",
      content: b64(JSON.stringify(obj, null, 2)),
      committer: CFG.author || undefined
    };
    const sha = await getSha(path);
    if (sha) body.sha = sha;
    const r = await fetch(gh, {
      method:"PUT",
      headers:{ "Content-Type":"application/json", Authorization: "Bearer "+CFG.token },
      body: JSON.stringify(body)
    });
    if(!r.ok){ throw new Error("GitHub write failed: "+path+" — "+r.status); }
    return r.json();
  }

  async function push(key, obj){
    let path;
    if (key===KEYS.DATASET)  path = FILES.dataset;
    else if (key===KEYS.STATIONS) path = FILES.stations;
    else if (key===KEYS.HOLDER)   path = FILES.holder;
    else if (key==="ES_TRAINING_RAW") path = FILES.training;
    else throw new Error("Unknown key: "+key);

    await putFile("data/"+path, obj, "opsportal: update "+path);
    await pullAll(); // refresh to pick up new ETag and broadcast
  }

  // Public helpers for pages
  window.getDataset = function(){ return Array.isArray(mem[KEYS.DATASET]) ? mem[KEYS.DATASET] : []; };
  window.setDataset = function(arr){ return push(KEYS.DATASET, Array.isArray(arr)?arr:[]); };

  window.getStations = function(){ return mem[KEYS.STATIONS] || {}; };
  window.setStation  = function(uid, code){
    const m = Object.assign({}, window.getStations());
    if (code) m[String(uid)] = String(code);
    else delete m[String(uid)];
    return push(KEYS.STATIONS, m);
  };
  window.clearStations = function(){ return push(KEYS.STATIONS, {}); };

  window.getHolder = function(){ return mem[KEYS.HOLDER] || {}; };
  window.putHolder = function(map){ return push(KEYS.HOLDER, map||{}); };

  window.readJSON  = function(key, fallback){ return (mem[key]!==undefined ? mem[key] : fallback); };
  window.writeJSON = function(key, val){ return push(key, val); };

  // Optional export helpers
  function download(name, text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'application/json'})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 2000); }
  window.ES_REMOTE = {
    KEYS, FILES,
    refreshFromRemote: pullAll,
    exportDataset:  function(){ download("dataset.json", JSON.stringify(getDataset(), null, 2)); },
    exportStations: function(){ download("stations.json", JSON.stringify(getStations(), null, 2)); },
    exportHolder:   function(){ download("holder_cache.json", JSON.stringify(getHolder(), null, 2)); }
  };

  // Monkey-patch localStorage for legacy code paths (only for our known keys)
  try{
    const orig = {
      getItem: localStorage.getItem.bind(localStorage),
      setItem: localStorage.setItem.bind(localStorage),
      removeItem: localStorage.removeItem.bind(localStorage)
    };
    localStorage.getItem = function(name){
      if (name===KEYS.DATASET)  return JSON.stringify(mem[KEYS.DATASET]||[]);
      if (name===KEYS.STATIONS) return JSON.stringify(mem[KEYS.STATIONS]||{});
      if (name===KEYS.HOLDER)   return JSON.stringify(mem[KEYS.HOLDER]||{});
      return orig.getItem(name);
    };
    localStorage.setItem = function(name, value){
      if (name===KEYS.DATASET){ try{ return push(KEYS.DATASET, JSON.parse(value||"[]")); }catch(e){ return; } }
      if (name===KEYS.STATIONS){ try{ return push(KEYS.STATIONS, JSON.parse(value||"{}")); }catch(e){ return; } }
      if (name===KEYS.HOLDER){ try{ return push(KEYS.HOLDER, JSON.parse(value||"{}")); }catch(e){ return; } }
      return orig.setItem(name, value);
    };
    localStorage.removeItem = function(name){
      if (name===KEYS.DATASET)  return push(KEYS.DATASET, []);
      if (name===KEYS.STATIONS) return push(KEYS.STATIONS, {});
      if (name===KEYS.HOLDER)   return push(KEYS.HOLDER, {});
      return orig.removeItem(name);
    };
  }catch(e){/* if blocked, ignore */}

  // Cross-tab sync for same device
  try{
    const bc = new BroadcastChannel('es-sync-v4');
    bc.onmessage = (ev)=>{
      if (!ev || !ev.data || !ev.data.type) return;
      const k = ev.data.type, v = ev.data.value;
      if (k && v!==undefined) onUpdate(k,v);
    };
  }catch(e){}

  // Initial pull + polling for cross-device sync
  const sec = Math.max(5, (+CFG.pollSeconds||12));
  pullAll(); setInterval(pullAll, sec*1000);
})();
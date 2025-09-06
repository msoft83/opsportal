
/*! _shared/remote-bridge.js
    Minimal remote data bridge (no design changes).
    Single source: https://msoft83.github.io/opsportal/data/
    Files:
      - dataset.json          (Array of employees; may include training_list)
      - stations.json         (Object: { [uid]: "station" })
      - holder_cache.json     (Object: optional)
    Behavior:
      - On load, fetch all three and persist to localStorage using legacy keys:
          ES_DATASET_V4, ES_STATIONS_V4, ES_HOLDER_CACHE_V1
      - Broadcast changes so open tabs update if they listen to 'es-sync-v4' channel.
      - Provide export helpers to download JSON files for manual upload to GitHub /data/.
*/
(function(){
  const DATA_BASE = "https://msoft83.github.io/opsportal/data/";
  const FILES = {
    dataset: "dataset.json",
    stations: "stations.json",
    holder: "holder_cache.json"
  };
  const KEYS = {
    DATASET: "ES_DATASET_V4",
    STATIONS: "ES_STATIONS_V4",
    HOLDER: "ES_HOLDER_CACHE_V1"
  };
  const bc = (()=>{ try { return new BroadcastChannel('es-sync-v4'); } catch(e){ return null; } })();

  async function getJSON(url){
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Fetch failed: " + url + " — " + res.status);
    return res.json();
  }

  async function refreshFromRemote(){
    const [ds, st, hc] = await Promise.all([
      getJSON(DATA_BASE + FILES.dataset).catch(()=>[]),
      getJSON(DATA_BASE + FILES.stations).catch(()=>({})),
      getJSON(DATA_BASE + FILES.holder).catch(()=>({})),
    ]);
    localStorage.setItem(KEYS.DATASET, JSON.stringify(ds));
    localStorage.setItem(KEYS.STATIONS, JSON.stringify(st));
    localStorage.setItem(KEYS.HOLDER, JSON.stringify(hc));
    if (bc){ try{
      bc.postMessage({type: KEYS.DATASET, value: ds});
      bc.postMessage({type: KEYS.STATIONS, value: st});
      bc.postMessage({type: KEYS.HOLDER, value: hc});
    }catch(e){} }
    return { ds, st, hc };
  }

  // auto-run ASAP (before other inline scripts ideally)
  (function autorun(){
    // Avoid infinite loops if pages also auto-refresh; only set once per tick.
    refreshFromRemote().catch(console.warn);
  })();

  // Export helpers (download as files for manual upload to GitHub Pages /data/)
  function download(name, obj){
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
  }
  function readLS(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)||""); }catch{ return (fallback); } }
  function exportDataset(){ download(FILES.dataset,  readLS(KEYS.DATASET,  [])); }
  function exportStations(){ download(FILES.stations, readLS(KEYS.STATIONS, {})); }
  function exportHolder(){ download(FILES.holder,   readLS(KEYS.HOLDER,   {})); }

  async function exportZipAll(){
    // Optional JSZip support if user already includes it
    const data = {
      [FILES.dataset]:  readLS(KEYS.DATASET,  []),
      [FILES.stations]: readLS(KEYS.STATIONS, {}),
      [FILES.holder]:   readLS(KEYS.HOLDER,   {}),
    };
    if (window.JSZip){
      const zip = new JSZip();
      Object.entries(data).forEach(([name, obj]) => zip.file(name, JSON.stringify(obj, null, 2)));
      const blob = await zip.generateAsync({type:"blob"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "data-pack.zip";
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
    } else {
      // fallback: 3 separate downloads
      exportDataset(); exportStations(); exportHolder();
    }
  }

  // Public API
  window.ES_REMOTE = {
    DATA_BASE, FILES, KEYS,
    refreshFromRemote,
    exportDataset, exportStations, exportHolder, exportZipAll
  };
})();

# OpsPortal — Remote GitHub Data (No Local Cache)

This pack makes **all pages read the shared JSON directly from GitHub** (no LocalStorage, no cache).  
Everyone loading the app sees **the same data** instantly (fresh fetch every load or refresh).

## Files
```
/_shared/remote-config.js   ← set your repo/branch/basePath/token here
/_shared/remote-bridge.js   ← hijacks helper functions to route to GitHub
/data/dataset.json          ← shared employees dataset
/data/stations.json         ← shared assignments (Station → uid/user mapping)
/data/training.json         ← optional training rows (Employee ID, Training)
```

> All your existing HTML pages already include `<script src="_shared/remote-bridge.js"></script>`.  
> Just drop these two files into `/_shared/`, add the `/data/` JSON to the repo, and you're live.

## Read-only by default
No token needed. Pages fetch latest JSON from:
```
https://raw.githubusercontent.com/<owner>/<repo>/<branch>/data/<file>.json
```
Cache is **busted** each time (timestamp query).

## Optional direct write (instant sync)
If you set a GitHub PAT token in `_shared/remote-config.js`, write operations (Replace, Append, Clear) will **commit** directly to the repo via the GitHub Contents API.

- Token must have `repo` scope (private repo) or `public_repo` (public).
- The bridge will compute the file `sha` automatically for updates.

## Data shapes
### dataset.json (Array of employees)
```json
[
  {
    "uid": "12061986",
    "employee_id": "200871664",
    "user_id": "anwmccul",
    "first_name": "Andrew",
    "employee_type": "3PTY",
    "barcode_id": "12061986",
    "libershare": "",                // optional
    "photo_url": "https://...",
    "training_list": ["Safety","Packing"]  // optional aggregated tags
  }
]
```

### stations.json (Object map)
```json
{
  "12061986": "1-01",
  "14934908": "2-07",
  "uid_or_userid_here": "A"         // letters can hold many; numeric assumed single by UI logic
}
```

### training.json (Optional, long-form rows)
```json
[
  { "Employee ID": "200871664", "Training": "Safety" },
  { "Employee ID": "200871664", "Training": "Packing" }
]
```
> Data Manager can still merge training into `dataset.json` as `training_list` if you enable write mode, or you can export and push manually.

## How it works (hijack)
- The bridge **replaces** `currentDataset()`, `setDataset()`, `readJSON()`, and `writeJSON()` (for dataset/stations keys) so that all reads come from GitHub and writes commit to GitHub (if token present).  
- If no token is present, write calls are **ignored** with a console message — use your existing **Export** buttons and commit the files to GitHub manually.

## Setup
1. Copy this whole folder into your repo root (keep paths the same).
2. Edit `/_shared/remote-config.js`:
   - `owner`, `repo`, `branch`
   - Optionally add `token` for direct writes.
3. Commit `data/dataset.json` and `data/stations.json` to the repo.
4. Open your pages. They will fetch shared JSON with no LocalStorage at all.

## Notes
- No UI changes needed. All styling and behavior stays the same.
- If any page still seeds embedded data, it will be ignored because the hijack injects remote getters.
- To temporarily disable hijack, set `forceHijack:false` in `_shared/remote-config.js`.
# OpsPortal Remote Bundle
- All pages now include `_shared/remote-config.js` and `_shared/remote-bridge.js`.
- Data source is GitHub `/data/*.json` (no localStorage).
- For WRITE access, set `token` in `_shared/remote-config.js` to a GitHub PAT with `repo` scope.
- Quick test: open any page; press Alt+R to force refresh from remote.
- Sample /data files are included.

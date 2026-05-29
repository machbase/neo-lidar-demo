# Physical AI Demo for Machbase Neo

Web-based 3D Physical AI demo that stores robotics/autonomous-driving sensor timelines in Machbase Neo and visualizes them through a local Three.js frontend.

## Runtime

This project targets Machbase Neo JSH, not plain Node.js.

Ask for the local `machbase-neo` executable path before running scripts:

```sh
<machbase-neo> jsh scripts/schema.js
<machbase-neo> jsh scripts/download-data.js --dataset kitti-raw --out data/raw/kitti
<machbase-neo> jsh scripts/ingest.js --data-root data/raw/kitti
<machbase-neo> jsh app/server.js --host 127.0.0.1 --port 56802
```

Machbase Neo DB defaults to `127.0.0.1:5656`, user `sys`, password `manager`.

## Local Data Policy

Dataset archives and extracted frames are stored under `data/raw/` and are not committed. The default downloader stores long KITTI raw sequences locally, and the default ingest joins them into logical sequence `kitti-raw-10m` so the demo covers a 10-minute-plus timeline. The demo never depends on CDN-hosted frontend libraries at runtime; Three.js is vendored in `public/vendor/`.

## Tables

All TAG tables use `TAG_PARTITION_COUNT=1`.

- `PHY_TIMELINE`: TAG JSON timeline rows with frame pose, scalar signals, source metadata, and event overlays.
- `PHY_LIDAR_FRAME`: original KITTI lidar `.bin` payloads, one Machbase `BINARY` row per frame.

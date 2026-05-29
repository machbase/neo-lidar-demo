'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const process = require('process');
const zip = require('archive/zip');
const ROOT = path.dirname(path.dirname(path.resolve(process.argv[1])));
const { parseArgs } = require(path.join(ROOT, 'lib', 'env.js'));

const KITTI_RAW_BASE = 'https://s3.eu-central-1.amazonaws.com/avg-kitti/raw_data';
const DEFAULT_FILES = [
  {
    name: '2011_09_30_calib.zip',
    url: `${KITTI_RAW_BASE}/2011_09_30_calib.zip`
  },
  {
    name: '2011_09_30_drive_0028_sync.zip',
    url: `${KITTI_RAW_BASE}/2011_09_30_drive_0028/2011_09_30_drive_0028_sync.zip`
  },
  {
    name: '2011_10_03_calib.zip',
    url: `${KITTI_RAW_BASE}/2011_10_03_calib.zip`
  },
  {
    name: '2011_10_03_drive_0027_sync.zip',
    url: `${KITTI_RAW_BASE}/2011_10_03_drive_0027/2011_10_03_drive_0027_sync.zip`
  }
];

function println() {
  if (console.println) console.println.apply(console, arguments);
  else console.log.apply(console, arguments);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function request(url, options) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options || {}, (res) => {
      resolve(res);
    });
    req.on('error', reject);
    req.end();
  });
}

async function contentLength(url) {
  const res = await request(url, { method: 'HEAD' });
  if (!res.ok) throw new Error(`HEAD failed ${res.statusCode}: ${url}`);
  const raw = res.headers['content-length'];
  const n = parseInt(raw || '0', 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`missing content-length: ${url}`);
  return n;
}

async function download(url, target, chunkBytes) {
  const total = await contentLength(url);
  const tmp = `${target}.part`;
  try { fs.unlinkSync(tmp); } catch (_) {}
  let written = 0;
  while (written < total) {
    const end = Math.min(total - 1, written + chunkBytes - 1);
    const res = await request(url, {
      method: 'GET',
      headers: { Range: `bytes=${written}-${end}` }
    });
    if (!(res.statusCode === 206 || res.ok)) {
      throw new Error(`range download failed ${res.statusCode}: ${url}`);
    }
    const bytes = res.readBodyBuffer();
    fs.appendFileSync(tmp, bytes);
    written += bytes.length || bytes.byteLength || 0;
    println('downloaded', target, `${Math.round((written / total) * 100)}%`);
    if (written <= end) throw new Error(`short read while downloading: ${url}`);
  }
  fs.renameSync(tmp, target);
  return { target: target, bytes: written };
}

function downloadSmall(url, target) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      if (!res.ok) {
        reject(new Error(`download failed ${res.statusCode}: ${url}`));
        return;
      }
      const bytes = res.readBodyBuffer();
      fs.writeFileSync(target, bytes);
      resolve({ target: target, bytes: bytes.length || bytes.byteLength || 0 });
    });
    req.on('error', reject);
  });
}

function extractZip(file, outDir) {
  const archive = new zip.Zip(file);
  archive.extractAllTo(outDir, { overwrite: true });
}

async function main() {
  const args = parseArgs(process.argv);
  const out = path.resolve(args.out || 'data/raw/kitti');
  const extract = args.extract !== false && args.extract !== 'false';
  const chunkMb = parseInt(args.chunkMb || args['chunk-mb'] || '32', 10);
  const chunkBytes = Math.max(1, chunkMb) * 1024 * 1024;
  const selected = args.file
    ? DEFAULT_FILES.filter(item => item.name.indexOf(args.file) >= 0)
    : DEFAULT_FILES;

  if (selected.length === 0) throw new Error('no matching dataset file');
  ensureDir(out);
  ensureDir(path.join(out, 'archives'));

  const results = [];
  for (const item of selected) {
    const target = path.join(out, 'archives', item.name);
    if (!fs.existsSync(target)) {
      println('downloading', item.url);
      if (item.name.indexOf('_calib') >= 0) {
        results.push(await downloadSmall(item.url, target));
      } else {
        results.push(await download(item.url, target, chunkBytes));
      }
    } else {
      results.push({ target: target, skipped: true });
    }
    if (extract) {
      println('extracting', target);
      extractZip(target, out);
    }
  }

  println(JSON.stringify({ ok: true, out: out, files: results }, null, 2));
}

let done = false;
let exitCode = 0;

main().catch((err) => {
  println(JSON.stringify({ ok: false, reason: err.message }, null, 2));
  exitCode = 1;
}).finally(() => {
  done = true;
});

const wait = setInterval(() => {
  if (!done) return;
  clearInterval(wait);
  if (exitCode !== 0) process.exit(exitCode);
}, 100);

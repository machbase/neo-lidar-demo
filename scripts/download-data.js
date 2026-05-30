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

function positiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function fileSize(file) {
  try {
    return fs.statSync(file).size;
  } catch (_) {
    return -1;
  }
}

function safeUnlink(file) {
  try { fs.unlinkSync(file); } catch (_) {}
}

function safeRmdir(dir) {
  try { fs.rmdirSync(dir); } catch (_) {}
}

function pad(n, width) {
  let s = String(n);
  while (s.length < width) s = `0${s}`;
  return s;
}

function header(headers, name) {
  const lower = String(name).toLowerCase();
  for (const key in headers || {}) {
    if (String(key).toLowerCase() === lower) return headers[key];
  }
  return undefined;
}

function getBuffer(url, options, allowedStatuses) {
  return new Promise((resolve, reject) => {
    const cb = (res) => {
      try {
        if (allowedStatuses && allowedStatuses.indexOf(res.statusCode) < 0) {
          reject(new Error(`unexpected HTTP status ${res.statusCode}: ${url}`));
          return;
        }
        resolve({
          statusCode: res.statusCode,
          ok: res.ok,
          headers: res.headers,
          body: res.readBodyBuffer()
        });
      } catch (err) {
        reject(err);
      }
    };
    const req = options ? http.get(url, options, cb) : http.get(url, cb);
    req.on('error', reject);
  });
}

async function contentLength(url) {
  const res = await getBuffer(url, { headers: { Range: 'bytes=0-0' } }, [206]);
  const contentRange = header(res.headers, 'content-range') || '';
  const match = String(contentRange).match(/\/([0-9]+)$/);
  const n = parseInt(match ? match[1] : '0', 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`missing content-length: ${url}`);
  return n;
}

function chunksFor(total, chunkBytes) {
  const chunks = [];
  for (let start = 0, index = 0; start < total; start += chunkBytes, index++) {
    const end = Math.min(total - 1, start + chunkBytes - 1);
    chunks.push({
      index: index,
      start: start,
      end: end,
      size: end - start + 1
    });
  }
  return chunks;
}

async function runPool(items, parallel, worker) {
  let next = 0;
  let stopped = false;
  const workers = [];
  const count = Math.min(parallel, items.length);
  for (let i = 0; i < count; i++) {
    workers.push((async () => {
      while (!stopped) {
        const index = next++;
        if (index >= items.length) return;
        try {
          await worker(items[index]);
        } catch (err) {
          stopped = true;
          throw err;
        }
      }
    })());
  }
  await Promise.all(workers);
}

async function downloadRange(url, part, chunk, total) {
  const tmp = `${part}.tmp`;
  safeUnlink(tmp);
  const allowFullBody = chunk.start === 0 && chunk.size === total;
  const res = await getBuffer(
    url,
    { headers: { Range: `bytes=${chunk.start}-${chunk.end}` } },
    allowFullBody ? [206, 200] : [206]
  );
  const fullBodyOk = res.statusCode === 200 && chunk.start === 0 && chunk.size === total;
  if (!(res.statusCode === 206 || fullBodyOk)) {
    throw new Error(`range download failed ${res.statusCode}: ${url}`);
  }
  const bytes = res.body;
  const written = bytes.length || bytes.byteLength || 0;
  if (written !== chunk.size) {
    throw new Error(`short read while downloading: ${url} bytes=${chunk.start}-${chunk.end} expected=${chunk.size} actual=${written}`);
  }
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, part);
}

function assembledSize(tmp, chunkBytes, total) {
  const size = fileSize(tmp);
  if (size <= 0) return 0;
  if (size > total || (size !== total && size % chunkBytes !== 0)) {
    println('discarding incomplete assembled file', tmp, `bytes=${size}`);
    safeUnlink(tmp);
    return 0;
  }
  return size;
}

function assembleParts(target, partDir, chunks, chunkBytes, total) {
  const tmp = `${target}.part`;
  let current = assembledSize(tmp, chunkBytes, total);
  if (current > 0) println('resuming assembled file', tmp, `bytes=${current}`);

  for (const chunk of chunks) {
    if (current > chunk.end) continue;
    if (current !== chunk.start) {
      throw new Error(`append offset mismatch expected=${chunk.start} actual=${current}`);
    }
    const part = path.join(partDir, `part-${pad(chunk.index, 6)}`);
    const size = fileSize(part);
    if (size !== chunk.size) {
      throw new Error(`missing downloaded part: ${part}`);
    }
    const bytes = fs.readFileSync(part, 'buffer');
    fs.appendFileSync(tmp, bytes);
    safeUnlink(part);
    current += chunk.size;
  }

  const finalSize = fileSize(tmp);
  if (finalSize !== total) {
    throw new Error(`download incomplete expected=${total} actual=${finalSize}`);
  }
  fs.renameSync(tmp, target);
  safeRmdir(partDir);
}

async function download(url, target, chunkBytes, parallel) {
  const total = await contentLength(url);
  const existing = fileSize(target);
  if (existing === total) {
    return { target: target, bytes: total, skipped: true };
  }
  if (existing >= 0) {
    println('replacing incomplete archive', target, `expected=${total}`, `actual=${existing}`);
    safeUnlink(target);
  }

  const partDir = `${target}.parts`;
  ensureDir(partDir);
  const chunks = chunksFor(total, chunkBytes);
  const assembled = assembledSize(`${target}.part`, chunkBytes, total);
  const pending = chunks.filter(chunk => chunk.end + 1 > assembled);
  let complete = chunks.length - pending.length;

  await runPool(pending, parallel, async (chunk) => {
    const part = path.join(partDir, `part-${pad(chunk.index, 6)}`);
    const size = fileSize(part);
    if (size !== chunk.size) {
      if (size >= 0) safeUnlink(part);
      await downloadRange(url, part, chunk, total);
    }
    complete++;
    println('downloaded', target, `${complete}/${chunks.length}`, `${Math.round((complete / chunks.length) * 100)}%`);
  });

  assembleParts(target, partDir, chunks, chunkBytes, total);
  return { target: target, bytes: total, chunks: chunks.length, parallel: parallel };
}

function extractZip(file, outDir) {
  const archive = new zip.Zip(file);
  archive.extractAllTo(outDir, { overwrite: true });
}

async function main() {
  const args = parseArgs(process.argv);
  const out = path.resolve(args.out || 'data/raw/kitti');
  const extract = args.extract !== false && args.extract !== 'false';
  const chunkMb = positiveInt(args.chunkMb || args['chunk-mb'], 64);
  const parallel = positiveInt(args.parallel, 4);
  const chunkBytes = chunkMb * 1024 * 1024;
  const selected = args.file
    ? DEFAULT_FILES.filter(item => item.name.indexOf(args.file) >= 0)
    : DEFAULT_FILES;

  if (selected.length === 0) throw new Error('no matching dataset file');
  ensureDir(out);
  ensureDir(path.join(out, 'archives'));

  const results = [];
  for (const item of selected) {
    const target = path.join(out, 'archives', item.name);
    println('downloading', item.url);
    results.push(await download(item.url, target, chunkBytes, parallel));
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

'use strict';

const fs = require('fs');
const path = require('path');

function exists(file) {
  try { return fs.existsSync(file); } catch (_) { return false; }
}

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
}

function findSequenceRoot(dataRoot, sequence) {
  const candidates = [
    path.join(dataRoot, sequence),
    dataRoot
  ];
  try {
    const children = fs.readdirSync(dataRoot);
    for (const child of children) {
      candidates.push(path.join(dataRoot, child, sequence));
    }
  } catch (_) {}
  for (const dir of candidates) {
    if (exists(path.join(dir, 'velodyne_points', 'data'))) return dir;
  }
  throw new Error(`KITTI sequence not found: ${sequence} under ${dataRoot}`);
}

function listBinFiles(sequenceRoot) {
  const dir = path.join(sequenceRoot, 'velodyne_points', 'data');
  return fs.readdirSync(dir)
    .filter(name => /\.bin$/i.test(name))
    .sort()
    .map(name => path.join(dir, name));
}

function readTimestamps(sequenceRoot) {
  const file = path.join(sequenceRoot, 'velodyne_points', 'timestamps.txt');
  if (!exists(file)) throw new Error(`missing timestamps: ${file}`);
  return readLines(file).map(text => new Date(text.replace(' ', 'T') + 'Z'));
}

function readOxts(sequenceRoot) {
  const dir = path.join(sequenceRoot, 'oxts', 'data');
  if (!exists(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => /\.txt$/i.test(name))
    .sort()
    .map(name => {
      const nums = fs.readFileSync(path.join(dir, name), 'utf8').trim().split(/\s+/).map(Number);
      return {
        lat: nums[0] || 0,
        lon: nums[1] || 0,
        alt: nums[2] || 0,
        roll: nums[3] || 0,
        pitch: nums[4] || 0,
        yaw: nums[5] || 0,
        vf: nums[8] || 0,
        vl: nums[9] || 0,
        vu: nums[10] || 0
      };
    });
}

function poseFromOxts(row, origin) {
  if (!row) {
    return { x: 0, y: 0, z: 0, roll: 0, pitch: 0, yaw: 0, speed: 0 };
  }
  const lat0 = origin.lat * Math.PI / 180;
  const metersPerDegLat = 111132.92;
  const metersPerDegLon = 111412.84 * Math.cos(lat0);
  const x = (row.lon - origin.lon) * metersPerDegLon;
  const y = (row.lat - origin.lat) * metersPerDegLat;
  const z = row.alt - origin.alt;
  const speed = Math.sqrt(row.vf * row.vf + row.vl * row.vl + row.vu * row.vu);
  return {
    x: x,
    y: y,
    z: z,
    roll: row.roll,
    pitch: row.pitch,
    yaw: row.yaw,
    speed: speed
  };
}

function bytesOf(data) {
  if (data instanceof Uint8Array) return data;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data && data.buffer) return new Uint8Array(data.buffer);
  return new Uint8Array(data);
}

function readPointBytes(file, stride) {
  const raw = fs.readFileSync(file, { encoding: 'buffer' });
  if (!stride || stride <= 1) return raw;
  return stridePointBytes(raw, stride);
}

function stridePointBytes(raw, stride) {
  raw = bytesOf(raw);
  if (!stride || stride <= 1) return raw;
  const pointBytes = 16;
  const pointCount = Math.floor(raw.length / pointBytes);
  const kept = Math.ceil(pointCount / stride);
  const out = new Uint8Array(kept * pointBytes);
  let offset = 0;
  for (let i = 0; i < pointCount; i += stride) {
    const start = i * pointBytes;
    out.set(raw.slice(start, start + pointBytes), offset);
    offset += pointBytes;
  }
  return out.slice(0, offset);
}

function chunkBytes(bytes, maxBytes) {
  const chunks = [];
  for (let i = 0; i < bytes.length; i += maxBytes) {
    chunks.push(bytes.subarray(i, Math.min(i + maxBytes, bytes.length)));
  }
  return chunks;
}

function sequenceInfo(dataRoot, sequence) {
  const root = findSequenceRoot(dataRoot, sequence);
  const bins = listBinFiles(root);
  const timestamps = readTimestamps(root);
  const oxts = readOxts(root);
  return { root: root, bins: bins, timestamps: timestamps, oxts: oxts };
}

module.exports = {
  chunkBytes,
  poseFromOxts,
  readPointBytes,
  sequenceInfo,
  stridePointBytes
};

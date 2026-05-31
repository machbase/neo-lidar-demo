'use strict';

const { Client } = require('machcli');
const path = require('path');
const process = require('process');

function rootDir() {
  const script = path.resolve(process.argv[1]);
  const cgi = script.indexOf('/cgi-bin/');
  if (cgi >= 0) return script.slice(0, cgi);
  const app = script.indexOf('/app/');
  if (app >= 0) return script.slice(0, app);
  const scripts = script.indexOf('/scripts/');
  if (scripts >= 0) return script.slice(0, scripts);
  return path.dirname(script);
}

const ROOT = rootDir();
const { dbConfig } = require(path.join(ROOT, 'lib', 'env.js'));
const { TABLES } = require(path.join(ROOT, 'lib', 'schema.js'));

const FALLBACK_START = Date.parse('2026-01-01T00:00:00Z');
const FALLBACK_DURATION_MS = 10 * 60 * 1000;

function get(row, name) {
  if (!row) return undefined;
  return row[name] != null ? row[name] : row[name.toUpperCase()];
}

function toIso(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  if (value == null) return null;
  return String(value);
}

function toEpochMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (value == null) return NaN;
  const text = String(value);
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return parsed;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (!match) return NaN;
  const ms = match[7] ? parseInt((match[7] + '000').slice(0, 3), 10) : 0;
  return Date.UTC(
    parseInt(match[1], 10),
    parseInt(match[2], 10) - 1,
    parseInt(match[3], 10),
    parseInt(match[4], 10),
    parseInt(match[5], 10),
    parseInt(match[6], 10),
    ms
  );
}

function bytesOf(value) {
  if (value == null) return new Uint8Array(0);
  if (value instanceof Uint8Array) return value;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return new Uint8Array(value);
  if (typeof value === 'string' && value.indexOf('0x') === 0) {
    const out = new Uint8Array((value.length - 2) / 2);
    for (let i = 2, j = 0; i < value.length; i += 2, j++) out[j] = parseInt(value.slice(i, i + 2), 16);
    return out;
  }
  if (typeof value === 'string') {
    const out = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) out[i] = value.charCodeAt(i) & 0xff;
    return out;
  }
  if (value.buffer) return new Uint8Array(value.buffer);
  return new Uint8Array(0);
}

function base64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function rawLength(value) {
  if (value == null) return 0;
  if (value.length != null) return value.length;
  if (value.byteLength != null) return value.byteLength;
  return bytesOf(value).length;
}

function stridedBuffer(value, stride) {
  const raw = value instanceof Uint8Array || Array.isArray(value) ? value : bytesOf(value);
  if (!stride || stride <= 1) return Buffer.from(raw);
  const pointBytes = 16;
  const pointCount = Math.floor(rawLength(raw) / pointBytes);
  const kept = Math.ceil(pointCount / stride);
  const out = Buffer.alloc(kept * pointBytes);
  let offset = 0;
  for (let i = 0; i < pointCount; i += stride) {
    const start = i * pointBytes;
    for (let j = 0; j < pointBytes; j++) out[offset + j] = raw[start + j];
    offset += pointBytes;
  }
  return offset === out.length ? out : out.subarray(0, offset);
}

function withDb(args, fn) {
  const db = new Client(dbConfig(args || {}));
  let conn;
  try {
    conn = db.connect();
    return fn(conn);
  } finally {
    try { conn && conn.close(); } catch (_) {}
    try { db && db.close(); } catch (_) {}
  }
}

function queryAll(conn, sql) {
  const params = [];
  for (let i = 2; i < arguments.length; i++) params.push(arguments[i]);
  const rows = params.length > 0 ? conn.query(sql, ...params) : conn.query(sql);
  const out = [];
  try {
    for (const row of rows) out.push(row);
  } finally {
    rows && rows.close && rows.close();
  }
  return out;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function fallbackManifest() {
  return {
    ok: true,
    source: 'synthetic-fallback',
    dataset: 'demo',
    sequence: 'synthetic-10m',
    minTime: new Date(FALLBACK_START).toISOString(),
    maxTime: new Date(FALLBACK_START + FALLBACK_DURATION_MS).toISOString(),
    durationMs: FALLBACK_DURATION_MS,
    frameCount: 6000,
    lods: [0, 1, 2],
    sensors: ['velodyne', 'pose', 'speed_mps', 'point_count']
  };
}

function fallbackFrame(ms) {
  const t = Number.isFinite(ms) ? ms : FALLBACK_START;
  const phase = ((t - FALLBACK_START) / 1000) * 0.25;
  const x = Math.cos(phase) * 28 + phase * 1.2;
  const y = Math.sin(phase * 0.7) * 18;
  const yaw = Math.atan2(Math.cos(phase * 0.7) * 18 * 0.7, -Math.sin(phase) * 28 + 1.2);
  return {
    ok: true,
    source: 'synthetic-fallback',
    frame: {
      time: new Date(t).toISOString(),
      frameId: Math.max(0, Math.round((t - FALLBACK_START) / 100)),
      position: { x: x, y: y, z: 0 },
      rotation: { roll: 0, pitch: 0, yaw: yaw },
      speed: 13 + Math.sin(phase * 0.8) * 4,
      pointCount: 2400
    },
    signals: {
      speed_mps: 13 + Math.sin(phase * 0.8) * 4,
      point_count: 2400,
      yaw_rad: yaw
    },
    events: []
  };
}

function fallbackPoints(ms, lod) {
  const frame = fallbackFrame(ms).frame;
  const count = lod === 0 ? 2600 : lod === 1 ? 900 : 320;
  const points = [];
  for (let i = 0; i < count; i++) {
    const a = i * 2.399963 + frame.frameId * 0.015;
    const r = 3 + (i % 130) * 0.24;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const z = Math.sin(i * 0.17 + frame.frameId * 0.02) * 1.1 - 0.45;
    const intensity = 0.35 + ((i * 17) % 100) / 160;
    points.push([x, y, z, intensity]);
  }
  return { ok: true, source: 'synthetic-fallback', encoding: 'json-points', frame: frame, points: points };
}

function pointsToBuffer(points) {
  const out = new Uint8Array(points.length * 16);
  const view = new DataView(out.buffer);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const offset = i * 16;
    view.setFloat32(offset, Number(p[0] || 0), true);
    view.setFloat32(offset + 4, Number(p[1] || 0), true);
    view.setFloat32(offset + 8, Number(p[2] || 0), true);
    view.setFloat32(offset + 12, Number(p[3] || 0), true);
  }
  return Buffer.from(out);
}

function fallbackPointBytes(ms, lod) {
  const fb = fallbackPoints(ms, lod);
  const bytes = pointsToBuffer(fb.points || []);
  return {
    ok: true,
    source: fb.source,
    encoding: 'f32xyzi-le',
    frame: fb.frame,
    lod: lod,
    pointCount: Math.floor(bytes.length / 16),
    byteCount: bytes.length,
    bytes: bytes
  };
}

function parseJsonValue(value) {
  if (value == null) return {};
  if (typeof value === 'object' && !(value instanceof Uint8Array) && !(value instanceof ArrayBuffer)) return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return {};
  }
}

function frameFromTimeline(row) {
  const payload = parseJsonValue(get(row, 'value'));
  const data = payload.frame || {};
  const position = data.position || {};
  const rotation = data.rotation || {};
  const frameId = Number(data.frame_id != null ? data.frame_id : get(row, 'frame_id') || 0);
  return {
    time: toIso(get(row, 'time')),
    frameId: frameId,
    position: {
      x: Number(position.x || 0),
      y: Number(position.y || 0),
      z: Number(position.z || 0)
    },
    rotation: {
      roll: Number(rotation.roll || 0),
      pitch: Number(rotation.pitch || 0),
      yaw: Number(rotation.yaw || 0)
    },
    speed: Number(data.speed || 0),
    pointCount: Number(data.point_count || 0),
    sourceSequence: data.source_sequence,
    sourceFrame: Number(data.source_frame || 0)
  };
}

function timelineStats(conn, dataset, sequence) {
  const rows = queryAll(
    conn,
    `SELECT MIN(time) min_time, MAX(time) max_time, COUNT(*) frame_count FROM ${TABLES.timeline} WHERE dataset = ? AND sequence = ?`,
    dataset,
    sequence
  );
  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  const count = Number(get(row, 'frame_count') || 0);
  if (count <= 0) return null;
  return {
    minTime: toIso(get(row, 'min_time')),
    maxTime: toIso(get(row, 'max_time')),
    minMs: toEpochMs(get(row, 'min_time')),
    maxMs: toEpochMs(get(row, 'max_time')),
    frameCount: count
  };
}

function targetFrameId(conn, dataset, sequence, ms) {
  const stats = timelineStats(conn, dataset, sequence);
  if (!stats) return 0;
  if (!Number.isFinite(ms)) return 0;
  if (!Number.isFinite(stats.minMs) || !Number.isFinite(stats.maxMs) || stats.maxMs <= stats.minMs) return 0;
  const ratio = Math.max(0, Math.min(1, (ms - stats.minMs) / (stats.maxMs - stats.minMs)));
  return Math.max(0, Math.min(stats.frameCount - 1, Math.round(ratio * (stats.frameCount - 1))));
}

function manifest(args) {
  try {
    return withDb(args, (conn) => {
      const rows = queryAll(conn, `SELECT dataset, sequence, MIN(time) min_time, MAX(time) max_time, COUNT(*) frame_count FROM ${TABLES.timeline} GROUP BY dataset, sequence ORDER BY dataset, sequence LIMIT 20`);
      if (!rows || rows.length === 0) return fallbackManifest();
      const first = rows[0];
      return {
        ok: true,
        source: 'machbase',
        datasets: rows.map(row => ({
          dataset: get(row, 'dataset'),
          sequence: get(row, 'sequence'),
          minTime: toIso(get(row, 'min_time')),
          maxTime: toIso(get(row, 'max_time')),
          frameCount: Number(get(row, 'frame_count') || 0)
        })),
        dataset: get(first, 'dataset'),
        sequence: get(first, 'sequence'),
        minTime: toIso(get(first, 'min_time')),
        maxTime: toIso(get(first, 'max_time')),
        frameCount: Number(get(first, 'frame_count') || 0),
        lods: [0, 1, 2],
        sensors: ['velodyne', 'pose', 'speed_mps', 'point_count']
      };
    });
  } catch (err) {
    const fb = fallbackManifest();
    fb.warning = err.message;
    return fb;
  }
}

function frame(args, query) {
  const ms = parseInt(query.time || '', 10);
  const dataset = query.dataset || args.dataset || 'kitti-raw';
  const sequence = query.sequence || args.sequence || 'kitti-raw-10m';
  try {
    return withDb(args, (conn) => {
      const requestedFrameId = query.frameId != null ? query.frameId : query.frameid;
      const frameId = requestedFrameId != null ? parseInt(requestedFrameId, 10) : targetFrameId(conn, dataset, sequence, ms);
      const tagName = `${dataset}.${sequence}.timeline`;
      const frameLimit = sqlNumber(frameId, 0);
      const rows = queryAll(
        conn,
        `SELECT time, value, frame_id FROM ${TABLES.timeline} WHERE name = ${sqlString(tagName)} AND frame_id <= ${frameLimit} ORDER BY frame_id DESC LIMIT 1`
      );
      if (!rows || rows.length === 0) return fallbackFrame(ms);
      const row = rows[0];
      const fr = frameFromTimeline(row);
      const payload = parseJsonValue(get(row, 'value'));
      return {
        ok: true,
        source: 'machbase',
        frame: fr,
        signals: payload.signals || {},
        events: payload.events || []
      };
    });
  } catch (err) {
    const fb = fallbackFrame(ms);
    fb.warning = err.message;
    return fb;
  }
}

function poses(args, query) {
  const dataset = query.dataset || args.dataset || 'kitti-raw';
  const sequence = query.sequence || args.sequence || 'kitti-raw-10m';
  const limit = Math.max(1, Math.min(50000, parseInt(query.limit || '20000', 10) || 20000));
  try {
    return withDb(args, (conn) => {
      const tagName = `${dataset}.${sequence}.timeline`;
      const rows = queryAll(
        conn,
        `SELECT time, value, frame_id FROM ${TABLES.timeline} WHERE name = ${sqlString(tagName)} ORDER BY frame_id LIMIT ${limit}`
      );
      if (!rows || rows.length === 0) return { ok: true, source: 'machbase', frames: [] };
      return {
        ok: true,
        source: 'machbase',
        frames: rows.map(frameFromTimeline)
      };
    });
  } catch (err) {
    return {
      ok: false,
      source: 'synthetic-fallback',
      warning: err.message,
      frames: []
    };
  }
}

function points(args, query) {
  const payload = pointsBinary(args, query);
  if (!payload || !payload.ok) return payload;
  const bytes = payload.bytes || Buffer.alloc(0);
  const out = {
    ok: true,
    source: payload.source,
    encoding: 'base64-f32xyzi-chunks',
    frame: payload.frame,
    lod: payload.lod,
    chunks: [{
      index: 0,
      pointCount: Math.floor(bytes.length / 16),
      byteCount: bytes.length,
      data: base64(bytes)
    }]
  };
  if (payload.warning) out.warning = payload.warning;
  return out;
}

function pointsBinary(args, query) {
  const ms = parseInt(query.time || '', 10);
  const lod = parseInt(query.lod || '1', 10);
  const requestedFrameId = query.frameId != null ? query.frameId : query.frameid;
  const fr = requestedFrameId != null
    ? { frameId: sqlNumber(requestedFrameId, 0) }
    : frame(args, query).frame;
  if (!fr || fr.frameId == null) return fallbackPointBytes(ms, lod);
  const dataset = query.dataset || args.dataset || 'kitti-raw';
  const sequence = query.sequence || args.sequence || 'kitti-raw-10m';
  try {
    return withDb(args, (conn) => {
      const tagName = `${dataset}.${sequence}.velodyne.raw`;
      const rows = queryAll(
        conn,
        `SELECT value, point_count, byte_count FROM ${TABLES.lidar} WHERE name = ${sqlString(tagName)} AND frame_id = ${sqlNumber(fr.frameId, 0)} LIMIT 1`
      );
      if (!rows || rows.length === 0) return fallbackPointBytes(ms, lod);
      const stride = lod === 0 ? 1 : lod === 1 ? 4 : 12;
      const bytes = stridedBuffer(get(rows[0], 'value'), stride);
      return {
        ok: true,
        source: 'machbase',
        encoding: 'f32xyzi-le',
        frame: fr,
        lod: lod,
        pointCount: Math.floor(bytes.length / 16),
        byteCount: bytes.length,
        bytes: bytes
      };
    });
  } catch (err) {
    const fb = fallbackPointBytes(ms, lod);
    fb.warning = err.message;
    return fb;
  }
}

module.exports = {
  frame,
  manifest,
  poses,
  points,
  pointsBinary
};

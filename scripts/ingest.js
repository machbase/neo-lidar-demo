'use strict';

const process = require('process');
const path = require('path');
const { Client } = require('machcli');
const ROOT = path.dirname(path.dirname(path.resolve(process.argv[1])));
const { dbConfig, intArg, parseArgs, resolveProjectPath } = require(path.join(ROOT, 'lib', 'env.js'));
const { TABLES, ensureSchema } = require(path.join(ROOT, 'lib', 'schema.js'));
const { poseFromOxts, readPointBytes, sequenceInfo } = require(path.join(ROOT, 'lib', 'kitti.js'));

function println() {
  if (console.println) console.println.apply(console, arguments);
  else console.log.apply(console, arguments);
}

function closeQuietly(obj) {
  try { obj && obj.close && obj.close(); } catch (_) {}
}

function main() {
  const args = parseArgs(process.argv);
  const dataRoot = resolveProjectPath(args.dataRoot || args['data-root'], 'data/raw/kitti', ROOT);
  const sequenceList = String(args.sequences || args.sequence || '2011_09_30_drive_0028_sync,2011_10_03_drive_0027_sync')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const sequence = args.logicalSequence || args['logical-sequence'] || (sequenceList.length > 1 ? 'kitti-raw-10m' : sequenceList[0]);
  const dataset = args.dataset || 'kitti-raw';
  const limit = intArg(args.limit, 0);
  const start = intArg(args.start, 0);
  const flushEvery = intArg(args.flushEvery || args['flush-every'], 200);

  const db = new Client(dbConfig(args));
  let conn;
  let timelineAppender;
  let lidarAppender;
  let frameCount = 0;
  let lidarCount = 0;

  try {
    conn = db.connect();
    ensureSchema(conn);
    timelineAppender = conn.append(TABLES.timeline);
    lidarAppender = conn.append(TABLES.lidar);

    let timelineMs = null;
    let timelineOffsetMs = 0;
    let globalFrameId = 0;
    let poseOffsetX = 0;
    let remaining = limit > 0 ? limit : 0;

    for (const sourceSequence of sequenceList) {
      if (limit > 0 && remaining <= 0) break;
      const info = sequenceInfo(dataRoot, sourceSequence);
      const origin = info.oxts[0] || { lat: 0, lon: 0, alt: 0 };
      const frameStart = sequenceList.length === 1 ? start : 0;
      const frameLimit = limit > 0
        ? Math.min(info.bins.length, frameStart + remaining)
        : info.bins.length;
      const seqStartMs = info.timestamps[frameStart] ? info.timestamps[frameStart].getTime() : Date.now();
      if (timelineMs == null) timelineMs = seqStartMs;

      for (let i = frameStart; i < frameLimit; i++) {
        const srcTime = info.timestamps[i] || new Date(seqStartMs + (i - frameStart) * 100);
        const time = new Date(timelineMs + timelineOffsetMs + (srcTime.getTime() - seqStartMs));
        const pose = poseFromOxts(info.oxts[i], origin);
        pose.x += poseOffsetX;
        const rawBytes = readPointBytes(info.bins[i], 1);
        const rawPointCount = Math.floor(rawBytes.length / 16);
        const frameId = globalFrameId++;

        const event = {
          frame_id: frameId,
          dataset: dataset,
          sequence: sequence,
          source_sequence: sourceSequence,
          source_frame: i,
          labels: [],
          note: 'KITTI raw frame imported without object annotations'
        };
        const timeline = {
          frame: {
            frame_id: frameId,
            source_sequence: sourceSequence,
            source_frame: i,
            position: { x: pose.x, y: pose.y, z: pose.z },
            rotation: { roll: pose.roll, pitch: pose.pitch, yaw: pose.yaw },
            speed: pose.speed,
            point_count: rawPointCount
          },
          signals: {
            speed_mps: pose.speed,
            point_count: rawPointCount,
            yaw_rad: pose.yaw
          },
          events: [event]
        };
        timelineAppender.append(
          `${dataset}.${sequence}.timeline`,
          time,
          JSON.stringify(timeline),
          frameId,
          dataset,
          sequence,
          'timeline',
          'ingest'
        );

        lidarAppender.append(
          `${dataset}.${sequence}.velodyne.raw`,
          time,
          rawBytes,
          frameId,
          rawPointCount,
          rawBytes.length,
          dataset,
          sequence,
          sourceSequence,
          i
        );
        lidarCount++;

        frameCount++;
        if (limit > 0) remaining--;
        if (flushEvery > 0 && frameCount % flushEvery === 0) {
          timelineAppender.flush();
          lidarAppender.flush();
          println('ingested frames', frameCount, 'lidar', lidarCount);
        } else if (frameCount % 100 === 0) {
          println('prepared frames', frameCount, 'lidar', lidarCount);
        }
      }

      const firstTime = info.timestamps[frameStart] || new Date(seqStartMs);
      const lastTime = info.timestamps[Math.max(frameStart, frameLimit - 1)] || firstTime;
      timelineOffsetMs += Math.max(100, lastTime.getTime() - firstTime.getTime() + 100);
      const lastPose = poseFromOxts(info.oxts[Math.max(frameStart, frameLimit - 1)], origin);
      poseOffsetX += lastPose.x + 40;
    }

    timelineAppender.flush();
    lidarAppender.flush();
    println(JSON.stringify({ ok: true, dataset: dataset, sequence: sequence, sourceSequences: sequenceList, frames: frameCount, lidar: lidarCount }, null, 2));
  } finally {
    closeQuietly(timelineAppender);
    closeQuietly(lidarAppender);
    closeQuietly(conn);
    closeQuietly(db);
  }
}

main();

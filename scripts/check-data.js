'use strict';

const fs = require('fs');
const path = require('path');
const process = require('process');
const ROOT = path.dirname(path.dirname(path.resolve(process.argv[1])));
const { parseArgs, resolveProjectPath } = require(path.join(ROOT, 'lib', 'env.js'));

function println() {
  if (console.println) console.println.apply(console, arguments);
  else console.log.apply(console, arguments);
}

const args = parseArgs(process.argv);
const dataRoot = resolveProjectPath(args.dataRoot || args['data-root'], 'data/raw/kitti', ROOT);
const sequence = args.sequence || '2011_09_30_drive_0028_sync';
const dateDir = sequence.slice(0, 10);
const checks = [
  dataRoot,
  path.join(dataRoot, dateDir),
  path.join(dataRoot, dateDir, sequence),
  path.join(dataRoot, dateDir, sequence, 'velodyne_points', 'data')
];

println('cwd', process.cwd ? process.cwd() : '(unknown)');
for (const file of checks) {
  println(file, fs.existsSync(file));
  try {
    if (fs.existsSync(file)) println('  entries', JSON.stringify(fs.readdirSync(file).slice(0, 5)));
  } catch (e) {
    println('  readdir error', e.message || String(e));
  }
}

'use strict';

const fs = require('fs');

function println() {
  if (console.println) console.println.apply(console, arguments);
  else console.log.apply(console, arguments);
}

function describe(label, value) {
  const type = Object.prototype.toString.call(value);
  const length = value && value.length != null ? value.length : value && value.byteLength != null ? value.byteLength : null;
  println(label, type, typeof value, length);
}

const file = '/work/data/raw/kitti/2011_09_30/2011_09_30_drive_0028_sync/velodyne_points/data/0000000000.bin';
const options = [
  undefined,
  null,
  'binary',
  { encoding: 'binary' },
  { encoding: null },
  { encoding: 'bytes' },
  { encoding: 'buffer' }
];

for (let i = 0; i < options.length; i++) {
  try {
    describe(String(i) + ' ' + JSON.stringify(options[i]), options[i] === undefined ? fs.readFileSync(file) : fs.readFileSync(file, options[i]));
  } catch (e) {
    println(String(i), 'error', e.message || String(e));
  }
}

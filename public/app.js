import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const canvas = document.getElementById('scene');
const timeline = document.getElementById('timeline');
const playButton = document.getElementById('playButton');
const speedSelect = document.getElementById('speedSelect');
const lodSelect = document.getElementById('lodSelect');
const cameraSelect = document.getElementById('cameraSelect');
const datasetLabel = document.getElementById('datasetLabel');
const sourceLabel = document.getElementById('sourceLabel');
const frameIdLabel = document.getElementById('frameId');
const speedLabel = document.getElementById('speed');
const pointsLabel = document.getElementById('points');
const lodLabel = document.getElementById('lodLabel');
const timeLabel = document.getElementById('timeLabel');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x111316, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x111316, 80, 220);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 800);
camera.position.set(0, -58, 34);
camera.up.set(0, 0, 1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI * 0.48;
controls.screenSpacePanning = false;

const grid = new THREE.GridHelper(180, 45, 0x40515d, 0x252d34);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

const axes = new THREE.AxesHelper(8);
scene.add(axes);

const vehicle = new THREE.Group();

function addBox(group, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.set(position.x, position.y, position.z);
  group.add(mesh);
  return mesh;
}

function createWheel(x, y) {
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.34, 32),
    new THREE.MeshStandardMaterial({ color: 0x101316, metalness: 0.25, roughness: 0.58 })
  );
  tire.rotation.z = Math.PI / 2;
  tire.position.set(x, y, 0.42);
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.38, 24),
    new THREE.MeshStandardMaterial({ color: 0xb8c4cf, metalness: 0.72, roughness: 0.25 })
  );
  rim.rotation.z = Math.PI / 2;
  rim.position.copy(tire.position);
  const wheel = new THREE.Group();
  wheel.add(tire);
  wheel.add(rim);
  return wheel;
}

function buildVehicle() {
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x20d5b3, metalness: 0.38, roughness: 0.32 });
  const darkPaint = new THREE.MeshStandardMaterial({ color: 0x137f78, metalness: 0.45, roughness: 0.36 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x9ed9ff,
    metalness: 0,
    roughness: 0.08,
    transparent: true,
    opacity: 0.45,
    transmission: 0.2
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0c1116, metalness: 0.2, roughness: 0.46 });
  const headlamp = new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffca5a, emissiveIntensity: 1.6 });
  const tailLamp = new THREE.MeshStandardMaterial({ color: 0xff5f66, emissive: 0xff2f3b, emissiveIntensity: 1.1 });
  const lidarMat = new THREE.MeshStandardMaterial({ color: 0xf2b84b, emissive: 0x8a5d12, emissiveIntensity: 0.55, metalness: 0.4, roughness: 0.28 });

  addBox(car, { x: 2.45, y: 4.75, z: 0.78 }, { x: 0, y: 0, z: 0.78 }, paint);
  addBox(car, { x: 2.05, y: 1.95, z: 0.72 }, { x: 0, y: -0.35, z: 1.42 }, glass);
  addBox(car, { x: 1.95, y: 1.36, z: 0.34 }, { x: 0, y: 1.55, z: 1.08 }, darkPaint);
  addBox(car, { x: 2.34, y: 0.28, z: 0.32 }, { x: 0, y: 2.48, z: 0.82 }, trim);
  addBox(car, { x: 2.34, y: 0.24, z: 0.3 }, { x: 0, y: -2.44, z: 0.82 }, trim);

  const windshield = addBox(car, { x: 1.72, y: 0.12, z: 0.52 }, { x: 0, y: 0.7, z: 1.75 }, glass);
  windshield.rotation.x = -0.36;
  const rearGlass = addBox(car, { x: 1.62, y: 0.12, z: 0.46 }, { x: 0, y: -1.26, z: 1.65 }, glass);
  rearGlass.rotation.x = 0.32;

  car.add(createWheel(-1.32, 1.48));
  car.add(createWheel(1.32, 1.48));
  car.add(createWheel(-1.32, -1.52));
  car.add(createWheel(1.32, -1.52));

  addBox(car, { x: 0.42, y: 0.08, z: 0.18 }, { x: -0.62, y: 2.73, z: 1.02 }, headlamp);
  addBox(car, { x: 0.42, y: 0.08, z: 0.18 }, { x: 0.62, y: 2.73, z: 1.02 }, headlamp);
  addBox(car, { x: 0.38, y: 0.08, z: 0.16 }, { x: -0.7, y: -2.7, z: 1.0 }, tailLamp);
  addBox(car, { x: 0.38, y: 0.08, z: 0.16 }, { x: 0.7, y: -2.7, z: 1.0 }, tailLamp);

  const scanner = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.24, 32), lidarMat);
  scanner.position.set(0, -0.2, 2.0);
  car.add(scanner);
  const scannerRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.018, 8, 36), lidarMat);
  scannerRing.position.copy(scanner.position);
  scannerRing.rotation.x = Math.PI / 2;
  car.add(scannerRing);

  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 5.2, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x23c7a9, transparent: true, opacity: 0.07, depthWrite: false })
  );
  beam.position.set(0, 2.78, 1.18);
  beam.rotation.x = Math.PI / 2;
  car.add(beam);

  return car;
}

const vehicleModel = buildVehicle();
const VEHICLE_VISUAL_SCALE = 0.78;
const VEHICLE_GROUND_OFFSET_Z = -1.72;
// KITTI/Velodyne uses local +X as the forward axis; the visual model is authored nose-to-+Y.
vehicleModel.rotation.z = -Math.PI / 2;
vehicleModel.scale.setScalar(VEHICLE_VISUAL_SCALE);
vehicleModel.position.z = VEHICLE_GROUND_OFFSET_Z;
vehicle.add(vehicleModel);
scene.add(vehicle);

const light = new THREE.DirectionalLight(0xffffff, 2.2);
light.position.set(30, -40, 80);
scene.add(light);
const fillLight = new THREE.DirectionalLight(0x62d7ff, 0.7);
fillLight.position.set(-30, 20, 28);
scene.add(fillLight);
scene.add(new THREE.AmbientLight(0x8da4b4, 1.0));

const pointMaterial = new THREE.PointsMaterial({
  size: 0.18,
  vertexColors: true,
  transparent: true,
  opacity: 0.9
});
let pointCloud = new THREE.Points(new THREE.BufferGeometry(), pointMaterial);
scene.add(pointCloud);

const trailMaterial = new THREE.LineBasicMaterial({ color: 0xf2b84b, transparent: true, opacity: 0.8 });
const trailGeometry = new THREE.BufferGeometry();
const trail = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trail);
const trailPoints = [];

let manifest = null;
let playing = false;
let currentMs = 0;
let minMs = 0;
let maxMs = 0;
let lastTick = performance.now();
let currentFrame = null;
let cameraSnap = true;
let pointLoading = false;
let lastPointFrameId = -1;
let lastTrailFrameId = -1;
let poseFramesReady = false;
const poseCache = new Map();
const poseRequests = new Map();

const CAMERA_MODES = {
  orbit: { fov: 58 },
  chase: {
    offset: { x: -13, y: 0, z: 5.5 },
    look: { x: 8, y: 0, z: 1.4 },
    fov: 58,
    smoothing: 0.22
  },
  highChase: {
    offset: { x: -24, y: -10, z: 14 },
    look: { x: 9, y: 0, z: 1.5 },
    fov: 52,
    smoothing: 0.18
  },
  hood: {
    offset: { x: 2.4, y: 0, z: 1.55 },
    look: { x: 24, y: 0, z: 1.15 },
    fov: 70,
    smoothing: 0.35
  },
  top: {
    offset: { x: 0, y: 0, z: 48 },
    look: { x: 0, y: 0, z: 0 },
    fov: 48,
    smoothing: 0.25
  },
  side: {
    offset: { x: -8, y: -24, z: 8 },
    look: { x: 1.5, y: 0, z: 1.2 },
    fov: 55,
    smoothing: 0.2
  },
  front: {
    offset: { x: 18, y: 0, z: 5 },
    look: { x: 0, y: 0, z: 1.2 },
    fov: 58,
    smoothing: 0.2
  }
};
const cameraTarget = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();
const cameraLook = new THREE.Vector3();
const initialCamera = new URLSearchParams(window.location.search).get('camera');
if (initialCamera && CAMERA_MODES[initialCamera]) cameraSelect.value = initialCamera;

async function api(path) {
  let res = await fetch(path);
  if (!res.ok && path.indexOf('/api/') === 0) {
    res = await fetch(path.replace('/api/', '/cgi-bin/api/'));
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function fmtTime(ms) {
  return new Date(ms).toISOString().replace('T', ' ').replace('Z', '');
}

function base64ToBytes(text) {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pointArraysFromChunks(chunks) {
  const positions = [];
  const colors = [];
  let total = 0;
  for (const chunk of chunks) {
    const bytes = base64ToBytes(chunk.data);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i + 15 < bytes.byteLength; i += 16) {
      const x = view.getFloat32(i, true);
      const y = view.getFloat32(i + 4, true);
      const z = view.getFloat32(i + 8, true);
      const intensity = Math.max(0.15, Math.min(1, view.getFloat32(i + 12, true)));
      positions.push(x, y, z);
      colors.push(0.1 + intensity * 0.25, 0.55 + intensity * 0.4, 0.72 + intensity * 0.22);
      total++;
    }
  }
  return { positions, colors, total };
}

function pointArraysFromJson(points) {
  const positions = [];
  const colors = [];
  for (const p of points) {
    const intensity = Math.max(0.15, Math.min(1, p[3] || 0.5));
    positions.push(p[0], p[1], p[2]);
    colors.push(0.1 + intensity * 0.25, 0.55 + intensity * 0.4, 0.72 + intensity * 0.22);
  }
  return { positions, colors, total: points.length };
}

function updatePointCloud(payload) {
  const data = payload.chunks ? pointArraysFromChunks(payload.chunks) : pointArraysFromJson(payload.points || []);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  pointCloud.geometry.dispose();
  pointCloud.geometry = geometry;
  pointsLabel.textContent = String(data.total);
}

function updateTrail(x, y, z) {
  trailPoints.push(new THREE.Vector3(x, y, z + 0.05));
  if (trailPoints.length > 280) trailPoints.shift();
  trailGeometry.setFromPoints(trailPoints);
}

function clampFrameId(frameId) {
  const maxFrame = manifest && manifest.frameCount ? manifest.frameCount - 1 : 0;
  return Math.max(0, Math.min(maxFrame, Math.round(frameId)));
}

function frameIdForMs(ms) {
  if (!manifest || !manifest.frameCount || maxMs <= minMs) return 0;
  const ratio = Math.max(0, Math.min(1, (ms - minMs) / (maxMs - minMs)));
  return ratio * (manifest.frameCount - 1);
}

function prunePoseCache(centerFrameId) {
  if (poseCache.size <= 20000) return;
  const keys = Array.from(poseCache.keys());
  keys.sort((a, b) => Math.abs(a - centerFrameId) - Math.abs(b - centerFrameId));
  for (let i = 16000; i < keys.length; i++) poseCache.delete(keys[i]);
}

function cachePose(frame) {
  if (!frame || frame.frameId == null) return null;
  const frameId = clampFrameId(frame.frameId);
  frame.frameId = frameId;
  poseCache.set(frameId, frame);
  prunePoseCache(frameId);
  return frame;
}

function requestPose(frameId) {
  const id = clampFrameId(frameId);
  if (poseCache.has(id)) return Promise.resolve(poseCache.get(id));
  if (poseRequests.has(id)) return poseRequests.get(id);
  const request = api(`/api/frame?frameId=${id}`)
    .then((payload) => cachePose(payload.frame))
    .catch((err) => {
      sourceLabel.textContent = err.message;
      return null;
    })
    .finally(() => poseRequests.delete(id));
  poseRequests.set(id, request);
  return request;
}

async function loadPoseFrames() {
  try {
    const payload = await api('/api/poses');
    const frames = payload.frames || [];
    for (const frame of frames) cachePose(frame);
    poseFramesReady = frames.length > 0;
    if (poseFramesReady) sourceLabel.textContent = `Loaded ${frames.length} poses from Machbase Neo`;
  } catch (err) {
    poseFramesReady = false;
    sourceLabel.textContent = err.message;
  }
}

function lerpAngle(a, b, t) {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

function interpolateFrame(a, b, t) {
  if (!a) return b || null;
  if (!b || a.frameId === b.frameId) return a;
  return {
    time: a.time,
    frameId: Math.round(a.frameId + (b.frameId - a.frameId) * t),
    position: {
      x: a.position.x + (b.position.x - a.position.x) * t,
      y: a.position.y + (b.position.y - a.position.y) * t,
      z: a.position.z + (b.position.z - a.position.z) * t
    },
    rotation: {
      roll: a.rotation.roll + (b.rotation.roll - a.rotation.roll) * t,
      pitch: a.rotation.pitch + (b.rotation.pitch - a.rotation.pitch) * t,
      yaw: lerpAngle(a.rotation.yaw, b.rotation.yaw, t)
    },
    speed: a.speed + (b.speed - a.speed) * t,
    pointCount: t < 0.5 ? a.pointCount : b.pointCount,
    sourceSequence: t < 0.5 ? a.sourceSequence : b.sourceSequence,
    sourceFrame: t < 0.5 ? a.sourceFrame : b.sourceFrame
  };
}

function localToWorld(frame, local, out) {
  const yaw = frame.rotation && Number.isFinite(frame.rotation.yaw) ? frame.rotation.yaw : 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  out.set(
    frame.position.x + local.x * c - local.y * s,
    frame.position.y + local.x * s + local.y * c,
    frame.position.z + local.z
  );
  return out;
}

function updateCameraFov(targetFov, immediate) {
  if (Math.abs(camera.fov - targetFov) < 0.05) return;
  camera.fov += (targetFov - camera.fov) * (immediate ? 1 : 0.18);
  camera.updateProjectionMatrix();
}

function applyCamera(frame, immediate) {
  if (!frame) return;
  const mode = cameraSelect.value || 'chase';
  const cfg = CAMERA_MODES[mode] || CAMERA_MODES.chase;
  controls.enabled = mode === 'orbit';

  if (mode === 'orbit') {
    cameraTarget.set(frame.position.x, frame.position.y, frame.position.z + 0.8);
    controls.target.lerp(cameraTarget, immediate ? 1 : 0.35);
    updateCameraFov(cfg.fov, immediate);
    return;
  }

  localToWorld(frame, cfg.offset, cameraDesired);
  localToWorld(frame, cfg.look, cameraLook);
  const alpha = immediate ? 1 : cfg.smoothing;
  camera.position.lerp(cameraDesired, alpha);
  cameraTarget.lerp(cameraLook, alpha);
  controls.target.copy(cameraTarget);
  updateCameraFov(cfg.fov, immediate);
  camera.lookAt(cameraTarget);
}

function renderFrame(frame, trailFrameId, immediate) {
  if (!frame) return;
  vehicle.position.set(frame.position.x, frame.position.y, frame.position.z);
  vehicle.rotation.set(frame.rotation.roll, frame.rotation.pitch, frame.rotation.yaw);
  pointCloud.position.copy(vehicle.position);
  pointCloud.rotation.copy(vehicle.rotation);
  currentFrame = frame;
  applyCamera(frame, immediate || cameraSnap);
  cameraSnap = false;

  if (trailFrameId !== lastTrailFrameId) {
    updateTrail(frame.position.x, frame.position.y, frame.position.z);
    lastTrailFrameId = trailFrameId;
  }

  frameIdLabel.textContent = String(frame.frameId);
  speedLabel.textContent = `${Number(frame.speed || 0).toFixed(1)} m/s`;
  timeLabel.textContent = fmtTime(currentMs);
}

function renderPlayback(ms, immediate) {
  if (!manifest) return;
  const exactFrame = frameIdForMs(ms);
  const baseId = clampFrameId(Math.floor(exactFrame));
  const nextId = clampFrameId(baseId + 1);
  const fraction = Math.max(0, Math.min(1, exactFrame - baseId));
  if (!poseFramesReady) {
    requestPose(baseId);
    requestPose(nextId);
  }
  const frame = interpolateFrame(poseCache.get(baseId), poseCache.get(nextId), fraction);
  if (frame) renderFrame(frame, baseId, immediate);
  requestPoints(clampFrameId(Math.round(exactFrame)), false);
}

async function requestPoints(frameId, force) {
  const id = clampFrameId(frameId);
  if (pointLoading || (!force && id === lastPointFrameId)) return;
  pointLoading = true;
  const lod = Number(lodSelect.value);
  try {
    const pointPayload = await api(`/api/points?frameId=${id}&lod=${lod}`);
    updatePointCloud(pointPayload);
    lastPointFrameId = id;
    lodLabel.textContent = String(lod);
    sourceLabel.textContent = pointPayload.source === 'machbase' ? 'Machbase Neo live query' : 'synthetic fallback until data is ingested';
  } catch (err) {
    sourceLabel.textContent = err.message;
  } finally {
    pointLoading = false;
  }
}

async function loadAt(ms, immediate) {
  if (!manifest) return;
  const exactFrame = frameIdForMs(ms);
  const baseId = clampFrameId(Math.floor(exactFrame));
  const nextId = clampFrameId(baseId + 1);
  await Promise.all([requestPose(baseId), requestPose(nextId)]);
  renderPlayback(ms, immediate);
}

function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}

function animate(now) {
  const dt = now - lastTick;
  lastTick = now;
  if (playing && manifest) {
    currentMs += dt * Number(speedSelect.value);
    if (currentMs > maxMs) currentMs = minMs;
    timeline.value = String(Math.round(((currentMs - minMs) / (maxMs - minMs)) * 1000));
  }
  renderPlayback(currentMs, false);
  if (currentFrame) applyCamera(currentFrame, false);
  if (controls.enabled) controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

timeline.addEventListener('input', () => {
  if (!manifest) return;
  currentMs = minMs + (Number(timeline.value) / 1000) * (maxMs - minMs);
  cameraSnap = true;
  lastPointFrameId = -1;
  loadAt(currentMs, true);
});

lodSelect.addEventListener('change', () => {
  lastPointFrameId = -1;
  requestPoints(clampFrameId(Math.round(frameIdForMs(currentMs))), true);
});

cameraSelect.addEventListener('change', () => {
  cameraSnap = true;
  if (currentFrame) applyCamera(currentFrame, true);
});

playButton.addEventListener('click', () => {
  playing = !playing;
  lastTick = performance.now();
  playButton.textContent = playing ? '||' : '>';
});

window.addEventListener('resize', resize);

async function boot() {
  resize();
  manifest = await api('/api/manifest');
  minMs = Date.parse(manifest.minTime);
  maxMs = Date.parse(manifest.maxTime);
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= minMs) {
    minMs = Date.now();
    maxMs = minMs + 600000;
  }
  currentMs = minMs;
  datasetLabel.textContent = `${manifest.dataset || 'dataset'} / ${manifest.sequence || 'sequence'} / ${manifest.frameCount || 0} frames`;
  sourceLabel.textContent = manifest.source === 'machbase' ? 'Machbase Neo live query' : 'synthetic fallback until data is ingested';
  await loadPoseFrames();
  await loadAt(currentMs, true);
  requestAnimationFrame(animate);
}

boot().catch((err) => {
  sourceLabel.textContent = err.message;
  requestAnimationFrame(animate);
});

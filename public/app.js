import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const canvas = document.getElementById('scene');
const timeline = document.getElementById('timeline');
const playButton = document.getElementById('playButton');
const speedSelect = document.getElementById('speedSelect');
const lodSelect = document.getElementById('lodSelect');
const colorSelect = document.getElementById('colorSelect');
const cameraSelect = document.getElementById('cameraSelect');
const datasetLabel = document.getElementById('datasetLabel');
const sourceLabel = document.getElementById('sourceLabel');
const frameIdLabel = document.getElementById('frameId');
const speedLabel = document.getElementById('speed');
const pointsLabel = document.getElementById('points');
const lodLabel = document.getElementById('lodLabel');
const timeLabel = document.getElementById('timeLabel');
const sourceFrameLabel = document.getElementById('sourceFrameLabel');
const pointRatioLabel = document.getElementById('pointRatioLabel');
const downsampleLabel = document.getElementById('downsampleLabel');
const queryLatencyLabel = document.getElementById('queryLatencyLabel');
const colorModeLabel = document.getElementById('colorModeLabel');
const colorRangeLabel = document.getElementById('colorRangeLabel');
const colorRamp = document.getElementById('colorRamp');
const colorMinLabel = document.getElementById('colorMinLabel');
const colorMaxLabel = document.getElementById('colorMaxLabel');
const miniMap = document.getElementById('miniMap');
const miniMapScaleLabel = document.getElementById('miniMapScaleLabel');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x111316, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x111316, 80, 220);
const miniMapCtx = miniMap.getContext('2d');
const MINI_MAP_RANGE_M = 50;
const MINI_MAP_RINGS_M = [10, 25, 50];

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

const COLOR_MODES = {
  intensity: {
    label: 'Intensity',
    minLabel: 'Low',
    maxLabel: 'High',
    range: (data) => [data.stats.minIntensity, data.stats.maxIntensity],
    value: (_x, _y, _z, intensity) => intensity,
    gradient: '#18323d, #23c7a9, #f2b84b',
    stops: [
      [0.0, [0.08, 0.18, 0.24]],
      [0.55, [0.14, 0.78, 0.66]],
      [1.0, [0.95, 0.72, 0.28]]
    ]
  },
  distance: {
    label: 'Distance',
    minLabel: 'Near',
    maxLabel: 'Far',
    range: (data) => [data.stats.minDistance, data.stats.maxDistance],
    value: (x, y, z) => Math.sqrt(x * x + y * y + z * z),
    gradient: '#f2b84b, #23c7a9, #5fa8ff',
    stops: [
      [0.0, [0.95, 0.72, 0.28]],
      [0.55, [0.14, 0.78, 0.66]],
      [1.0, [0.37, 0.66, 1.0]]
    ]
  },
  height: {
    label: 'Height',
    minLabel: 'Low',
    maxLabel: 'High',
    range: (data) => [data.stats.minHeight, data.stats.maxHeight],
    value: (_x, _y, z) => z,
    gradient: '#1f3b55, #23c7a9, #f2b84b',
    stops: [
      [0.0, [0.12, 0.23, 0.33]],
      [0.55, [0.14, 0.78, 0.66]],
      [1.0, [0.95, 0.72, 0.28]]
    ]
  },
  flat: {
    label: 'Flat',
    minLabel: 'Points',
    maxLabel: 'Uniform',
    range: () => [0, 1],
    value: () => 1,
    gradient: '#23c7a9, #23c7a9',
    stops: [
      [0.0, [0.14, 0.78, 0.66]],
      [1.0, [0.14, 0.78, 0.66]]
    ]
  }
};

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
let lastPointData = null;
let lastPointQueryMs = null;
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
const cameraBaseOffset = new THREE.Vector3();
const cameraAdjustedOffset = new THREE.Vector3();
const cameraAdjustedLook = new THREE.Vector3();
const cameraPanWorld = new THREE.Vector3();
const cameraPanRight = new THREE.Vector3();
const cameraPanUp = new THREE.Vector3();
const TRACK_ZOOM_MIN = 0.35;
const TRACK_ZOOM_MAX = 3.5;
const TRACK_PAN_LIMIT = 45;
const trackCameraOverrides = {};
const trackDrag = {
  active: false,
  pointerId: null,
  x: 0,
  y: 0
};
const urlParams = new URLSearchParams(window.location.search);
const initialCamera = urlParams.get('camera');
if (initialCamera && CAMERA_MODES[initialCamera]) cameraSelect.value = initialCamera;

function apiBaseFromLocation() {
  const explicit = urlParams.get('apiBase');
  if (explicit) return explicit.replace(/\/$/, '');
  if (window.location.pathname.indexOf('/db/tql/neo-lidar-demo/public/') >= 0) {
    return `${window.location.protocol}//${window.location.hostname}:56802`;
  }
  return '';
}

const apiBase = apiBaseFromLocation();

function apiUrl(base, path) {
  if (!base) return path;
  if (base.slice(-4) === '/api' && path.indexOf('/api/') === 0) return base + path.slice(4);
  return base + path;
}

function uniqueUrls(urls) {
  const seen = {};
  const out = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (!url || seen[url]) continue;
    seen[url] = true;
    out.push(url);
  }
  return out;
}

async function api(path) {
  const urls = apiBase ? [apiUrl(apiBase, path), path] : [path];
  if (path.indexOf('/api/') === 0) urls.push(path.replace('/api/', '/cgi-bin/api/'));
  let lastError = null;
  for (const url of uniqueUrls(urls)) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
      lastError = new Error(`${res.status} ${res.statusText}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('API request failed');
}

function fmtTime(ms) {
  return new Date(ms).toISOString().replace('T', ' ').replace('Z', '');
}

function fmtCount(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function base64ToBytes(text) {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function createPointStats() {
  return {
    minIntensity: Infinity,
    maxIntensity: -Infinity,
    minDistance: Infinity,
    maxDistance: -Infinity,
    minHeight: Infinity,
    maxHeight: -Infinity
  };
}

function includePointStats(stats, x, y, z, intensity) {
  const distance = Math.sqrt(x * x + y * y + z * z);
  stats.minIntensity = Math.min(stats.minIntensity, intensity);
  stats.maxIntensity = Math.max(stats.maxIntensity, intensity);
  stats.minDistance = Math.min(stats.minDistance, distance);
  stats.maxDistance = Math.max(stats.maxDistance, distance);
  stats.minHeight = Math.min(stats.minHeight, z);
  stats.maxHeight = Math.max(stats.maxHeight, z);
}

function finishPointStats(stats) {
  for (const key of Object.keys(stats)) {
    if (!Number.isFinite(stats[key])) stats[key] = 0;
  }
  return stats;
}

function pointArraysFromChunks(chunks) {
  const positions = [];
  const intensities = [];
  const stats = createPointStats();
  let total = 0;
  for (const chunk of chunks) {
    const bytes = base64ToBytes(chunk.data);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i + 15 < bytes.byteLength; i += 16) {
      const x = view.getFloat32(i, true);
      const y = view.getFloat32(i + 4, true);
      const z = view.getFloat32(i + 8, true);
      const intensity = Math.max(0, Math.min(1, view.getFloat32(i + 12, true) || 0));
      positions.push(x, y, z);
      intensities.push(intensity);
      includePointStats(stats, x, y, z, intensity);
      total++;
    }
  }
  return { positions, intensities, stats: finishPointStats(stats), total };
}

function pointArraysFromJson(points) {
  const positions = [];
  const intensities = [];
  const stats = createPointStats();
  for (const p of points) {
    const x = p[0] || 0;
    const y = p[1] || 0;
    const z = p[2] || 0;
    const intensity = Math.max(0, Math.min(1, p[3] || 0.5));
    positions.push(x, y, z);
    intensities.push(intensity);
    includePointStats(stats, x, y, z, intensity);
  }
  return { positions, intensities, stats: finishPointStats(stats), total: points.length };
}

function colorFromStops(stops, t, out, offset) {
  const v = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (v > stops[i][0]) continue;
    const prev = stops[i - 1];
    const next = stops[i];
    const span = Math.max(0.0001, next[0] - prev[0]);
    const local = (v - prev[0]) / span;
    out[offset] = prev[1][0] + (next[1][0] - prev[1][0]) * local;
    out[offset + 1] = prev[1][1] + (next[1][1] - prev[1][1]) * local;
    out[offset + 2] = prev[1][2] + (next[1][2] - prev[1][2]) * local;
    return;
  }
  const last = stops[stops.length - 1][1];
  out[offset] = last[0];
  out[offset + 1] = last[1];
  out[offset + 2] = last[2];
}

function currentColorMode() {
  return COLOR_MODES[colorSelect.value] || COLOR_MODES.intensity;
}

function colorsForPointData(data) {
  const mode = currentColorMode();
  const range = mode.range(data);
  const min = range[0];
  const max = range[1];
  const span = Math.max(0.0001, max - min);
  const colors = new Float32Array(data.total * 3);
  for (let i = 0; i < data.total; i++) {
    const x = data.positions[i * 3];
    const y = data.positions[i * 3 + 1];
    const z = data.positions[i * 3 + 2];
    const intensity = data.intensities[i];
    const value = mode.value(x, y, z, intensity);
    colorFromStops(mode.stops, (value - min) / span, colors, i * 3);
  }
  return colors;
}

function formatLegendValue(mode, value) {
  if (mode === COLOR_MODES.distance || mode === COLOR_MODES.height) return `${value.toFixed(1)}m`;
  return value.toFixed(2);
}

function updateColorLegend(data) {
  const mode = currentColorMode();
  const range = data ? mode.range(data) : [0, 1];
  colorModeLabel.textContent = mode.label;
  colorRangeLabel.textContent = `${formatLegendValue(mode, range[0])} - ${formatLegendValue(mode, range[1])}`;
  colorMinLabel.textContent = mode.minLabel;
  colorMaxLabel.textContent = mode.maxLabel;
  colorRamp.style.background = `linear-gradient(90deg, ${mode.gradient})`;
}

function pointFrameForTelemetry(payload, frameId) {
  if (poseCache.has(frameId)) return poseCache.get(frameId);
  if (payload && payload.frame) return payload.frame;
  if (currentFrame && currentFrame.frameId === frameId) return currentFrame;
  return null;
}

function updateTelemetryLabels() {
  if (!currentFrame && !lastPointData) {
    sourceFrameLabel.textContent = '--';
    pointRatioLabel.textContent = '--';
    downsampleLabel.textContent = '--';
    queryLatencyLabel.textContent = '--';
    return;
  }

  const pointData = lastPointData;
  const sourceFrameData = pointData || currentFrame;
  const source = sourceFrameData.sourceSequence || 'sequence';
  const sourceFrame = sourceFrameData.sourceFrame != null ? sourceFrameData.sourceFrame : sourceFrameData.frameId;
  const rawPoints = Number(pointData ? pointData.rawPointCount : currentFrame.pointCount || 0);
  const shownPoints = pointData ? pointData.total : 0;
  const ratio = rawPoints > 0 && shownPoints > 0 ? rawPoints / shownPoints : 0;

  sourceFrameLabel.textContent = `${source} #${sourceFrame}`;
  pointRatioLabel.textContent = shownPoints > 0 ? `${fmtCount(rawPoints)} / ${fmtCount(shownPoints)}` : `${fmtCount(rawPoints)} / --`;
  downsampleLabel.textContent = ratio > 0 ? `${ratio.toFixed(ratio >= 10 ? 1 : 2)}x` : '--';
  queryLatencyLabel.textContent = lastPointQueryMs != null ? `${Math.round(lastPointQueryMs)}ms` : '--';
}

function applyPointColorMode() {
  if (!lastPointData || !pointCloud.geometry) {
    updateColorLegend(null);
    return;
  }
  pointCloud.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsForPointData(lastPointData), 3));
  pointCloud.geometry.attributes.color.needsUpdate = true;
  updateColorLegend(lastPointData);
}

function pointPayloadByteCount(payload) {
  if (payload.chunks) {
    return payload.chunks.reduce((sum, chunk) => sum + Number(chunk.byteCount || 0), 0);
  }
  return (payload.points || []).length * 16;
}

function updatePointCloud(payload, frameId, queryMs) {
  const data = payload.chunks ? pointArraysFromChunks(payload.chunks) : pointArraysFromJson(payload.points || []);
  const pointFrame = pointFrameForTelemetry(payload, frameId);
  data.frameId = frameId;
  data.byteCount = pointPayloadByteCount(payload);
  data.rawPointCount = Number(pointFrame && pointFrame.pointCount || 0);
  data.sourceSequence = pointFrame && pointFrame.sourceSequence || 'sequence';
  data.sourceFrame = pointFrame && pointFrame.sourceFrame != null ? pointFrame.sourceFrame : frameId;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  pointCloud.geometry.dispose();
  pointCloud.geometry = geometry;
  lastPointData = data;
  lastPointQueryMs = queryMs;
  applyPointColorMode();
  pointsLabel.textContent = String(data.total);
  updateTelemetryLabels();
}

function updateTrail(x, y, z) {
  trailPoints.push(new THREE.Vector3(x, y, z + 0.05));
  if (trailPoints.length > 280) trailPoints.shift();
  trailGeometry.setFromPoints(trailPoints);
}

function resizeMiniMapCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = miniMap.clientWidth || 220;
  const height = miniMap.clientHeight || 160;
  const nextWidth = Math.max(1, Math.round(width * dpr));
  const nextHeight = Math.max(1, Math.round(height * dpr));
  if (miniMap.width !== nextWidth || miniMap.height !== nextHeight) {
    miniMap.width = nextWidth;
    miniMap.height = nextHeight;
  }
  miniMapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: width, height: height };
}

function miniMapPoint(frame, point, centerX, centerY, scale) {
  const yaw = frame.rotation && Number.isFinite(frame.rotation.yaw) ? frame.rotation.yaw : 0;
  const dx = point.x - frame.position.x;
  const dy = point.y - frame.position.y;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const forward = dx * c + dy * s;
  const lateral = -dx * s + dy * c;
  return {
    x: centerX + lateral * scale,
    y: centerY - forward * scale
  };
}

function drawMiniMapPointCloud(centerX, centerY, scale) {
  const data = lastPointData;
  if (!data || !data.total) return;

  const positions = data.positions;
  const stride = Math.max(1, Math.ceil(data.total / 1600));
  miniMapCtx.fillStyle = 'rgba(119, 224, 216, 0.58)';
  for (let i = 0; i < data.total; i += stride) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) > MINI_MAP_RANGE_M) continue;
    miniMapCtx.fillRect(centerX + y * scale - 0.6, centerY - x * scale - 0.6, 1.2, 1.2);
  }
}

function drawMiniMap(frame) {
  const size = resizeMiniMapCanvas();
  const width = size.width;
  const height = size.height;
  miniMapCtx.clearRect(0, 0, width, height);
  miniMapCtx.fillStyle = 'rgba(10, 13, 16, 0.72)';
  miniMapCtx.fillRect(0, 0, width, height);
  if (!frame) return;

  const centerX = width / 2;
  const centerY = height * 0.62;
  const radius = Math.min(width * 0.42, centerY - 10, height - centerY - 4);
  const scale = radius / MINI_MAP_RANGE_M;

  drawMiniMapPointCloud(centerX, centerY, scale);

  miniMapCtx.strokeStyle = 'rgba(156, 168, 180, 0.24)';
  miniMapCtx.lineWidth = 1;
  for (const ring of MINI_MAP_RINGS_M) {
    miniMapCtx.beginPath();
    miniMapCtx.arc(centerX, centerY, ring * scale, 0, Math.PI * 2);
    miniMapCtx.stroke();
  }

  miniMapCtx.strokeStyle = 'rgba(156, 168, 180, 0.18)';
  miniMapCtx.beginPath();
  miniMapCtx.moveTo(centerX, 8);
  miniMapCtx.lineTo(centerX, height - 8);
  miniMapCtx.moveTo(8, centerY);
  miniMapCtx.lineTo(width - 8, centerY);
  miniMapCtx.stroke();

  if (trailPoints.length > 1) {
    miniMapCtx.beginPath();
    for (let i = 0; i < trailPoints.length; i++) {
      const point = miniMapPoint(frame, trailPoints[i], centerX, centerY, scale);
      if (i === 0) miniMapCtx.moveTo(point.x, point.y);
      else miniMapCtx.lineTo(point.x, point.y);
    }
    miniMapCtx.strokeStyle = 'rgba(242, 184, 75, 0.86)';
    miniMapCtx.lineWidth = 2;
    miniMapCtx.stroke();
  }

  miniMapCtx.fillStyle = '#23c7a9';
  miniMapCtx.beginPath();
  miniMapCtx.moveTo(centerX, centerY - 8);
  miniMapCtx.lineTo(centerX - 6, centerY + 7);
  miniMapCtx.lineTo(centerX + 6, centerY + 7);
  miniMapCtx.closePath();
  miniMapCtx.fill();

  miniMapCtx.fillStyle = 'rgba(240, 244, 248, 0.86)';
  miniMapCtx.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  miniMapCtx.fillText('FWD', centerX + 8, 18);
  miniMapScaleLabel.textContent = `${MINI_MAP_RANGE_M}m`;
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

function worldDeltaToLocal(frame, delta, out) {
  const yaw = frame.rotation && Number.isFinite(frame.rotation.yaw) ? frame.rotation.yaw : 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  out.set(
    delta.x * c + delta.y * s,
    -delta.x * s + delta.y * c,
    delta.z
  );
  return out;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampTrackPan(pan) {
  pan.x = clamp(pan.x, -TRACK_PAN_LIMIT, TRACK_PAN_LIMIT);
  pan.y = clamp(pan.y, -TRACK_PAN_LIMIT, TRACK_PAN_LIMIT);
  pan.z = clamp(pan.z, -TRACK_PAN_LIMIT, TRACK_PAN_LIMIT);
}

function isTrackCameraMode() {
  return (cameraSelect.value || 'chase') !== 'orbit';
}

function getTrackCameraOverride(mode) {
  const key = mode || cameraSelect.value || 'chase';
  if (!trackCameraOverrides[key]) {
    trackCameraOverrides[key] = {
      zoom: 1,
      pan: new THREE.Vector3()
    };
  }
  return trackCameraOverrides[key];
}

function resetTrackCamera(mode) {
  const override = getTrackCameraOverride(mode);
  override.zoom = 1;
  override.pan.set(0, 0, 0);
  cameraSnap = true;
  if (currentFrame) applyCamera(currentFrame, true);
}

function addTrackPanFromPointer(frame, dx, dy) {
  if (!frame) return;
  const mode = cameraSelect.value || 'chase';
  const override = getTrackCameraOverride(mode);
  const targetDistance = Math.max(1, camera.position.distanceTo(cameraTarget));
  const scale = 2 * targetDistance * Math.tan((camera.fov * Math.PI / 180) / 2) / Math.max(1, canvas.clientHeight);

  cameraPanRight.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(-dx * scale);
  cameraPanUp.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(dy * scale);
  cameraPanWorld.copy(cameraPanRight).add(cameraPanUp);
  worldDeltaToLocal(frame, cameraPanWorld, cameraPanWorld);
  override.pan.add(cameraPanWorld);
  clampTrackPan(override.pan);
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

  const override = getTrackCameraOverride(mode);
  cameraBaseOffset.copy(cfg.offset).sub(cfg.look).multiplyScalar(override.zoom);
  cameraAdjustedLook.copy(cfg.look).add(override.pan);
  cameraAdjustedOffset.copy(cameraAdjustedLook).add(cameraBaseOffset);
  localToWorld(frame, cameraAdjustedOffset, cameraDesired);
  localToWorld(frame, cameraAdjustedLook, cameraLook);
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
  updateTelemetryLabels();
  drawMiniMap(frame);
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
    const queryStarted = performance.now();
    const pointPayload = await api(`/api/points?frameId=${id}&lod=${lod}`);
    lastPointFrameId = id;
    updatePointCloud(pointPayload, id, performance.now() - queryStarted);
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
  drawMiniMap(currentFrame);
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

colorSelect.addEventListener('change', () => {
  applyPointColorMode();
});

cameraSelect.addEventListener('change', () => {
  cameraSnap = true;
  if (currentFrame) applyCamera(currentFrame, true);
});

canvas.addEventListener('wheel', (event) => {
  if (!isTrackCameraMode()) return;
  event.preventDefault();
  const mode = cameraSelect.value || 'chase';
  const override = getTrackCameraOverride(mode);
  override.zoom = clamp(override.zoom * Math.exp(event.deltaY * 0.001), TRACK_ZOOM_MIN, TRACK_ZOOM_MAX);
  if (currentFrame) applyCamera(currentFrame, true);
}, { passive: false });

canvas.addEventListener('pointerdown', (event) => {
  if (!isTrackCameraMode()) return;
  const wantsPan = event.button === 2 || (event.button === 0 && event.shiftKey);
  if (!wantsPan) return;
  event.preventDefault();
  trackDrag.active = true;
  trackDrag.pointerId = event.pointerId;
  trackDrag.x = event.clientX;
  trackDrag.y = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!trackDrag.active || event.pointerId !== trackDrag.pointerId) return;
  event.preventDefault();
  const dx = event.clientX - trackDrag.x;
  const dy = event.clientY - trackDrag.y;
  trackDrag.x = event.clientX;
  trackDrag.y = event.clientY;
  addTrackPanFromPointer(currentFrame, dx, dy);
  if (currentFrame) applyCamera(currentFrame, true);
});

function endTrackDrag(event) {
  if (!trackDrag.active || event.pointerId !== trackDrag.pointerId) return;
  trackDrag.active = false;
  trackDrag.pointerId = null;
  try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
}

canvas.addEventListener('pointerup', endTrackDrag);
canvas.addEventListener('pointercancel', endTrackDrag);

canvas.addEventListener('contextmenu', (event) => {
  if (!isTrackCameraMode()) return;
  event.preventDefault();
});

canvas.addEventListener('dblclick', (event) => {
  if (!isTrackCameraMode()) return;
  event.preventDefault();
  resetTrackCamera(cameraSelect.value || 'chase');
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

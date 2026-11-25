import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ═══════════════════════════════════════════════════════════════
// STATE & CONSTANTS
// ═══════════════════════════════════════════════════════════════
const WAYPOINTS = [
  { id: 1, name: 'WP-01', lat: 28.6139, lon: 77.2090, alt: 215.2, radius: 2.0, x: 110, y: 390 },
  { id: 2, name: 'WP-02', lat: 28.6143, lon: 77.2096, alt: 215.6, radius: 2.0, x: 165, y: 310 },
  { id: 3, name: 'WP-03', lat: 28.6149, lon: 77.2104, alt: 216.1, radius: 2.5, x: 245, y: 265 },
  { id: 4, name: 'WP-04', lat: 28.6152, lon: 77.2113, alt: 216.8, radius: 2.0, x: 330, y: 210 },
  { id: 5, name: 'WP-05', lat: 28.6147, lon: 77.2121, alt: 217.0, radius: 2.0, x: 395, y: 155 },
  { id: 6, name: 'WP-06', lat: 28.6138, lon: 77.2124, alt: 216.4, radius: 2.5, x: 370, y: 95  },
  { id: 7, name: 'WP-07', lat: 28.6131, lon: 77.2115, alt: 215.9, radius: 2.0, x: 265, y: 110 },
  { id: 8, name: 'WP-08', lat: 28.6134, lon: 77.2098, alt: 215.3, radius: 3.0, x: 165, y: 175 }
];

const state = {
  inPortal: true,
  activeTab: 'cockpit',
  armed: false,
  estop: false,
  navMode: 'GUIDED',
  camMode: 'rgb',
  recording: false,
  metSeconds: 0,
  dashboardInit: false,
  telemetry: {
    speed: 1.15,
    current: 14.2,
    heading: 42,
    pitch: 1.4,
    roll: -0.8,
    wpIndex: 2,
    wpDist: 38,
    pathProgress: 2.35,
    latency: 22,
    sats: 15,
    cells: [4.11, 4.09, 4.12, 4.08, 4.10, 4.09],
    wheels: {
      fl: { rpm: 96,  current: 2.3, temp: 39 },
      ml: { rpm: 94,  current: 2.2, temp: 38 },
      rl: { rpm: 95,  current: 2.4, temp: 40 },
      fr: { rpm: 97,  current: 2.3, temp: 39 },
      mr: { rpm: 95,  current: 2.2, temp: 38 },
      rr: { rpm: 96,  current: 2.5, temp: 41 }
    }
  },
  cmdVel: { linear: 0, angular: 0 },
  logs: []
};

// ═══════════════════════════════════════════════════════════════
// PROCEDURAL 6-WHEEL ROCKER-BOGIE ROVER BUILDER
// ═══════════════════════════════════════════════════════════════
function createRoverModel() {
  const rover = new THREE.Group();

  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x2a3241, metalness: 0.65, roughness: 0.35 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x161c26, metalness: 0.75, roughness: 0.4 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111419, metalness: 0.15, roughness: 0.85 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.55, roughness: 0.3 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x122645, metalness: 0.8, roughness: 0.2 });
  const sensorMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.6, roughness: 0.25 });

  // Main chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 2.1), chassisMat);
  chassis.position.y = 0.68;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  rover.add(chassis);

  // Top deck / solar array
  const solar = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.05, 1.85), solarMat);
  solar.position.set(0, 0.92, -0.05);
  solar.castShadow = true;
  rover.add(solar);

  // Front stereo camera bar
  const camBar = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.22), darkMetalMat);
  camBar.position.set(0, 0.96, 1.02);
  camBar.castShadow = true;
  rover.add(camBar);

  // Camera lenses
  [-0.2, 0.2].forEach(x => {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16), sensorMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, 0.96, 1.14);
    rover.add(lens);
  });

  // LiDAR mast + dome
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 12), darkMetalMat);
  mast.position.set(0, 1.15, 0.55);
  mast.castShadow = true;
  rover.add(mast);

  const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 20), sensorMat);
  lidar.position.set(0, 1.4, 0.55);
  lidar.castShadow = true;
  rover.add(lidar);

  // Comms antenna
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.6, 8), darkMetalMat);
  antenna.position.set(-0.48, 1.22, -0.78);
  rover.add(antenna);

  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), hubMat);
  tip.position.set(-0.48, 1.54, -0.78);
  rover.add(tip);

  // Wheels & Rocker-Bogie arms (Left & Right)
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 24);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.24, 16);
  hubGeo.rotateZ(Math.PI / 2);

  const zPositions = [0.95, 0.0, -0.95];
  [-0.96, 0.96].forEach(sideX => {
    // Upper longitudinal rocker bar
    const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.95), darkMetalMat);
    rocker.position.set(sideX * 0.85, 0.52, 0);
    rocker.castShadow = true;
    rover.add(rocker);

    zPositions.forEach(z => {
      // Strut from chassis/rocker to wheel hub
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.08), darkMetalMat);
      strut.position.set(sideX * 0.9, 0.42, z);
      strut.castShadow = true;
      rover.add(strut);

      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.position.set(sideX, 0.3, z);
      tire.castShadow = true;
      tire.receiveShadow = true;
      rover.add(tire);

      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.position.set(sideX, 0.3, z);
      rover.add(hub);
    });
  });

  return rover;
}

// ═══════════════════════════════════════════════════════════════
// 1. SHOWCASE PORTAL (THREE.JS)
// ═══════════════════════════════════════════════════════════════
let showcaseScene, showcaseCamera, showcaseRenderer, showcaseControls, showcaseRover, dustPoints;
let showcaseRafId = null;
let portalTransitioning = false;

function initShowcasePortal() {
  const canvas = document.getElementById('showcase-canvas');
  if (!canvas) return;

  showcaseScene = new THREE.Scene();
  showcaseScene.background = new THREE.Color(0x090b10);
  showcaseScene.fog = new THREE.FogExp2(0x090b10, 0.035);

  showcaseCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  showcaseCamera.position.set(4.5, 2.7, 5.2);

  showcaseRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  showcaseRenderer.setSize(window.innerWidth, window.innerHeight);
  showcaseRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  showcaseRenderer.shadowMap.enabled = true;
  showcaseRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lighting
  const hemi = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 0.65);
  showcaseScene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.2);
  keyLight.position.set(5, 8, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  showcaseScene.add(keyLight);

  const rimLight = new THREE.PointLight(0x38bdf8, 1.4, 15);
  rimLight.position.set(-4, 3, -4);
  showcaseScene.add(rimLight);

  const warmFill = new THREE.PointLight(0xf59e0b, 0.9, 12);
  warmFill.position.set(3, 1.5, -3);
  showcaseScene.add(warmFill);

  // Circular Metric Landing Pad
  const padGeo = new THREE.CylinderGeometry(4.6, 4.8, 0.12, 64);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x151b26, metalness: 0.3, roughness: 0.75 });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.y = -0.06;
  pad.receiveShadow = true;
  showcaseScene.add(pad);

  [1.8, 3.1, 4.4].forEach((r, idx) => {
    const ringGeo = new THREE.RingGeometry(r - 0.025, r + 0.025, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: idx === 2 ? 0xf59e0b : 0x38bdf8,
      transparent: true,
      opacity: idx === 2 ? 0.55 : 0.28
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.005;
    showcaseScene.add(ring);
  });

  const grid = new THREE.GridHelper(18, 24, 0x1e293b, 0x111827);
  grid.position.y = -0.11;
  showcaseScene.add(grid);

  // Rover
  showcaseRover = createRoverModel();
  showcaseScene.add(showcaseRover);

  // Atmospheric Dust Particles
  const count = 450;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = Math.random() * 6 + 0.1;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 18;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.035, transparent: true, opacity: 0.5 });
  dustPoints = new THREE.Points(dustGeo, dustMat);
  showcaseScene.add(dustPoints);

  // Controls
  showcaseControls = new OrbitControls(showcaseCamera, canvas);
  showcaseControls.enableDamping = true;
  showcaseControls.dampingFactor = 0.05;
  showcaseControls.autoRotate = true;
  showcaseControls.autoRotateSpeed = 0.7;
  showcaseControls.minDistance = 2.8;
  showcaseControls.maxDistance = 14;
  showcaseControls.maxPolarAngle = Math.PI / 2 - 0.04;
  showcaseControls.target.set(0, 0.65, 0);

  // Raycaster click on rover
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownPos = { x: 0, y: 0 };

  canvas.addEventListener('pointerdown', e => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('pointerup', e => {
    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dist > 6 || portalTransitioning) return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, showcaseCamera);
    const hits = raycaster.intersectObjects(showcaseRover.children, true);
    if (hits.length > 0) enterMissionControl();
  });

  document.getElementById('enter-mission-btn')?.addEventListener('click', enterMissionControl);

  window.addEventListener('resize', () => {
    if (!state.inPortal || !showcaseRenderer) return;
    showcaseCamera.aspect = window.innerWidth / window.innerHeight;
    showcaseCamera.updateProjectionMatrix();
    showcaseRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  animateShowcase();
}

function animateShowcase() {
  if (!state.inPortal) return;
  showcaseRafId = requestAnimationFrame(animateShowcase);
  if (dustPoints) dustPoints.rotation.y += 0.0004;
  showcaseControls.update();
  showcaseRenderer.render(showcaseScene, showcaseCamera);
}

function enterMissionControl() {
  if (portalTransitioning) return;
  portalTransitioning = true;
  showcaseControls.autoRotate = false;

  const startPos = showcaseCamera.position.clone();
  const endPos = new THREE.Vector3(0.4, 1.35, 1.8);
  const startTime = performance.now();
  const duration = 750;

  function zoomStep(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    showcaseCamera.position.lerpVectors(startPos, endPos, ease);
    showcaseCamera.lookAt(0, 0.75, 0);
    showcaseRenderer.render(showcaseScene, showcaseCamera);

    if (t < 1) {
      requestAnimationFrame(zoomStep);
    } else {
      document.getElementById('showcase-portal').classList.add('portal-exit');
      document.getElementById('gcs-app').classList.remove('hidden');
      state.inPortal = false;
      cancelAnimationFrame(showcaseRafId);
      portalTransitioning = false;
      if (!state.dashboardInit) initDashboard();
    }
  }
  requestAnimationFrame(zoomStep);
}

function returnToShowcase() {
  state.inPortal = true;
  showcaseCamera.position.set(4.5, 2.7, 5.2);
  showcaseControls.autoRotate = true;
  document.getElementById('gcs-app').classList.add('hidden');
  document.getElementById('showcase-portal').classList.remove('portal-exit');
  showcaseRenderer.setSize(window.innerWidth, window.innerHeight);
  showcaseCamera.aspect = window.innerWidth / window.innerHeight;
  showcaseCamera.updateProjectionMatrix();
  animateShowcase();
}

// ═══════════════════════════════════════════════════════════════
// 2. DASHBOARD INITIALIZATION & NAVIGATION
// ═══════════════════════════════════════════════════════════════
function initDashboard() {
  state.dashboardInit = true;

  // Side nav tabs
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Header controls
  document.getElementById('showcase-return-btn')?.addEventListener('click', returnToShowcase);
  document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  });

  document.getElementById('nav-mode-select')?.addEventListener('change', e => {
    state.navMode = e.target.value;
    addLog('INFO', `/mavros/set_mode: Switched navigation mode to ${state.navMode}`);
  });

  // Modals
  initModals();

  // PFD, Map, Tactical Table, Camera, Digital Twin, Optics, Logs, Config, Keyboard
  initPFD();
  initMaps();
  initWaypointTable();
  initCameraControls();
  initKeyboardControls();
  initLogControls();
  initConfigHandlers();
  initDigitalTwin();

  // Seed initial logs
  addLog('INFO', '/netra_gcs: Ground Control Station initialized');
  addLog('INFO', '/mavros/state: Connected via UDP 5.8 GHz, mode=GUIDED');
  addLog('INFO', '/gps/fix: RTK Fixed, 15 satellites locked');

  // Loops
  setInterval(tickTelemetry, 500);
  setInterval(tickClocks, 1000);
  setInterval(tickSimulatedLogs, 1800);
  tickClocks();
  tickTelemetry();
  animateCanvases();
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tabId}`));

  if (tabId === 'twin') {
    resizeTwinCanvas();
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. MODALS (ARM & E-STOP)
// ═══════════════════════════════════════════════════════════════
function initModals() {
  const armModal = document.getElementById('arm-modal');
  const estopModal = document.getElementById('estop-modal');
  const armBtn = document.getElementById('arm-btn');

  armBtn?.addEventListener('click', () => {
    document.getElementById('arm-modal-title').textContent = state.armed ? 'Confirm DISARM' : 'Confirm ARM';
    document.getElementById('arm-modal-msg').textContent = state.armed
      ? 'Disarming will cut motor controller enable signals.'
      : 'Arming the rover enables motor output. Ensure area is clear.';
    document.getElementById('arm-confirm').textContent = state.armed ? 'CONFIRM DISARM' : 'CONFIRM ARM';
    armModal.classList.add('open');
  });

  document.getElementById('arm-cancel')?.addEventListener('click', () => armModal.classList.remove('open'));
  document.getElementById('arm-confirm')?.addEventListener('click', () => {
    state.armed = !state.armed;
    if (state.armed) state.estop = false;
    document.getElementById('top-header').classList.remove('estop-active');
    armBtn.textContent = state.armed ? 'ARMED' : 'DISARMED';
    armBtn.classList.toggle('armed', state.armed);
    armModal.classList.remove('open');
    addLog(state.armed ? 'WARN' : 'INFO', `/mavros/cmd/arming: Vehicle ${state.armed ? 'ARMED' : 'DISARMED'}`);
  });

  document.getElementById('estop-btn')?.addEventListener('click', () => estopModal.classList.add('open'));
  document.getElementById('estop-cancel')?.addEventListener('click', () => estopModal.classList.remove('open'));
  document.getElementById('estop-confirm')?.addEventListener('click', () => {
    state.estop = true;
    state.armed = false;
    state.telemetry.speed = 0;
    armBtn.textContent = 'DISARMED';
    armBtn.classList.remove('armed');
    document.getElementById('top-header').classList.add('estop-active');
    estopModal.classList.remove('open');
    addLog('ERROR', '/safety/estop: HARDWARE E-STOP TRIGGERED — ALL MOTORS HALTED');
  });
}

// ═══════════════════════════════════════════════════════════════
// 4. TELEMETRY SIMULATION & CLOCKS
// ═══════════════════════════════════════════════════════════════
function tickClocks() {
  state.metSeconds++;
  const h = String(Math.floor(state.metSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((state.metSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(state.metSeconds % 60).padStart(2, '0');
  const metEl = document.getElementById('met-value');
  if (metEl) metEl.textContent = `T+${h}:${m}:${s}`;

  const now = new Date();
  const utcEl = document.getElementById('utc-value');
  if (utcEl) utcEl.textContent = now.toISOString().substring(11, 19);
}

function tickTelemetry() {
  const t = state.telemetry;
  const nowSec = performance.now() / 1000;

  if (state.estop) {
    t.speed = 0;
    t.current = 1.1;
  } else {
    const targetSpeed = state.cmdVel.linear !== 0 ? Math.abs(state.cmdVel.linear) : 1.18 + Math.sin(nowSec * 0.7) * 0.25;
    t.speed = Math.max(0, +(targetSpeed + (Math.random() - 0.5) * 0.08).toFixed(2));
    t.current = +(4.0 + t.speed * 8.5 + (Math.random() - 0.5) * 0.9).toFixed(1);
    t.heading = (t.heading + (state.cmdVel.angular !== 0 ? state.cmdVel.angular * 4 : 0.7) + 360) % 360;
    t.pitch = +(Math.sin(nowSec * 0.6) * 3.4).toFixed(1);
    t.roll = +(Math.cos(nowSec * 0.5) * 2.3).toFixed(1);

    // Advance path progress
    t.pathProgress = (t.pathProgress + 0.03) % WAYPOINTS.length;
    t.wpIndex = (Math.floor(t.pathProgress) + 1) % WAYPOINTS.length;
    t.wpDist = Math.max(2, Math.round(110 * (1 - (t.pathProgress % 1))));
  }

  t.latency = Math.round(18 + Math.random() * 14);
  t.sats = Math.round(14 + Math.sin(nowSec * 0.1) * 2);

  // Header status
  document.getElementById('comms-latency').textContent = t.latency;
  document.getElementById('gnss-sats').textContent = t.sats;
  const packV = t.cells.reduce((a, b) => a + b, 0);
  document.getElementById('bus-voltage').textContent = packV.toFixed(1);

  // KPI strip
  document.getElementById('kpi-speed-val').textContent = t.speed.toFixed(2);
  document.getElementById('kpi-current-val').textContent = t.current.toFixed(1);
  document.getElementById('kpi-heading-val').textContent = `${String(Math.round(t.heading)).padStart(3, '0')}°`;
  document.getElementById('kpi-attitude-val').textContent = `P ${t.pitch >= 0 ? '+' : ''}${t.pitch.toFixed(1)} R ${t.roll >= 0 ? '+' : ''}${t.roll.toFixed(1)}`;
  const wpCard = document.getElementById('kpi-waypoint');
  if (wpCard) {
    wpCard.querySelector('#kpi-waypoint-val').textContent = WAYPOINTS[t.wpIndex].name;
    wpCard.querySelector('.kpi-unit').textContent = `${t.wpDist} m`;
  }

  // Wheels
  const baseRpm = Math.round(t.speed * 78);
  Object.keys(t.wheels).forEach(k => {
    const w = t.wheels[k];
    w.rpm = state.estop ? 0 : Math.max(0, Math.round(baseRpm + (Math.random() - 0.5) * 5));
    w.current = state.estop ? 0.0 : +(t.current / 6 + (Math.random() - 0.5) * 0.3).toFixed(1);
    w.temp = Math.round(37 + t.speed * 3 + (Math.random() - 0.5) * 1.5);
    const card = document.getElementById(`wheel-${k}`);
    if (card) {
      card.querySelector('[data-field="rpm"]').textContent = w.rpm;
      card.querySelector('[data-field="current"]').textContent = w.current.toFixed(1);
      card.querySelector('[data-field="temp"]').textContent = w.temp;
    }
  });

  // Power tab cells & distribution
  t.cells.forEach((v, i) => {
    const nv = Math.min(4.20, Math.max(3.30, +(v + (Math.random() - 0.502) * 0.015).toFixed(2)));
    t.cells[i] = nv;
    const cellEl = document.getElementById(`cell-${i + 1}`);
    if (cellEl) {
      const pct = Math.max(0, Math.min(100, ((nv - 3.0) / 1.2) * 100));
      const fill = cellEl.querySelector('.bar-fill');
      fill.style.height = `${pct}%`;
      fill.style.background = nv > 3.8 ? '#10b981' : nv > 3.5 ? '#f59e0b' : '#ef4444';
      cellEl.querySelector('.cell-value').textContent = `${nv.toFixed(2)} V`;
    }
  });

  const totalW = Math.round(packV * t.current);
  const shares = { motors: 0.60, compute: 0.15, sensors: 0.12, comms: 0.08, aux: 0.05 };
  Object.entries(shares).forEach(([k, ratio]) => {
    const bar = document.querySelector(`.power-bar-fill[data-subsys="${k}"]`);
    const txt = document.querySelector(`.power-pct[data-subsys="${k}"]`);
    if (bar) bar.style.width = `${Math.round(ratio * 100)}%`;
    if (txt) txt.textContent = `${Math.round(totalW * ratio)} W`;
  });

  updatePFD();
  updateMaps();
  updateWaypointTable();
}

// ═══════════════════════════════════════════════════════════════
// 5. PRIMARY FLIGHT DISPLAY (SVG)
// ═══════════════════════════════════════════════════════════════
function initPFD() {
  const svg = document.getElementById('pfd-svg');
  if (!svg) return;
  svg.innerHTML = `
    <defs>
      <clipPath id="pfd-clip"><circle cx="200" cy="200" r="145"/></clipPath>
    </defs>
    <circle cx="200" cy="200" r="148" fill="#0b0f17" stroke="#1f2937" stroke-width="2"/>
    <g clip-path="url(#pfd-clip)">
      <g id="pfd-horizon-group">
        <rect x="-150" y="-400" width="700" height="600" fill="#17385c"/>
        <rect x="-150" y="200" width="700" height="600" fill="#3a2819"/>
        <line x1="-150" y1="200" x2="550" y2="200" stroke="#e2e8f0" stroke-width="2"/>
        ${[-20, -10, 10, 20].map(deg => {
          const y = 200 - deg * 4;
          return `<line x1="155" y1="${y}" x2="245" y2="${y}" stroke="#e2e8f0" stroke-width="1.5"/>
                  <text x="142" y="${y + 4}" fill="#e2e8f0" font-size="10" font-family="JetBrains Mono" text-anchor="end">${deg}</text>`;
        }).join('')}
      </g>
    </g>
    <!-- Fixed Center Aircraft/Rover Symbol -->
    <path d="M165 200 L190 200 L200 209 L210 200 L235 200" fill="none" stroke="#f59e0b" stroke-width="3"/>
    <circle cx="200" cy="200" r="3" fill="#f59e0b"/>
    <!-- Speed & Heading Readout Boxes -->
    <rect x="14" y="182" width="58" height="36" rx="4" fill="#111620" stroke="#38bdf8" stroke-width="1"/>
    <text id="pfd-spd-txt" x="43" y="205" fill="#e2e8f0" font-size="13" font-family="JetBrains Mono" font-weight="700" text-anchor="middle">0.0</text>
    <rect x="328" y="182" width="58" height="36" rx="4" fill="#111620" stroke="#f59e0b" stroke-width="1"/>
    <text id="pfd-hdg-txt" x="357" y="205" fill="#e2e8f0" font-size="13" font-family="JetBrains Mono" font-weight="700" text-anchor="middle">000°</text>
  `;
}

function updatePFD() {
  const grp = document.getElementById('pfd-horizon-group');
  if (!grp) return;
  const { pitch, roll, speed, heading } = state.telemetry;
  grp.setAttribute('transform', `translate(0, ${pitch * 4}) rotate(${-roll}, 200, 200)`);
  const spdTxt = document.getElementById('pfd-spd-txt');
  const hdgTxt = document.getElementById('pfd-hdg-txt');
  if (spdTxt) spdTxt.textContent = speed.toFixed(1);
  if (hdgTxt) hdgTxt.textContent = `${String(Math.round(heading)).padStart(3, '0')}°`;
}

// ═══════════════════════════════════════════════════════════════
// 6. TACTICAL MAPS (COCKPIT & TACTICAL TAB)
// ═══════════════════════════════════════════════════════════════
function renderMapBase(svgId, width, height, scaleX, scaleY) {
  const svg = document.getElementById(svgId);
  if (!svg) return;

  let gridLines = '';
  for (let x = 50; x < width; x += 50) {
    gridLines += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#162032" stroke-width="1"/>`;
  }
  for (let y = 50; y < height; y += 50) {
    gridLines += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#162032" stroke-width="1"/>`;
  }

  const pts = WAYPOINTS.map(w => `${w.x * scaleX},${w.y * scaleY}`).join(' ');
  const wpCircles = WAYPOINTS.map(w => `
    <circle cx="${w.x * scaleX}" cy="${w.y * scaleY}" r="6" fill="#111620" stroke="#38bdf8" stroke-width="2"/>
    <text x="${w.x * scaleX + 10}" y="${w.y * scaleY + 4}" fill="#94a3b8" font-size="11" font-family="JetBrains Mono">${w.name}</text>
  `).join('');

  svg.innerHTML = `
    ${gridLines}
    <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) * 0.44}" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"/>
    <polyline points="${pts}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="5 4" opacity="0.8"/>
    <polyline id="${svgId}-trail" points="" fill="none" stroke="#10b981" stroke-width="2.5"/>
    ${wpCircles}
    <g id="${svgId}-rover">
      <polygon points="0,-10 7,8 0,4 -7,8" fill="#f59e0b" stroke="#090b10" stroke-width="1.2"/>
    </g>
  `;
}

function initMaps() {
  renderMapBase('map-svg', 500, 500, 1, 1);
  renderMapBase('tactical-map-svg', 700, 500, 1.4, 1);
}

function updateMaps() {
  const prog = state.telemetry.pathProgress;
  const idx = Math.floor(prog) % WAYPOINTS.length;
  const nextIdx = (idx + 1) % WAYPOINTS.length;
  const frac = prog - Math.floor(prog);

  const rx = WAYPOINTS[idx].x + (WAYPOINTS[nextIdx].x - WAYPOINTS[idx].x) * frac;
  const ry = WAYPOINTS[idx].y + (WAYPOINTS[nextIdx].y - WAYPOINTS[idx].y) * frac;

  [
    { id: 'map-svg', sx: 1, sy: 1 },
    { id: 'tactical-map-svg', sx: 1.4, sy: 1 }
  ].forEach(({ id, sx, sy }) => {
    const rover = document.getElementById(`${id}-rover`);
    const trail = document.getElementById(`${id}-trail`);
    if (rover) {
      rover.setAttribute('transform', `translate(${rx * sx}, ${ry * sy}) rotate(${state.telemetry.heading})`);
    }
    if (trail) {
      const trailPts = WAYPOINTS.slice(0, idx + 1).map(w => `${w.x * sx},${w.y * sy}`);
      trailPts.push(`${rx * sx},${ry * sy}`);
      trail.setAttribute('points', trailPts.join(' '));
    }
  });
}

function initWaypointTable() {
  updateWaypointTable();
}

function updateWaypointTable() {
  const tbody = document.querySelector('#waypoint-table tbody');
  if (!tbody) return;
  const activeIdx = state.telemetry.wpIndex;
  tbody.innerHTML = WAYPOINTS.map((w, i) => {
    const status = i < activeIdx ? 'Reached' : i === activeIdx ? 'Active' : 'Pending';
    const cls = i < activeIdx ? 'wp-reached' : i === activeIdx ? 'wp-active' : 'wp-pending';
    return `<tr>
      <td>${w.id}</td><td>${w.name}</td><td>${w.lat.toFixed(4)}</td><td>${w.lon.toFixed(4)}</td>
      <td>${w.alt.toFixed(1)}</td><td>${w.radius.toFixed(1)}</td>
      <td><span class="wp-badge ${cls}">${status}</span></td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// 7. SIMULATED CAMERA & OPTICS FEEDS
// ═══════════════════════════════════════════════════════════════
function initCameraControls() {
  document.querySelectorAll('.cam-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cam-mode').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.camMode = btn.dataset.mode;
    });
  });

  document.getElementById('snapshot-btn')?.addEventListener('click', () => {
    const canvas = document.getElementById('camera-canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `netra-snapshot-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    addLog('INFO', '/camera/front: Snapshot saved to disk');
  });

  const recBtn = document.getElementById('rec-btn');
  recBtn?.addEventListener('click', () => {
    state.recording = !state.recording;
    recBtn.classList.toggle('recording', state.recording);
    recBtn.textContent = state.recording ? '⏹ STOP REC' : '⏺ REC';
    addLog(state.recording ? 'WARN' : 'INFO', `/camera/recorder: ${state.recording ? 'Recording started' : 'Recording stopped'}`);
  });
}

function drawSimulatedFeed(canvas, mode, label) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
    canvas.width = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
  }
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const t = performance.now() / 1000;

  // Sky + Terrain gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (mode === 'thermal') {
    grad.addColorStop(0, '#1a0933');
    grad.addColorStop(0.5, '#5b1462');
    grad.addColorStop(1, '#d97706');
  } else if (mode === 'depth') {
    grad.addColorStop(0, '#041224');
    grad.addColorStop(0.5, '#0c3559');
    grad.addColorStop(1, '#38bdf8');
  } else if (mode === 'rear') {
    grad.addColorStop(0, '#111620');
    grad.addColorStop(0.5, '#1e293b');
    grad.addColorStop(1, '#0f172a');
  } else {
    grad.addColorStop(0, '#0f1e33');
    grad.addColorStop(0.48, '#1e293b');
    grad.addColorStop(0.5, '#2d241c');
    grad.addColorStop(1, '#1a1510');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Horizon grid perspective
  ctx.strokeStyle = mode === 'depth' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 1;
  const hy = h * 0.48;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * 18, hy);
    ctx.lineTo(w / 2 + i * 85, h);
    ctx.stroke();
  }

  // Target bounding box
  const bx = w * 0.45 + Math.sin(t * 0.8) * 18;
  const by = h * 0.42;
  const bw = 64;
  const bh = 48;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#f59e0b';
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillText('ROCK_04 0.94', bx, by - 4);

  // REC indicator
  if (state.recording && label === 'MAIN') {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(w - 46, 16, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('REC', w - 36, 19);
  }
}

function animateCanvases() {
  requestAnimationFrame(animateCanvases);
  if (state.inPortal) return;

  if (state.activeTab === 'cockpit') {
    drawSimulatedFeed(document.getElementById('camera-canvas'), state.camMode, 'MAIN');
  } else if (state.activeTab === 'optics') {
    drawSimulatedFeed(document.getElementById('optics-primary'), 'rgb', 'OPT');
    drawSimulatedFeed(document.getElementById('optics-rear'), 'rear', 'OPT');
    drawSimulatedFeed(document.getElementById('optics-thermal'), 'thermal', 'OPT');
    drawSimulatedFeed(document.getElementById('optics-depth'), 'depth', 'OPT');
  }
}

// ═══════════════════════════════════════════════════════════════
// 8. 3D MODEL (DIGITAL TWIN) TAB
// ═══════════════════════════════════════════════════════════════
let twinScene, twinCamera, twinRenderer, twinControls, twinRover, twinLidar, twinAxes;

function initDigitalTwin() {
  const canvas = document.getElementById('twin-canvas');
  if (!canvas) return;

  twinScene = new THREE.Scene();
  twinScene.background = new THREE.Color(0x090b10);

  twinCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  twinCamera.position.set(4.5, 3.5, 4.5);

  twinRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  twinRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  twinScene.add(new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 1.8);
  dir.position.set(4, 7, 5);
  twinScene.add(dir);

  const grid = new THREE.GridHelper(12, 24, 0x38bdf8, 0x1e293b);
  twinScene.add(grid);

  twinRover = createRoverModel();
  twinScene.add(twinRover);

  twinAxes = new THREE.AxesHelper(2.2);
  twinScene.add(twinAxes);

  const lidarGeo = new THREE.ConeGeometry(1.8, 3.5, 24, 1, true);
  lidarGeo.rotateX(-Math.PI / 2);
  const lidarMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.22, wireframe: true });
  twinLidar = new THREE.Mesh(lidarGeo, lidarMat);
  twinLidar.position.set(0, 1.4, 2.3);
  twinLidar.visible = false;
  twinRover.add(twinLidar);

  twinControls = new OrbitControls(twinCamera, canvas);
  twinControls.enableDamping = true;
  twinControls.target.set(0, 0.65, 0);

  // Presets
  const presets = {
    isometric: [4.5, 3.5, 4.5],
    top:       [0, 7.5, 0.01],
    front:     [0, 1.4, 5.5],
    side:      [5.5, 1.4, 0],
    chase:     [0, 2.4, -4.8]
  };
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const p = presets[btn.dataset.preset];
      if (p) {
        twinCamera.position.set(...p);
        twinControls.target.set(0, 0.65, 0);
      }
    });
  });

  // Toggles
  document.getElementById('toggle-wireframe')?.addEventListener('change', e => {
    twinRover.traverse(obj => {
      if (obj.isMesh && obj !== twinLidar) obj.material.wireframe = e.target.checked;
    });
  });
  document.getElementById('toggle-lidar')?.addEventListener('change', e => {
    twinLidar.visible = e.target.checked;
  });
  document.getElementById('toggle-axes')?.addEventListener('change', e => {
    twinAxes.visible = e.target.checked;
  });

  window.addEventListener('resize', resizeTwinCanvas);
  animateTwin();
}

function resizeTwinCanvas() {
  const container = document.getElementById('twin-canvas-container');
  if (!container || !twinRenderer || state.activeTab !== 'twin') return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w > 0 && h > 0) {
    twinCamera.aspect = w / h;
    twinCamera.updateProjectionMatrix();
    twinRenderer.setSize(w, h);
  }
}

function animateTwin() {
  requestAnimationFrame(animateTwin);
  if (state.inPortal || state.activeTab !== 'twin' || !twinRenderer) return;
  twinRover.rotation.x = THREE.MathUtils.degToRad(state.telemetry.pitch);
  twinRover.rotation.z = THREE.MathUtils.degToRad(-state.telemetry.roll);
  twinControls.update();
  twinRenderer.render(twinScene, twinCamera);
}

// ═══════════════════════════════════════════════════════════════
// 9. TELEMETRY CONSOLE & LOGS
// ═══════════════════════════════════════════════════════════════
function addLog(level, message) {
  const ts = new Date().toISOString().substring(11, 23);
  state.logs.push({ ts, level, message });
  if (state.logs.length > 250) state.logs.shift();
  renderLogs();
}

function renderLogs() {
  const consoleEl = document.getElementById('console-log');
  const fullEl = document.getElementById('full-log');
  const cFilter = (document.getElementById('console-filter')?.value || '').toLowerCase();
  const fFilter = (document.getElementById('logs-filter')?.value || '').toLowerCase();
  const fLevel = document.getElementById('logs-level-select')?.value || 'ALL';

  const makeHtml = entries => entries.map(l =>
    `<div class="log-entry"><span class="log-ts">${l.ts}</span><span class="log-lvl log-lvl-${l.level}">[${l.level}]</span><span class="log-msg">${l.message}</span></div>`
  ).join('');

  if (consoleEl) {
    const filtered = state.logs.filter(l => !cFilter || l.message.toLowerCase().includes(cFilter) || l.level.toLowerCase().includes(cFilter));
    consoleEl.innerHTML = makeHtml(filtered.slice(-80));
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  if (fullEl) {
    const filtered = state.logs.filter(l =>
      (fLevel === 'ALL' || l.level === fLevel) &&
      (!fFilter || l.message.toLowerCase().includes(fFilter))
    );
    fullEl.innerHTML = makeHtml(filtered);
    fullEl.scrollTop = fullEl.scrollHeight;
  }
}

function tickSimulatedLogs() {
  if (state.inPortal) return;
  const t = state.telemetry;
  const samples = [
    ['INFO', `/odom: vx=${t.speed.toFixed(2)} m/s, hdg=${Math.round(t.heading)}°, p=${t.pitch}°, r=${t.roll}°`],
    ['INFO', `/gps/fix: lat=28.6139, lon=77.2090, sats=${t.sats}, rtk=FIXED`],
    ['INFO', `/mavros/battery: pack=${t.cells.reduce((a, b) => a + b, 0).toFixed(2)}V, draw=${t.current}A`],
    ['WARN', `/nav2/costmap: Obstacle detected at 4.2m bearing +12°`]
  ];
  const pick = samples[Math.floor(Math.random() * samples.length)];
  addLog(pick[0], pick[1]);
}

function initLogControls() {
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state.logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netra-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  document.getElementById('console-filter')?.addEventListener('input', renderLogs);
  document.getElementById('logs-filter')?.addEventListener('input', renderLogs);
  document.getElementById('logs-level-select')?.addEventListener('change', renderLogs);
  document.getElementById('console-clear')?.addEventListener('click', () => { state.logs = []; renderLogs(); });
  document.getElementById('logs-clear')?.addEventListener('click', () => { state.logs = []; renderLogs(); });
  document.getElementById('console-export')?.addEventListener('click', exportJson);
  document.getElementById('logs-export')?.addEventListener('click', exportJson);
}

// ═══════════════════════════════════════════════════════════════
// 10. KEYBOARD & D-PAD VELOCITY CONTROLS (/cmd_vel)
// ═══════════════════════════════════════════════════════════════
function triggerCmdVel(dir) {
  document.querySelectorAll('.dpad-btn').forEach(b => b.classList.toggle('active', b.dataset.direction === dir));
  if (dir === 'forward')       state.cmdVel = { linear: 1.5,  angular: 0 };
  else if (dir === 'backward') state.cmdVel = { linear: -0.8, angular: 0 };
  else if (dir === 'left')     state.cmdVel = { linear: 0.6,  angular: -1.2 };
  else if (dir === 'right')    state.cmdVel = { linear: 0.6,  angular: 1.2 };
  else                         state.cmdVel = { linear: 0,    angular: 0 };

  addLog('INFO', `/cmd_vel: linear.x=${state.cmdVel.linear.toFixed(2)}, angular.z=${state.cmdVel.angular.toFixed(2)}`);
  setTimeout(() => document.querySelectorAll('.dpad-btn').forEach(b => b.classList.remove('active')), 200);
}

function initKeyboardControls() {
  document.querySelectorAll('.dpad-btn').forEach(btn => {
    btn.addEventListener('click', () => triggerCmdVel(btn.dataset.direction));
  });

  window.addEventListener('keydown', e => {
    if (state.inPortal || document.activeElement.tagName === 'INPUT') return;
    const map = {
      ArrowUp: 'forward', KeyW: 'forward',
      ArrowDown: 'backward', KeyS: 'backward',
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      Space: 'stop'
    };
    if (map[e.code]) {
      e.preventDefault();
      triggerCmdVel(map[e.code]);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// 11. CONFIG HANDLERS
// ═══════════════════════════════════════════════════════════════
function initConfigHandlers() {
  document.getElementById('apply-pid')?.addEventListener('click', () => {
    addLog('INFO', '/param/set: Updated PID controller gains');
  });
  document.getElementById('apply-safety')?.addEventListener('click', () => {
    addLog('INFO', '/param/set: Updated geofence & failsafe limits');
  });
}

// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', initShowcasePortal);

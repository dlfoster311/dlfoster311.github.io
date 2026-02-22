'use strict';

// ── Config (persisted in localStorage) ──────────────────────────────────────

const STORAGE_KEY = 'cam_dashboard_config';

const DEFAULT_CONFIG = {
  host: 'localhost:1984',
  cameras: [],
};

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw)) : Object.assign({}, DEFAULT_CONFIG);
  } catch {
    return Object.assign({}, DEFAULT_CONFIG);
  }
}

function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

let config = loadConfig();

// ── Active WebRTC connections  { [cameraIndex]: RTCPeerConnection } ──────────

const connections = {};

// ── WebRTC via go2rtc ────────────────────────────────────────────────────────
//
//  go2rtc REST WebRTC API:
//    POST http://{host}/api/webrtc?src={streamName}
//    Body: SDP offer (plain text)
//    Response: SDP answer (plain text)
//
//  go2rtc uses "ICE Complete" mode, so we must wait for all local ICE
//  candidates to be gathered before POSTing the offer.

async function waitForIceGathering(pc, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    const timer = setTimeout(resolve, timeoutMs);
    function handler() {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', handler);
        resolve();
      }
    }
    pc.addEventListener('icegatheringstatechange', handler);
  });
}

async function connectCamera(index) {
  const cam = config.cameras[index];
  if (!cam) return;

  // Clean up any prior connection for this slot
  disconnectCamera(index, /* silent */ true);

  const tile = document.getElementById('tile-' + index);
  if (!tile) return;

  setTileStatus(tile, 'connecting', 'Connecting\u2026');

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });
  connections[index] = pc;

  // Display the stream once tracks arrive
  pc.addEventListener('track', (e) => {
    if (!e.streams[0]) return;
    const video = tile.querySelector('video');
    const placeholder = tile.querySelector('.tile-placeholder');
    video.srcObject = e.streams[0];
    video.play().catch(() => {});
    if (placeholder) placeholder.style.display = 'none';
    setTileStatus(tile, 'live', '\u25cf LIVE');
    updateConnectBtn(tile, index, true);
    updateGlobalStatus();
  });

  // Handle unexpected disconnection
  pc.addEventListener('iceconnectionstatechange', () => {
    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
      onCameraLost(index, tile, 'Connection lost');
    }
  });

  // Receive-only transceivers (Wyze cams transmit video + audio)
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    const protocol = location.protocol === 'https:' ? 'https:' : 'http:';
    const url = protocol + '//' + config.host + '/api/webrtc?src=' + encodeURIComponent(cam.stream);

    const resp = await fetch(url, {
      method: 'POST',
      body: pc.localDescription.sdp,
    });

    if (!resp.ok) {
      throw new Error('go2rtc responded with HTTP ' + resp.status + '. Check that the stream name matches your go2rtc config.');
    }

    const answerSdp = await resp.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

  } catch (err) {
    console.error('[Camera ' + index + '] connect error:', err);
    pc.close();
    delete connections[index];
    onCameraLost(index, tile, err.message);
  }
}

function disconnectCamera(index, silent) {
  const pc = connections[index];
  if (pc) {
    pc.close();
    delete connections[index];
  }
  if (!silent) {
    const tile = document.getElementById('tile-' + index);
    if (tile) {
      const video = tile.querySelector('video');
      const placeholder = tile.querySelector('.tile-placeholder');
      if (video) video.srcObject = null;
      if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.querySelector('p').textContent = 'Not connected';
      }
      setTileStatus(tile, 'idle', 'Disconnected');
      updateConnectBtn(tile, index, false);
    }
    updateGlobalStatus();
  }
}

function onCameraLost(index, tile, message) {
  delete connections[index];
  const video = tile && tile.querySelector('video');
  const placeholder = tile && tile.querySelector('.tile-placeholder');
  if (video) video.srcObject = null;
  if (placeholder) {
    placeholder.style.display = 'flex';
    placeholder.querySelector('p').textContent = message || 'Connection lost';
  }
  if (tile) {
    setTileStatus(tile, 'error', '\u26a0 Error');
    updateConnectBtn(tile, index, false);
  }
  updateGlobalStatus();
}

// ── Status helpers ───────────────────────────────────────────────────────────

function setTileStatus(tile, state, text) {
  const el = tile.querySelector('.tile-status');
  if (!el) return;
  el.className = 'tile-status ' + state;
  el.textContent = text;
}

function updateConnectBtn(tile, index, isConnected) {
  const btn = tile.querySelector('[data-action="toggle"]');
  if (!btn) return;
  btn.title = isConnected ? 'Disconnect' : 'Connect';
  btn.textContent = isConnected ? '\u23f9' : '\u25b6';
}

function updateGlobalStatus() {
  const el = document.getElementById('globalStatus');
  const total = config.cameras.length;
  const live = Object.keys(connections).length;
  if (total === 0) {
    el.className = 'connection-status off';
    el.textContent = '\u25cf No cameras';
  } else if (live === 0) {
    el.className = 'connection-status off';
    el.textContent = '\u25cf Disconnected';
  } else if (live < total) {
    el.className = 'connection-status partial';
    el.textContent = '\u25d1 ' + live + '/' + total + ' connected';
  } else {
    el.className = 'connection-status live';
    el.textContent = '\u25cf ' + live + '/' + total + ' live';
  }
}

// ── Grid rendering ───────────────────────────────────────────────────────────

let currentLayout = 1;

function renderGrid() {
  const grid = document.getElementById('cameraGrid');
  grid.innerHTML = '';
  grid.className = 'camera-grid layout-' + currentLayout;

  if (config.cameras.length === 0) {
    const addTile = document.createElement('div');
    addTile.className = 'add-tile';
    addTile.innerHTML = '<div class="ph-icon">\uD83D\uDCF7</div><p>Add a camera to get started</p>';
    addTile.addEventListener('click', openSettings);
    grid.appendChild(addTile);
  } else {
    config.cameras.forEach((cam, i) => grid.appendChild(buildTile(cam, i)));
  }
  updateGlobalStatus();
}

function buildTile(cam, index) {
  const tile = document.createElement('div');
  tile.className = 'camera-tile';
  tile.id = 'tile-' + index;

  tile.innerHTML =
    '<div class="tile-header">' +
      '<span class="tile-name">' + escHtml(cam.name) + '</span>' +
      '<div class="tile-controls">' +
        '<span class="tile-status idle">Disconnected</span>' +
        '<button class="btn btn-icon" data-action="toggle"   data-index="' + index + '" title="Connect">\u25b6</button>' +
        '<button class="btn btn-icon" data-action="mute"     data-index="' + index + '" title="Mute">\uD83D\uDD07</button>' +
        '<button class="btn btn-icon" data-action="fullscreen" data-index="' + index + '" title="Fullscreen">\u26f6</button>' +
      '</div>' +
    '</div>' +
    '<div class="tile-video-wrap">' +
      '<video muted playsinline></video>' +
      '<div class="tile-placeholder">' +
        '<div class="ph-icon">\uD83D\uDCF7</div>' +
        '<p>Not connected</p>' +
      '</div>' +
    '</div>';

  tile.querySelector('[data-action="toggle"]').addEventListener('click', function () {
    const idx = parseInt(this.dataset.index, 10);
    if (connections[idx]) {
      disconnectCamera(idx);
    } else {
      connectCamera(idx);
    }
  });

  tile.querySelector('[data-action="mute"]').addEventListener('click', function () {
    const video = tile.querySelector('video');
    video.muted = !video.muted;
    this.textContent = video.muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
    this.title = video.muted ? 'Unmute' : 'Mute';
  });

  tile.querySelector('[data-action="fullscreen"]').addEventListener('click', function () {
    const wrap = tile.querySelector('.tile-video-wrap');
    if (wrap.requestFullscreen)       wrap.requestFullscreen();
    else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
  });

  return tile;
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ── Settings modal ───────────────────────────────────────────────────────────

function openSettings() {
  document.getElementById('go2rtcHost').value = config.host;
  rebuildCameraRows();
  document.getElementById('settingsModal').classList.add('open');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}

function rebuildCameraRows() {
  const list = document.getElementById('cameraList');
  list.innerHTML = '';

  // Column hints
  const hints = document.createElement('div');
  hints.className = 'cam-row-hint';
  hints.innerHTML = '<span>Stream ID (from go2rtc.yaml)</span><span class="cam-label">Display name</span><span style="width:34px"></span>';
  list.appendChild(hints);

  config.cameras.forEach(function (cam, i) {
    list.appendChild(buildCameraRow(cam.stream, cam.name, i));
  });
}

function buildCameraRow(stream, name, index) {
  const row = document.createElement('div');
  row.className = 'cam-row';
  row.dataset.index = index;
  row.innerHTML =
    '<input type="text" placeholder="front_door" data-field="stream" value="' + escHtml(stream) + '">' +
    '<input type="text" placeholder="Front Door"  data-field="name"   value="' + escHtml(name)   + '" class="cam-label">' +
    '<button class="btn btn-icon" data-action="remove" title="Remove row">&#10005;</button>';

  row.querySelector('[data-action="remove"]').addEventListener('click', function () {
    row.remove();
  });

  return row;
}

function saveSettings() {
  config.host = (document.getElementById('go2rtcHost').value.trim()) || 'localhost:1984';

  const rows = document.querySelectorAll('#cameraList .cam-row');
  const cameras = [];
  rows.forEach(function (row) {
    const stream = row.querySelector('[data-field="stream"]').value.trim();
    const name   = row.querySelector('[data-field="name"]').value.trim();
    if (stream || name) {
      cameras.push({ stream: stream || name, name: name || stream });
    }
  });
  config.cameras = cameras;
  saveConfig(config);
  closeSettings();

  // Disconnect everything and re-render
  Object.keys(connections).forEach(function (i) { disconnectCamera(parseInt(i, 10), true); });
  renderGrid();
}

// ── Setup guide modal ────────────────────────────────────────────────────────

function openSetup() {
  document.getElementById('setupModal').classList.add('open');
}

function closeSetup() {
  document.getElementById('setupModal').classList.remove('open');
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {

  renderGrid();

  // Show setup guide on first visit (no cameras configured)
  if (config.cameras.length === 0) {
    openSetup();
  }

  // Layout buttons
  document.querySelectorAll('.layout-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.layout-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentLayout = parseInt(btn.dataset.layout, 10);
      document.getElementById('cameraGrid').className = 'camera-grid layout-' + currentLayout;
    });
  });

  // Connect / disconnect all
  document.getElementById('btnConnectAll').addEventListener('click', function () {
    config.cameras.forEach(function (_, i) { connectCamera(i); });
  });

  document.getElementById('btnDisconnectAll').addEventListener('click', function () {
    config.cameras.forEach(function (_, i) { disconnectCamera(i); });
  });

  // Settings modal
  document.getElementById('btnSettings').addEventListener('click', openSettings);
  document.getElementById('btnCloseSettings').addEventListener('click', closeSettings);
  document.getElementById('btnAddCamera').addEventListener('click', function () {
    document.getElementById('cameraList').appendChild(buildCameraRow('', '', Date.now()));
  });
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
  document.getElementById('settingsModal').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) closeSettings();
  });

  // Setup modal
  document.getElementById('btnSetup').addEventListener('click', openSetup);
  document.getElementById('btnCloseSetup').addEventListener('click', closeSetup);
  document.getElementById('setupModal').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) closeSetup();
  });

  // Keyboard: Escape closes open modals
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeSettings();
    closeSetup();
  });
});

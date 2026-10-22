'use strict';
/* WyPhoto 小白P图 — 全部本地处理，无后端、无 API 调用 */
const $ = s => document.querySelector(s);
const canvas = $('#canvas'), ctx = canvas.getContext('2d');
const overlay = $('#overlay'), octx = overlay.getContext('2d');
let maskCanvas = document.createElement('canvas'), mctx = maskCanvas.getContext('2d', { willReadFrequently: true });
let hasImage = false, baseName = 'photo', pendingTool = 'cutout';
let undoStack = [], redoStack = [], mosaicOn = false, erasing = false, cutting = false;

function setStatus(t) { $('#status').textContent = t || ''; }
function syncUndoBtns() { $('#btnUndo').disabled = !undoStack.length; $('#btnRedo').disabled = !redoStack.length; }
function snapshot() { const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; c.getContext('2d').drawImage(canvas, 0, 0); return c; }
function pushHistory() { if (!hasImage) return; undoStack.push(snapshot()); if (undoStack.length > 20) undoStack.shift(); redoStack = []; syncUndoBtns(); }
function restore(c) { canvas.width = c.width; canvas.height = c.height; ctx.drawImage(c, 0, 0); afterChange(); }
$('#btnUndo').onclick = () => { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); syncUndoBtns(); setStatus('已撤销'); };
$('#btnRedo').onclick = () => { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); syncUndoBtns(); setStatus('已重做'); };

function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
let expTimer = null;
function updateExportInfo() {
  if (!hasImage) return;
  clearTimeout(expTimer);
  expTimer = setTimeout(() => {
    canvas.toBlob(b => { if (b) $('#expInfo').textContent = `当前尺寸 ${canvas.width}×${canvas.height}，按现在设置导出约 ${fmtSize(b.size)}`; }, $('#expFormat').value, $('#expQuality').value / 100);
  }, 250);
}
function afterChange() {
  $('#imgInfo').textContent = hasImage ? `${baseName} · ${canvas.width}×${canvas.height}` : '未加载图片';
  if (erasing) syncOverlay(); else overlay.classList.add('hidden');
  updateExportInfo();
}

/* ---------- 打开图片 ---------- */
const fileInput = $('#fileInput');
function pickImage(tool) { if (tool) pendingTool = tool; fileInput.click(); }
$('#btnPick').onclick = () => pickImage();
$('#btnOpenTop').onclick = () => pickImage(hasImage ? undefined : pendingTool);
fileInput.onchange = () => { if (fileInput.files[0]) loadImageFile(fileInput.files[0]); fileInput.value = ''; };
document.querySelectorAll('.card').forEach(c => c.onclick = () => { pendingTool = c.dataset.tool; if (hasImage) { enterEditor(); switchTab(pendingTool); } else pickImage(); });
const dz = $('#dropZone');
['dragover', 'dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.toggle('drag', ev === 'dragover'); if (ev === 'drop' && e.dataTransfer.files[0]) loadImageFile(e.dataTransfer.files[0]); }));
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());
window.addEventListener('paste', e => { const f = [...(e.clipboardData || {}).files || []][0]; if (f) loadImageFile(f); });

function enterEditor() { $('#homeView').classList.add('hidden'); $('#editorView').classList.remove('hidden'); }
function loadImageFile(file) {
  if (!file.type || !file.type.startsWith('image/')) { alert('这个文件不是图片哦'); return; }
  baseName = (file.name || 'photo').replace(/\.[^.]+$/, '');
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); drawLoadedImage(img); };
  img.onerror = () => { URL.revokeObjectURL(url); alert('图片打开失败，换一张试试'); };
  img.src = url;
}
function drawLoadedImage(img) {
  const MAX = 4096;
  let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const scale = Math.min(1, MAX / Math.max(w, h));
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  hasImage = true; undoStack = []; redoStack = []; syncUndoBtns();
  enterEditor(); switchTab(pendingTool || 'cutout'); afterChange();
  setStatus(scale < 1 ? '图片太大，已自动缩小到 4096 以内处理' : '图片已打开，开始P图吧');
}
$('#btnBackHome').onclick = () => { $('#editorView').classList.add('hidden'); $('#homeView').classList.remove('hidden'); };
$('#btnSample').onclick = () => {
  canvas.width = 900; canvas.height = 620;
  const g = ctx.createLinearGradient(0, 0, 0, 620); g.addColorStop(0, '#8ec9ee'); g.addColorStop(.68, '#dff3ff'); g.addColorStop(.681, '#7ec850'); g.addColorStop(1, '#5da33e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 900, 620);
  ctx.fillStyle = '#ffd93b'; ctx.beginPath(); ctx.arc(770, 105, 58, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(120, 300, 200, 140); ctx.fillStyle = '#e2543e'; ctx.beginPath(); ctx.moveTo(100, 300); ctx.lineTo(220, 225); ctx.lineTo(340, 300); ctx.fill();
  ctx.fillStyle = '#7a4a21'; ctx.fillRect(195, 360, 50, 80);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(560, 330, 24, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(560, 354); ctx.lineTo(560, 420); ctx.moveTo(560, 375); ctx.lineTo(520, 405); ctx.moveTo(560, 375); ctx.lineTo(605, 350); ctx.moveTo(560, 420); ctx.lineTo(530, 480); ctx.moveTo(560, 420); ctx.lineTo(592, 480); ctx.stroke();
  ctx.font = '700 44px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText('示例水印', 320, 90);
  ctx.font = '700 30px sans-serif'; ctx.fillStyle = '#123'; ctx.fillText('示例图：有房子、路人、水印字，都可以试着修掉', 40, 570);
  baseName = '示例图'; hasImage = true; undoStack = []; redoStack = []; syncUndoBtns();
  enterEditor(); switchTab(pendingTool || 'cutout'); afterChange(); setStatus('示例图已生成，随便试，弄坏了点撤销就行');
};

/* ---------- 页签 ---------- */
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + name));
  erasing = (name === 'eraser' && hasImage);
  if (erasing) { setupMask(); syncOverlay(); } else overlay.classList.add('hidden');
  if (name !== 'mosaic' && mosaicOn) toggleMosaic(false);
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => switchTab(t.dataset.tab));

/* ---------- 通用变换 ---------- */
function replaceCanvas(nc) { pushHistory(); canvas.width = nc.width; canvas.height = nc.height; ctx.drawImage(nc, 0, 0); afterChange(); }
function transformCanvas(draw, nw, nh) { const nc = document.createElement('canvas'); nc.width = nw; nc.height = nh; draw(nc.getContext('2d'), nw, nh); replaceCanvas(nc); }
function applyFilterStr(f) { if (!hasImage) return; transformCanvas(c => { c.filter = f; c.drawImage(canvas, 0, 0); }, canvas.width, canvas.height); setStatus('已应用，可点撤销反悔'); }

/* 美化 */
$('#btnAutoBeauty').onclick = () => applyFilterStr('brightness(1.07) contrast(1.08) saturate(1.22)');
document.querySelectorAll('#filterPresets .chip').forEach(b => b.onclick = () => applyFilterStr(b.dataset.filter));
document.querySelectorAll('.slider-row input[type=range]').forEach(r => { const span = r.parentElement.querySelector('span'); if (span) r.addEventListener('input', () => span.textContent = r.value); });
$('#btnAdjApply').onclick = () => applyFilterStr(`brightness(${$('#adjBright').value / 100}) contrast(${$('#adjContrast').value / 100}) saturate(${$('#adjSat').value / 100})`);

/* 裁剪 / 旋转 / 尺寸 */
document.querySelectorAll('.ratio').forEach(b => b.onclick = () => {
  if (!hasImage) return; const r = parseFloat(b.dataset.r); let w = canvas.width, h = w / r;
  if (h > canvas.height) { h = canvas.height; w = h * r; }
  const x = (canvas.width - w) / 2, y = (canvas.height - h) / 2;
  transformCanvas(c => c.drawImage(canvas, x, y, w, h, 0, 0, w, h), Math.round(w), Math.round(h)); setStatus('已按比例居中裁剪');
});
$('#btnRotL').onclick = () => hasImage && transformCanvas((c, w, h) => { c.translate(w / 2, h / 2); c.rotate(-Math.PI / 2); c.drawImage(canvas, -canvas.width / 2, -canvas.height / 2); }, canvas.height, canvas.width);
$('#btnRotR').onclick = () => hasImage && transformCanvas((c, w, h) => { c.translate(w / 2, h / 2); c.rotate(Math.PI / 2); c.drawImage(canvas, -canvas.width / 2, -canvas.height / 2); }, canvas.height, canvas.width);
$('#btnFlipH').onclick = () => hasImage && transformCanvas(c => { c.translate(canvas.width, 0); c.scale(-1, 1); c.drawImage(canvas, 0, 0); }, canvas.width, canvas.height);
$('#btnFlipV').onclick = () => hasImage && transformCanvas(c => { c.translate(0, canvas.height); c.scale(1, -1); c.drawImage(canvas, 0, 0); }, canvas.width, canvas.height);
$('#btnResize').onclick = () => {
  const nw = parseInt($('#resizeW').value, 10);
  if (!hasImage || !nw || nw < 16) { alert('先输入一个新宽度（像素）'); return; }
  const nh = Math.round(canvas.height * nw / canvas.width);
  transformCanvas(c => c.drawImage(canvas, 0, 0, nw, nh), nw, nh); setStatus(`已缩放到 ${nw}×${nh}`);
};

/* ---------- 文字 / 水印 ---------- */
function drawText(text, watermark) {
  if (!hasImage || !text) return;
  pushHistory();
  const size = watermark ? Math.max(24, Math.round(canvas.width / 16)) : parseInt($('#textSize').value, 10);
  ctx.save();
  ctx.font = `700 ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.fillStyle = watermark ? 'rgba(255,255,255,0.5)' : $('#textColor').value;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = Math.max(2, size / 9);
  const pos = watermark ? 'br' : $('#textPos').value;
  let x, y; ctx.textAlign = 'center';
  if (pos === 'bottom') { x = canvas.width / 2; y = canvas.height - size * .7; }
  else if (pos === 'top') { x = canvas.width / 2; y = size * 1.3; }
  else if (pos === 'center') { x = canvas.width / 2; y = canvas.height / 2; }
  else { ctx.textAlign = 'right'; x = canvas.width - size * .5; y = canvas.height - size * .6; }
  if (!watermark) ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore(); afterChange(); setStatus(watermark ? '水印已加上' : '文字已加上');
}
$('#btnAddText').onclick = () => { const t = $('#textInput').value.trim(); if (!t) { alert('先输入文字'); return; } drawText(t, false); };
$('#btnWatermark').onclick = () => { const t = $('#textInput').value.trim(); if (!t) { alert('先在上面输入水印文字'); return; } drawText(t, true); };

/* ---------- 马赛克 ---------- */
const mosaicBtn = $('#btnMosaicToggle');
function toggleMosaic(force) {
  mosaicOn = typeof force === 'boolean' ? force : !mosaicOn;
  mosaicBtn.textContent = mosaicOn ? '✅ 完成打码' : '开始打码';
  canvas.style.touchAction = mosaicOn ? 'none' : '';
  canvas.style.cursor = mosaicOn ? 'crosshair' : '';
}
mosaicBtn.onclick = () => hasImage && toggleMosaic();
function canvasPos(e, el) { const r = el.getBoundingClientRect(); return { x: (e.clientX - r.left) * el.width / r.width, y: (e.clientY - r.top) * el.height / r.height }; }
function pixelate(x, y, size) {
  const block = Math.max(6, Math.round(size / 6));
  const x0 = Math.max(0, Math.round(x - size / 2)), y0 = Math.max(0, Math.round(y - size / 2));
  const w = Math.min(size, canvas.width - x0), h = Math.min(size, canvas.height - y0);
  if (w <= 0 || h <= 0) return;
  const sw = Math.max(1, Math.round(w / block)), sh = Math.max(1, Math.round(h / block));
  const tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh;
  tmp.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, sw, sh);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, 0, 0, sw, sh, x0, y0, w, h); ctx.restore();
}
let mosaicDrawing = false;
canvas.addEventListener('pointerdown', e => { if (!mosaicOn) return; pushHistory(); mosaicDrawing = true; const p = canvasPos(e, canvas); pixelate(p.x, p.y, +$('#mosaicSize').value); });
canvas.addEventListener('pointermove', e => { if (!mosaicOn || !mosaicDrawing) return; const p = canvasPos(e, canvas); pixelate(p.x, p.y, +$('#mosaicSize').value); });
window.addEventListener('pointerup', () => { if (mosaicDrawing) { mosaicDrawing = false; afterChange(); } });

/* ---------- 抠图（本地模型 @imgly/background-removal） ---------- */
function blobToImage(blob) { return new Promise((res, rej) => { const u = URL.createObjectURL(blob); const i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = rej; i.src = u; }); }
$('#btnCutout').onclick = async () => {
  if (!hasImage || cutting) return; cutting = true;
  const box = $('#cutoutProgress'), bar = box.querySelector('.bar'), txt = box.querySelector('.txt');
  box.classList.remove('hidden'); bar.style.width = '5%'; txt.textContent = '正在加载抠图模型（第一次约40MB）…';
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm');
    const src = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const out = await mod.removeBackground(src, { progress: (key, cur, tot) => { if (tot > 0) { const pct = Math.round(cur / tot * 100); bar.style.width = pct + '%'; txt.textContent = `处理中 ${key} ${pct}%`; } } });
    const img = await blobToImage(out);
    pushHistory();
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0);
    afterChange(); setStatus('抠图完成！可以在下面换白底/蓝底/红底，或做证件照');
  } catch (err) {
    console.error(err);
    setStatus('抠图失败：模型没下载下来或处理出错。模型在国外CDN，网络不好时会失败，换个网络或稍后重试。');
  } finally { box.classList.add('hidden'); cutting = false; }
};
function applyBg(kind, value) {
  if (!hasImage) return; pushHistory();
  const nc = document.createElement('canvas'); nc.width = canvas.width; nc.height = canvas.height;
  const c = nc.getContext('2d');
  if (kind === 'color') { c.fillStyle = value; c.fillRect(0, 0, nc.width, nc.height); }
  c.drawImage(canvas, 0, 0);
  canvas.width = nc.width; canvas.height = nc.height; ctx.drawImage(nc, 0, 0);
  afterChange(); setStatus(kind === 'transparent' ? '已是透明背景（导出请选 PNG）' : '背景已换好');
}
document.querySelectorAll('.bg-opt').forEach(b => b.onclick = () => { const v = b.dataset.bg; v === 'transparent' ? applyBg('transparent') : applyBg('color', v); });
$('#bgColor').addEventListener('change', e => applyBg('color', e.target.value));
$('#btnBgImage').onclick = () => $('#bgFileInput').click();
$('#bgFileInput').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f || !hasImage) return;
  const bg = await blobToImage(f); pushHistory();
  const nc = document.createElement('canvas'); nc.width = canvas.width; nc.height = canvas.height;
  const c = nc.getContext('2d'); const s = Math.max(nc.width / bg.naturalWidth, nc.height / bg.naturalHeight);
  c.drawImage(bg, (nc.width - bg.naturalWidth * s) / 2, (nc.height - bg.naturalHeight * s) / 2, bg.naturalWidth * s, bg.naturalHeight * s);
  c.drawImage(canvas, 0, 0);
  ctx.drawImage(nc, 0, 0); afterChange(); setStatus('已换成图片背景（前景需先抠图才好看）');
};
document.querySelectorAll('.id-photo').forEach(b => b.onclick = () => {
  if (!hasImage) return; const W = +b.dataset.w, H = +b.dataset.h, r = W / H;
  let w = canvas.width, h = w / r; if (h > canvas.height) { h = canvas.height; w = h * r; }
  const x = (canvas.width - w) / 2, y = (canvas.height - h) / 2;
  transformCanvas(c => c.drawImage(canvas, x, y, w, h, 0, 0, W, H), W, H); setStatus(`证件照完成：${W}×${H}`);
});

/* ---------- 消除笔（本地 OpenCV inpaint） ---------- */
function setupMask() {
  if (maskCanvas.width !== canvas.width || maskCanvas.height !== canvas.height) {
    maskCanvas.width = canvas.width; maskCanvas.height = canvas.height;
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  }
  overlay.width = canvas.width; overlay.height = canvas.height;
  octx.clearRect(0, 0, overlay.width, overlay.height);
}
function syncOverlay() {
  requestAnimationFrame(() => {
    overlay.style.width = canvas.clientWidth + 'px'; overlay.style.height = canvas.clientHeight + 'px';
    overlay.classList.remove('hidden'); overlay.style.touchAction = 'none';
  });
}
let maskDrawing = false, lastPt = null;
function strokeTo(pt) {
  const size = +$('#eraserSize').value;
  for (const [c2, style] of [[octx, 'rgba(255,40,40,0.45)'], [mctx, '#fff']]) {
    c2.save(); c2.strokeStyle = style; c2.fillStyle = style; c2.lineWidth = size; c2.lineCap = 'round'; c2.lineJoin = 'round';
    c2.beginPath();
    if (lastPt) { c2.moveTo(lastPt.x, lastPt.y); c2.lineTo(pt.x, pt.y); c2.stroke(); } else { c2.arc(pt.x, pt.y, size / 2, 0, 7); c2.fill(); }
    c2.restore();
  }
  lastPt = pt;
}
overlay.addEventListener('pointerdown', e => { if (!erasing) return; maskDrawing = true; lastPt = null; strokeTo(canvasPos(e, overlay)); });
overlay.addEventListener('pointermove', e => { if (!erasing || !maskDrawing) return; strokeTo(canvasPos(e, overlay)); });
window.addEventListener('pointerup', () => { maskDrawing = false; lastPt = null; });
$('#btnEraserClear').onclick = () => { setupMask(); setStatus('涂抹已清除'); };
function loadOpenCV() {
  if (window.__cvReady) return window.__cvReady;
  window.__cvReady = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    s.onload = () => {
      const cvObj = window.cv;
      if (cvObj && typeof cvObj.then === 'function') cvObj.then(c => { window.cv = c; resolve(c); }, reject);
      else if (cvObj) { cvObj.onRuntimeInitialized = () => resolve(cvObj); }
      else reject(new Error('OpenCV 加载失败'));
    };
    s.onerror = () => reject(new Error('OpenCV 下载失败'));
    document.head.appendChild(s);
  });
  return window.__cvReady;
}
/* 消除笔：优先本地 AI 模型 MI-GAN（ONNX，模型 MIT 许可），失败时兜底 OpenCV 修复。
   实现为独立编写（clean-room），仅依据公开的模型张量规格：输入 image/mask 均为 uint8，
   image 为 [1,3,H,W] 原始 0-255 无归一化，mask 为 [1,1,H,W] 且 0=要消除、255=保留；
   模型内部会按 mask 包围盒裁剪到 512 处理再贴回原图。 */
const MIGAN_URLS = [
  'https://files.2221314.xyz/migan_pipeline_v2.onnx',
  'https://hf-mirror.com/andraniksargsyan/migan/resolve/main/migan_pipeline_v2.onnx',
  'https://huggingface.co/andraniksargsyan/migan/resolve/main/migan_pipeline_v2.onnx'
];
let miganWorker = null, miganReady = false, eraserBusy = false;
function idbGet(key) {
  return new Promise(res => {
    try {
      const rq = indexedDB.open('wyphoto-models', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('files');
      rq.onerror = () => res(null);
      rq.onsuccess = () => {
        try {
          const tx = rq.result.transaction('files').objectStore('files').get(key);
          tx.onsuccess = () => res(tx.result || null); tx.onerror = () => res(null);
        } catch (e) { res(null); }
      };
    } catch (e) { res(null); }
  });
}
function idbPut(key, val) {
  try {
    const rq = indexedDB.open('wyphoto-models', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('files');
    rq.onsuccess = () => { try { rq.result.transaction('files', 'readwrite').objectStore('files').put(val, key); } catch (e) {} };
  } catch (e) {}
}
async function fetchModelFrom(url, st) {
  const ctrl = new AbortController();
  const resp = await fetch(url, { signal: ctrl.signal });
  if (!resp.ok) throw new Error('model http ' + resp.status);
  const total = +resp.headers.get('Content-Length') || 28079181;
  if (!resp.body || !resp.body.getReader) return await resp.arrayBuffer();
  const reader = resp.body.getReader(); const chunks = []; let got = 0;
  for (;;) {
    let timer;
    const stall = new Promise((_, rej) => { timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} rej(new Error('download stalled')); }, 25000); });
    let r;
    try { r = await Promise.race([reader.read(), stall]); } finally { clearTimeout(timer); }
    if (r.done) break;
    chunks.push(r.value); got += r.value.length;
    st.textContent = `正在下载 AI 消除模型… ${Math.round(got / total * 100)}%（下完自动继续，别切走）`;
  }
  const buf = new Uint8Array(got); let off = 0;
  for (const ch of chunks) { buf.set(ch, off); off += ch.length; }
  return buf.buffer;
}
async function downloadMiganModel(st) {
  let lastErr = null;
  for (let i = 0; i < MIGAN_URLS.length; i++) {
    try {
      st.textContent = i === 0 ? '正在下载 AI 消除模型（约28MB，第一次才需要，之后会缓存）…' : '第一个下载源卡住了，正在换备用源下载…';
      return await fetchModelFrom(MIGAN_URLS[i], st);
    } catch (e) { console.error('model download failed from', MIGAN_URLS[i], e); lastErr = e; }
  }
  throw lastErr || new Error('model download failed');
}
async function ensureMiganWorker(st) {
  if (miganWorker && miganReady) return;
  let buf = await idbGet('migan_pipeline_v2');
  if (!buf) {
    buf = await downloadMiganModel(st);
    idbPut('migan_pipeline_v2', buf);
  } else st.textContent = '已从缓存加载 AI 消除模型…';
  st.textContent = '正在启动 AI 消除引擎…';
  if (miganWorker) { try { miganWorker.terminate(); } catch (e) {} miganWorker = null; }
  miganWorker = new Worker('migan-worker.js');
  miganReady = false;
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('worker init timeout')), 120000);
    miganWorker.onmessage = (e) => {
      if (e.data.type === 'ready') { clearTimeout(to); miganReady = true; resolve(); }
      else if (e.data.type === 'error') { clearTimeout(to); reject(new Error(e.data.message)); }
    };
    miganWorker.onerror = () => { clearTimeout(to); reject(new Error('worker failed to start')); };
    miganWorker.postMessage({ type: 'init', model: buf });
  });
}
function miganRun(imgT, mskT, w, h, st) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => { st.textContent = `AI 正在消除并补背景…已用时 ${Math.round((Date.now() - t0) / 1000)} 秒（在后台算，页面可以正常操作）`; };
    tick();
    const timer = setInterval(tick, 1000);
    const to = setTimeout(() => {
      cleanup();
      if (miganWorker) { try { miganWorker.terminate(); } catch (e) {} }
      miganWorker = null; miganReady = false;
      reject(new Error('migan run timeout'));
    }, 240000);
    function cleanup() { clearInterval(timer); clearTimeout(to); }
    miganWorker.onmessage = (e) => {
      if (e.data.type === 'result') { cleanup(); resolve(new Uint8Array(e.data.data)); }
      else if (e.data.type === 'error') { cleanup(); reject(new Error(e.data.message)); }
    };
    miganWorker.onerror = () => { cleanup(); reject(new Error('worker crashed')); };
    miganWorker.postMessage({ type: 'run', img: imgT.buffer, msk: mskT.buffer, w, h }, [imgT.buffer, mskT.buffer]);
  });
}
function maskBBox() {
  const md = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let y = 0; y < maskCanvas.height; y += 4) for (let x = 0; x < maskCanvas.width; x += 4) {
    if (md[(y * maskCanvas.width + x) * 4] > 10) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}
function cropRegion(box, pad) {
  const x0 = Math.max(0, box.minX - pad), y0 = Math.max(0, box.minY - pad);
  const x1 = Math.min(canvas.width - 1, box.maxX + pad), y1 = Math.min(canvas.height - 1, box.maxY + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const img = document.createElement('canvas'); img.width = w; img.height = h;
  img.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
  const msk = document.createElement('canvas'); msk.width = w; msk.height = h;
  msk.getContext('2d').drawImage(maskCanvas, x0, y0, w, h, 0, 0, w, h);
  return { img, msk, x0, y0, w, h };
}
async function miganInpaint(box, st) {
  await ensureMiganWorker(st);
  const pad = Math.max(96, Math.round(Math.max(box.maxX - box.minX, box.maxY - box.minY) * 0.6));
  let { img, msk, x0, y0, w, h } = cropRegion(box, pad);
  const MAXSIDE = 1280;
  if (Math.max(w, h) > MAXSIDE) {
    const f = MAXSIDE / Math.max(w, h), nw = Math.round(w * f), nh = Math.round(h * f);
    const si = document.createElement('canvas'); si.width = nw; si.height = nh; si.getContext('2d').drawImage(img, 0, 0, nw, nh);
    const sm = document.createElement('canvas'); sm.width = nw; sm.height = nh; sm.getContext('2d').drawImage(msk, 0, 0, nw, nh);
    img = si; msk = sm;
    // 结果画回原图时按原始区域尺寸绘制（见下方 drawImage 的目标宽高）
    img.dataset.origW = w; img.dataset.origH = h;
    w = nw; h = nh;
  }
  const idata = img.getContext('2d').getImageData(0, 0, w, h).data;
  const mdata = msk.getContext('2d').getImageData(0, 0, w, h).data;
  const imgT = new Uint8Array(w * h * 3), mskT = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < idata.length; i += 4, j++) {
    imgT[j] = idata[i]; imgT[j + w * h] = idata[i + 1]; imgT[j + 2 * w * h] = idata[i + 2];
    mskT[j] = mdata[i] > 10 ? 0 : 255;
  }
  const rd = await miganRun(imgT, mskT, w, h, st);
  const oimg = new ImageData(w, h);
  for (let i = 0, j = 0; i < oimg.data.length; i += 4, j++) {
    oimg.data[i] = rd[j]; oimg.data[i + 1] = rd[j + w * h]; oimg.data[i + 2] = rd[j + 2 * w * h]; oimg.data[i + 3] = 255;
  }
  const oc = document.createElement('canvas'); oc.width = w; oc.height = h;
  oc.getContext('2d').putImageData(oimg, 0, 0);
  pushHistory();
  const ow = +(img.dataset.origW || w), oh = +(img.dataset.origH || h);
  ctx.drawImage(oc, x0, y0, ow, oh);
}
async function opencvInpaint(box, st) {
  const cv = await loadOpenCV();
  const pad = Math.max(48, Math.round(Math.max(box.maxX - box.minX, box.maxY - box.minY) * 0.45));
  const { img, msk, x0, y0 } = cropRegion(box, pad);
  const src = cv.imread(img), mk = cv.imread(msk), gray = new cv.Mat(), dst = new cv.Mat();
  cv.cvtColor(mk, gray, cv.COLOR_RGBA2GRAY, 0); cv.threshold(gray, gray, 10, 255, cv.THRESH_BINARY);
  cv.inpaint(src, gray, dst, 5, cv.INPAINT_TELEA);
  const out = document.createElement('canvas'); cv.imshow(out, dst);
  src.delete(); mk.delete(); gray.delete(); dst.delete();
  pushHistory(); ctx.drawImage(out, x0, y0);
}
$('#btnEraserFast').onclick = async () => {
  if (!hasImage || eraserBusy) return;
  const st = $('#eraserStatus');
  const box = maskBBox();
  if (!box) { st.textContent = '你还没涂呢 — 先在图上把不要的东西涂红。'; return; }
  eraserBusy = true;
  st.textContent = '正在快速消除…';
  try {
    await opencvInpaint(box, st);
    setupMask(); afterChange();
    st.textContent = '快速消除完成！效果不满意可以撤销，再试「AI 强力消除」。';
    setStatus('快速消除完成');
  } catch (err) {
    console.error(err);
    st.textContent = '快速消除没加载成功，检查网络后重试，或试「AI 强力消除」。';
  } finally { eraserBusy = false; }
};
$('#btnEraserGo').onclick = async () => {
  if (!hasImage || eraserBusy) return;
  eraserBusy = true;
  try { await runEraser(); } finally { eraserBusy = false; }
};
async function runEraser() {
  const st = $('#eraserStatus');
  const box = maskBBox();
  if (!box) { st.textContent = '你还没涂呢 — 先在图上把不要的东西涂红。'; return; }
  try {
    await miganInpaint(box, st);
    setupMask(); afterChange();
    st.textContent = 'AI 消除完成！不满意可以撤销后换个涂法再试。';
    setStatus('AI 消除完成');
  } catch (err) {
    console.error('MI-GAN failed, fallback to OpenCV', err);
    st.textContent = 'AI 消除没跑成，正在用快速修复试试…';
    try {
      await opencvInpaint(box, st);
      setupMask(); afterChange();
      st.textContent = '已用快速修复消除（AI 版这次没跑起来，再点一次「AI 强力消除」会重试 AI 版）。';
      setStatus('消除完成（基础修复）');
    } catch (err2) {
      console.error(err2);
      st.textContent = '消除失败：两个引擎都没加载下来。检查网络后重试。';
    }
  }
};

/* ---------- 导出 ---------- */
$('#expFormat').onchange = updateExportInfo;
$('#expQuality').oninput = updateExportInfo;
$('#btnDownload').onclick = () => {
  if (!hasImage) return;
  const fmt = $('#expFormat').value, ext = fmt === 'image/png' ? 'png' : fmt === 'image/webp' ? 'webp' : 'jpg';
  canvas.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = `${baseName}-wyphoto.${ext}`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setStatus(`已下载（${fmtSize(b.size)}）`);
  }, fmt, $('#expQuality').value / 100);
};
afterChange();

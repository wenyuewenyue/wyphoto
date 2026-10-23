/* WyPhoto fast eraser worker: pure-JS multi-scale diffusion inpainting.
   No external engine, no downloads — starts instantly on any device.
   Good for text/watermarks, thin strokes and small blemishes on smooth
   backgrounds. Receives region ImageData + mask ImageData (white = erase). */
self.onmessage = (e) => {
  const d = e.data || {};
  if (d.type === 'init') { self.postMessage({ type: 'ready' }); return; }
  if (d.type !== 'run') return;
  try {
    const { w, h } = d;
    const img = new Uint8ClampedArray(d.img);
    const msk = new Uint8ClampedArray(d.msk);
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = msk[i * 4] > 10 ? 1 : 0;
    const out = inpaint(img, mask, w, h);
    self.postMessage({ type: 'result', data: out.buffer }, [out.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.message) || err) });
  }
};

function makeLevel(img, filled0, w, h) {
  return { img, fixed: filled0.slice(), filled: filled0.slice(), w, h };
}
function diffuseFill(L) {
  // Fill unknown pixels from filled neighbours until everything is filled.
  const { img, fixed, filled, w, h } = L;
  let remaining = 0;
  for (let i = 0; i < w * h; i++) if (!filled[i]) remaining++;
  let guard = w + h + 10;
  while (remaining > 0 && guard-- > 0) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (filled[i]) continue;
      let sr = 0, sg = 0, sb = 0, n = 0;
      if (x > 0 && filled[i - 1]) { sr += img[(i - 1) * 3]; sg += img[(i - 1) * 3 + 1]; sb += img[(i - 1) * 3 + 2]; n++; }
      if (x < w - 1 && filled[i + 1]) { sr += img[(i + 1) * 3]; sg += img[(i + 1) * 3 + 1]; sb += img[(i + 1) * 3 + 2]; n++; }
      if (y > 0 && filled[i - w]) { sr += img[(i - w) * 3]; sg += img[(i - w) * 3 + 1]; sb += img[(i - w) * 3 + 2]; n++; }
      if (y < h - 1 && filled[i + w]) { sr += img[(i + w) * 3]; sg += img[(i + w) * 3 + 1]; sb += img[(i + w) * 3 + 2]; n++; }
      if (n > 0) { img[i * 3] = sr / n; img[i * 3 + 1] = sg / n; img[i * 3 + 2] = sb / n; filled[i] = 1; remaining--; }
    }
  }
}
function smooth(L, iters) {
  // Relax non-fixed pixels toward their neighbours (seam removal).
  const { img, fixed, w, h } = L;
  for (let it = 0; it < iters; it++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (fixed[i]) continue;
      let sr = 0, sg = 0, sb = 0, n = 0;
      if (x > 0) { sr += img[(i - 1) * 3]; sg += img[(i - 1) * 3 + 1]; sb += img[(i - 1) * 3 + 2]; n++; }
      if (x < w - 1) { sr += img[(i + 1) * 3]; sg += img[(i + 1) * 3 + 1]; sb += img[(i + 1) * 3 + 2]; n++; }
      if (y > 0) { sr += img[(i - w) * 3]; sg += img[(i - w) * 3 + 1]; sb += img[(i - w) * 3 + 2]; n++; }
      if (y < h - 1) { sr += img[(i + w) * 3]; sg += img[(i + w) * 3 + 1]; sb += img[(i + w) * 3 + 2]; n++; }
      if (n > 0) { img[i * 3] = sr / n; img[i * 3 + 1] = sg / n; img[i * 3 + 2] = sb / n; }
    }
  }
}
function inpaint(img, mask, w, h) {
  const n = w * h;
  const img0 = new Float32Array(n * 3), fix0 = new Uint8Array(n);
  let anyKnown = false, anyMask = false;
  for (let i = 0; i < n; i++) {
    img0[i * 3] = img[i * 4]; img0[i * 3 + 1] = img[i * 4 + 1]; img0[i * 3 + 2] = img[i * 4 + 2];
    fix0[i] = mask[i] ? 0 : 1;
    if (fix0[i]) anyKnown = true; else anyMask = true;
  }
  const res = new Uint8Array(n * 4);
  if (!anyMask) { res.set(img); return res; }
  if (!anyKnown) { // everything painted: neutral fill
    for (let i = 0; i < n; i++) { res[i * 4] = res[i * 4 + 1] = res[i * 4 + 2] = 200; res[i * 4 + 3] = 255; }
    return res;
  }
  const levels = [makeLevel(img0, fix0, w, h)];
  while (levels.length < 6) {
    const p = levels[levels.length - 1];
    if (Math.min(p.w, p.h) <= 24) break;
    const cw = Math.max(1, Math.round(p.w / 2)), ch = Math.max(1, Math.round(p.h / 2));
    const cimg = new Float32Array(cw * ch * 3), cfix = new Uint8Array(cw * ch), cfill = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      let sr = 0, sg = 0, sb = 0, sw = 0, allFix = 1;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const sx = Math.min(p.w - 1, x * 2 + dx), sy = Math.min(p.h - 1, y * 2 + dy), si = sy * p.w + sx;
        if (!p.fixed[si]) allFix = 0;
        if (p.filled[si]) { sr += p.img[si * 3]; sg += p.img[si * 3 + 1]; sb += p.img[si * 3 + 2]; sw++; }
      }
      const ci = y * cw + x;
      cfix[ci] = allFix; cfill[ci] = sw > 0 ? 1 : 0;
      if (sw > 0) { cimg[ci * 3] = sr / sw; cimg[ci * 3 + 1] = sg / sw; cimg[ci * 3 + 2] = sb / sw; }
    }
    const L = { img: cimg, fixed: cfix, filled: cfill, w: cw, h: ch };
    levels.push(L);
  }
  const top = levels[levels.length - 1];
  diffuseFill(top); smooth(top, 40);
  for (let li = levels.length - 2; li >= 0; li--) {
    const cur = levels[li], coarse = levels[li + 1];
    for (let y = 0; y < cur.h; y++) for (let x = 0; x < cur.w; x++) {
      const i = y * cur.w + x;
      if (cur.filled[i]) continue;
      const gx = (x + 0.5) * coarse.w / cur.w - 0.5, gy = (y + 0.5) * coarse.h / cur.h - 0.5;
      const x0 = Math.max(0, Math.floor(gx)), y0 = Math.max(0, Math.floor(gy));
      const x1 = Math.min(coarse.w - 1, x0 + 1), y1 = Math.min(coarse.h - 1, y0 + 1);
      const fx = Math.min(1, Math.max(0, gx - x0)), fy = Math.min(1, Math.max(0, gy - y0));
      for (let c = 0; c < 3; c++) {
        const v00 = coarse.img[(y0 * coarse.w + x0) * 3 + c], v10 = coarse.img[(y0 * coarse.w + x1) * 3 + c];
        const v01 = coarse.img[(y1 * coarse.w + x0) * 3 + c], v11 = coarse.img[(y1 * coarse.w + x1) * 3 + c];
        cur.img[i * 3 + c] = (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
      }
      cur.filled[i] = 1;
    }
    smooth(cur, li === 0 ? 30 : 16);
  }
  const L0 = levels[0];
  for (let i = 0; i < n; i++) {
    res[i * 4] = L0.img[i * 3]; res[i * 4 + 1] = L0.img[i * 3 + 1]; res[i * 4 + 2] = L0.img[i * 3 + 2]; res[i * 4 + 3] = 255;
  }
  return res;
}

/* WyPhoto fast-eraser worker: OpenCV.js TELEA inpainting off the main thread,
   so loading/initializing the engine never freezes the page. */
let cvMod = null;
async function getCv() {
  if (cvMod) return cvMod;
  importScripts('https://files.2221314.xyz/opencv.js');
  const c = self.cv;
  cvMod = (c && typeof c.then === 'function') ? await c : c;
  self.cv = cvMod;
  return cvMod;
}
self.onmessage = async (e) => {
  const d = e.data || {};
  try {
    if (d.type === 'init') {
      await getCv();
      self.postMessage({ type: 'ready' });
    } else if (d.type === 'run') {
      const cv = await getCv();
      const src = cv.matFromImageData(new ImageData(new Uint8ClampedArray(d.img), d.w, d.h));
      const mk = cv.matFromImageData(new ImageData(new Uint8ClampedArray(d.msk), d.w, d.h));
      const gray = new cv.Mat(), dst = new cv.Mat();
      cv.cvtColor(mk, gray, cv.COLOR_RGBA2GRAY, 0);
      cv.threshold(gray, gray, 10, 255, cv.THRESH_BINARY);
      cv.inpaint(src, gray, dst, 5, cv.INPAINT_TELEA);
      const out = new Uint8Array(dst.data.length);
      out.set(dst.data);
      src.delete(); mk.delete(); gray.delete(); dst.delete();
      self.postMessage({ type: 'result', data: out.buffer }, [out.buffer]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.message) || err) });
  }
};

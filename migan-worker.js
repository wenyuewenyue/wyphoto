/* WyPhoto MI-GAN eraser worker.
   Runs the ONNX inpainting model off the main thread so the page stays
   responsive during inference. Model weights are MIT-licensed (MI-GAN);
   this adapter is written from the model's public tensor spec:
   inputs  image uint8 [1,3,H,W] raw 0-255, mask uint8 [1,1,H,W] (0=inpaint, 255=keep)
   output  uint8 [1,3,H,W]. */
importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort.wasm.min.js');
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/';
ort.env.wasm.numThreads = 1;

let session = null;

self.onmessage = async (e) => {
  const d = e.data || {};
  try {
    if (d.type === 'init') {
      session = await ort.InferenceSession.create(d.model, { executionProviders: ['wasm'] });
      self.postMessage({ type: 'ready' });
    } else if (d.type === 'run') {
      if (!session) throw new Error('session not initialized');
      const imgT = new Uint8Array(d.img);
      const mskT = new Uint8Array(d.msk);
      const feeds = {};
      feeds[session.inputNames[0]] = new ort.Tensor('uint8', imgT, [1, 3, d.h, d.w]);
      feeds[session.inputNames[1]] = new ort.Tensor('uint8', mskT, [1, 1, d.h, d.w]);
      const out = await session.run(feeds);
      const res = out[session.outputNames[0]];
      const copy = new Uint8Array(res.data.length);
      copy.set(res.data);
      self.postMessage({ type: 'result', data: copy.buffer }, [copy.buffer]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.message) || err) });
  }
};

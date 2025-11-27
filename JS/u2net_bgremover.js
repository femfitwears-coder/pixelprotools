// u2net_bgremover.js
document.addEventListener('DOMContentLoaded', () => {
  console.log("u2net_bgremover.js loaded");

  // Elements
  const uploadBox = document.getElementById('uploadBox');
  const imageInput = document.getElementById('imageInput');
  const uploadError = document.getElementById('uploadError');
  const controls = document.getElementById('controls');
  const modelSelect = document.getElementById('modelSelect');
  const loadModelBtn = document.getElementById('loadModelBtn');
  const removeBtn = document.getElementById('removeBtn');
  const resetBtn = document.getElementById('resetBtn');
  const resultSection = document.getElementById('resultSection');
  const outputCanvas = document.getElementById('outputCanvas');
  const metaInfo = document.getElementById('metaInfo');
  const downloadBtn = document.getElementById('downloadBtn');
  const loadingStatus = document.getElementById('loadingStatus');

  // ONNX runtime session
  let session = null;
  let modelPath = modelSelect.value;

  // image state
  let originalDataUrl = null;
  let originalName = 'image';
  let imgElement = null;

  // U2Net expected input size (commonly 320x320). Smaller variants may differ.
  const MODEL_SIZE = 320;

  // defensive
  function showError(msg) {
    if (!uploadError) return;
    uploadError.textContent = msg || '';
    uploadError.style.display = msg ? 'block' : 'none';
    if (msg) console.warn('U2Net:', msg);
  }
  function setStatus(msg) { if (loadingStatus) loadingStatus.innerText = msg || ''; }

  function clearAll() {
    originalDataUrl = null;
    originalName = 'image';
    imageInput.value = '';
    imgElement = null;
    if (controls) controls.classList.add('hidden');
    if (resultSection) resultSection.classList.add('hidden');
    if (outputCanvas) { outputCanvas.width = 0; outputCanvas.height = 0; }
    session = session; // keep model loaded unless user resets model separately
    showError(''); setStatus('');
    removeBtn.disabled = true;
  }

  // upload integration
  uploadBox.addEventListener('click', () => imageInput.click());
  uploadBox.addEventListener('dragover', (e) => { e.preventDefault(); uploadBox.classList.add('drag'); });
  uploadBox.addEventListener('dragleave', (e) => { e.preventDefault(); uploadBox.classList.remove('drag'); });
  uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('drag');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
      imageInput.files = e.dataTransfer.files;
      handleFile(f);
    }
  });
  imageInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
  });

  function handleFile(file) {
    clearAll();
    showError('');
    if (!file || !file.type || !file.type.startsWith('image/')) { showError('Please upload an image file.'); return; }
    if (file.size > 60 * 1024 * 1024) { showError('File too large. Use < 60 MB.'); return; }

    originalName = (file.name && file.name.split('.').slice(0, -1).join('.')) || 'image';
    const reader = new FileReader();
    reader.onload = (ev) => {
      originalDataUrl = ev.target.result;
      prepareImageElement(originalDataUrl);
      controls.classList.remove('hidden');
      setStatus('Choose model and click "Load Model" (if not loaded).');
    };
    reader.onerror = () => showError('Failed to read file.');
    reader.readAsDataURL(file);
  }

  function prepareImageElement(dataUrl) {
    imgElement = new Image();
    imgElement.crossOrigin = 'anonymous';
    imgElement.onload = () => {
      // cap very large images to avoid giant canvases
      const maxDim = 2000;
      let w = imgElement.width, h = imgElement.height;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      if (scale < 1) { w = Math.round(w * scale); h = Math.round(h * scale); }
      outputCanvas.width = w; outputCanvas.height = h;
      const ctx = outputCanvas.getContext('2d');
      ctx.drawImage(imgElement, 0, 0, w, h);
      metaInfo.innerText = `Image: ${w}×${h} px`;
      resultSection.classList.remove('hidden');
      removeBtn.disabled = !session; // enable only if model already loaded
    };
    imgElement.onerror = () => showError('Could not load the image. Try another file.');
    imgElement.src = dataUrl;
  }

  // model load
  modelSelect.addEventListener('change', (e) => { modelPath = e.target.value; });
  loadModelBtn.addEventListener('click', async () => {
    if (!modelPath) { showError('Choose a model path first.'); return; }
    if (session) { setStatus('Model already loaded.'); removeBtn.disabled = false; return; }
    try {
      setStatus('Loading model — this may take a few seconds (browser will download the .onnx file)...');
      // configure WebAssembly or WebGL backend automatically; you can tune allocation via ort.env.wasm.wasmPaths etc.
      session = await ort.InferenceSession.create(modelPath, { executionProviders: ['wasm','webgl'] });
      setStatus('Model loaded.');
      removeBtn.disabled = false;
    } catch (err) {
      console.error('Model load failed', err);
      showError('Failed to load model. Check model file path and server. Use smaller model (u2netp) if available.');
      setStatus('');
    }
  });

  // preprocess: image -> Float32Array [1,3,MODEL_SIZE,MODEL_SIZE] in CHW order with values [0,1]
  function preprocessImageToTensor(img, size=MODEL_SIZE) {
    // draw image to offscreen canvas sized to model input
    const tmp = document.createElement('canvas');
    tmp.width = size; tmp.height = size;
    const tctx = tmp.getContext('2d');
    // draw with cover-like fit (keep aspect: drawImage center crop)
    const sw = img.width, sh = img.height;
    const sRatio = Math.max(size / sw, size / sh);
    const dw = Math.round(sw * sRatio), dh = Math.round(sh * sRatio);
    // draw into center
    tctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    const imgData = tctx.getImageData(0, 0, size, size).data; // RGBA

    // Create Float32Array in CHW order
    const floatData = new Float32Array(1 * 3 * size * size);
    let rIndex = 0, gIndex = size * size, bIndex = 2 * size * size;
    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i] / 255.0;
      const g = imgData[i + 1] / 255.0;
      const b = imgData[i + 2] / 255.0;
      floatData[rIndex++] = r;
      floatData[gIndex++] = g;
      floatData[bIndex++] = b;
    }
    return { data: floatData, width: size, height: size };
  }

  // postprocess: output Float32Array (1x1xSxS) -> mask canvas resized to original canvas size
  function createMaskCanvasFromOutput(outputArray, outSize, targetW, targetH, threshold=0.3) {
    // outputArray expected length = outSize*outSize
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = outSize; maskCanvas.height = outSize;
    const ctx = maskCanvas.getContext('2d');
    const imgData = ctx.createImageData(outSize, outSize);
    for (let i = 0; i < outSize * outSize; i++) {
      const v = outputArray[i]; // assume 0..1
      const alpha = Math.max(0, Math.min(1, v));
      const m = Math.round(alpha * 255);
      // set rgba (we'll use red channel for mask)
      imgData.data[i * 4 + 0] = m;
      imgData.data[i * 4 + 1] = m;
      imgData.data[i * 4 + 2] = m;
      imgData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    // resize mask to targetW x targetH
    const resized = document.createElement('canvas');
    resized.width = targetW; resized.height = targetH;
    const rctx = resized.getContext('2d');
    // better quality:
    rctx.imageSmoothingEnabled = true;
    rctx.imageSmoothingQuality = 'high';
    rctx.drawImage(maskCanvas, 0, 0, targetW, targetH);
    return resized;
  }

  // run inference, get mask, composite to transparent PNG
  async function runInferenceAndCompose() {
    if (!session) { showError('Model not loaded. Click Load Model first.'); return; }
    if (!imgElement) { showError('No image loaded.'); return; }

    setStatus('Preparing image for model...');
    // preprocess
    const { data, width, height } = preprocessImageToTensor(imgElement, MODEL_SIZE);
    const inputName = session.inputNames && session.inputNames.length ? session.inputNames[0] : null;
    if (!inputName) { showError('Model input name not found.'); return; }

    const tensor = new ort.Tensor('float32', data, [1, 3, width, height]);
    setStatus('Running model (inference)...');

    try {
      const feeds = {};
      feeds[inputName] = tensor;
      const results = await session.run(feeds);
      // get first output
      const outputName = session.outputNames && session.outputNames.length ? session.outputNames[0] : Object.keys(results)[0];
      const outputTensor = results[outputName];
      let outData = outputTensor.data;
      // Some models output shape [1,1,H,W] while others [1,H,W]; normalize
      // flatten to Float32Array of length MODEL_SIZE*MODEL_SIZE
      if (outData.length === MODEL_SIZE * MODEL_SIZE) {
        // ok
      } else if (outData.length === MODEL_SIZE * MODEL_SIZE * 1) {
        // ok
      } else {
        // try to extract when shape is [1,1,H,W]
        // most runtime returns flat array anyway
      }

      setStatus('Postprocessing mask...');
      // build mask canvas at model size then resize to original canvas size
      const maskCanvas = createMaskCanvasFromOutput(outData, MODEL_SIZE, outputCanvas.width, outputCanvas.height);

      // composite: create final canvas with transparent background where mask==0
      const ctx = outputCanvas.getContext('2d');
      // draw original image (already drawn during prepareImageElement)
      ctx.clearRect(0,0,outputCanvas.width, outputCanvas.height);
      ctx.drawImage(imgElement, 0, 0, outputCanvas.width, outputCanvas.height);

      // get image data & mask data
      const imgData = ctx.getImageData(0,0,outputCanvas.width, outputCanvas.height);
      const maskCtx = maskCanvas.getContext('2d');
      const maskData = maskCtx.getImageData(0,0,outputCanvas.width, outputCanvas.height).data;

      // apply mask: maskData red channel > 128 => foreground
      for (let i = 0; i < imgData.data.length; i += 4) {
        const idx = i; // same index in maskData
        const maskVal = maskData[idx]; // red channel
        if (maskVal < 128) {
          imgData.data[i + 3] = 0; // set alpha to 0 for background
        } else {
          imgData.data[i + 3] = 255; // keep fully opaque
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // prepare download
      downloadBtn.onclick = () => {
        outputCanvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${originalName}-no-bg.png`;
          a.click();
          setTimeout(()=>URL.revokeObjectURL(url), 2000);
        }, 'image/png');
      };

      setStatus('Done — background removed. Click Download to save PNG.');
      showError('');
    } catch (err) {
      console.error('Inference error', err);
      showError('Inference failed. Try smaller model (u2netp) or reduce image size.');
      setStatus('');
    }
  }

  // event bindings
  removeBtn.addEventListener('click', runInferenceAndCompose);
  resetBtn.addEventListener('click', clearAll);

  // quick helper to pre-load model automatically (optional)
  // you can call loadModelBtn.click() from console to force load
  // Expose for debugging:
  window._ppt_u2net = {
    loadModel: async () => {
      if (!modelPath) modelPath = modelSelect.value;
      setStatus('Loading model...');
      session = await ort.InferenceSession.create(modelPath, { executionProviders: ['wasm','webgl'] });
      setStatus('Model loaded');
      removeBtn.disabled = false;
      return session;
    }
  };
});

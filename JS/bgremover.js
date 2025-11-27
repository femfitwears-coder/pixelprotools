// bgremover.js (client-side BodyPix)
document.addEventListener('DOMContentLoaded', () => {
  console.log('bgremover.js starting after DOMContentLoaded');

  const uploadBox = document.getElementById('uploadBox');
  const imageInput = document.getElementById('imageInput');
  const uploadError = document.getElementById('uploadError');
  const controls = document.getElementById('controls');
  const qualitySelect = document.getElementById('qualitySelect');
  const removeBtn = document.getElementById('removeBtn');
  const previewBtn = document.getElementById('previewBtn');
  const resetBtn = document.getElementById('resetBtn');

  const resultSection = document.getElementById('resultSection');
  const outputCanvas = document.getElementById('outputCanvas');
  const metaInfo = document.getElementById('metaInfo');
  const downloadBtn = document.getElementById('downloadBtn');
  const loadingStatus = document.getElementById('loadingStatus');

  let originalDataUrl = null;
  let originalName = 'image';
  let imgElement = null;
  let net = null;
  let lastMask = null;

  function showError(msg) {
    if (!uploadError) return;
    uploadError.textContent = msg || '';
    uploadError.style.display = msg ? 'block' : 'none';
    if (msg) console.warn('BG remover:', msg);
  }

  function setStatus(msg) {
    if (!loadingStatus) return;
    loadingStatus.innerText = msg || '';
  }

  function clearAll() {
    originalDataUrl = null;
    originalName = 'image';
    imageInput.value = '';
    if (controls) controls.classList.add('hidden');
    if (resultSection) resultSection.classList.add('hidden');
    if (outputCanvas) { outputCanvas.width = 0; outputCanvas.height = 0; }
    lastMask = null;
    showError('');
    setStatus('');
  }

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
    if (!file || !file.type || !file.type.startsWith('image/')) {
      showError('Please upload an image file.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      showError('File too large. Use images smaller than 25 MB.');
      return;
    }

    originalName = (file.name && file.name.split('.').slice(0, -1).join('.')) || 'image';
    const reader = new FileReader();
    reader.onload = (ev) => {
      originalDataUrl = ev.target.result;
      prepareImageElement(originalDataUrl);
      if (controls) controls.classList.remove('hidden');
      setStatus('Model will load when you click Remove Background (first time may take 2-6s).');
    };
    reader.onerror = () => showError('Failed to read file.');
    reader.readAsDataURL(file);
  }

  function prepareImageElement(dataUrl) {
    imgElement = new Image();
    imgElement.crossOrigin = 'anonymous';
    imgElement.onload = () => {
      // resize canvas to image size (but cap for very large images)
      const maxDim = 2000;
      let w = imgElement.width, h = imgElement.height;
      const scale = Math.min(1, maxDim / Math.max(w,h));
      if (scale < 1) { w = Math.round(w * scale); h = Math.round(h * scale); }
      outputCanvas.width = w;
      outputCanvas.height = h;
      // draw original to canvas briefly
      const ctx = outputCanvas.getContext('2d');
      ctx.drawImage(imgElement, 0, 0, w, h);
      metaInfo.innerText = `Image: ${w}×${h} px`;
      // keep lastMask null until user runs segmentation
      lastMask = null;
      if (resultSection) resultSection.classList.remove('hidden');
    };
    imgElement.onerror = () => showError('Could not load the image. Try another file.');
    imgElement.src = dataUrl;
  }

  // load model (lazy)
  async function loadModelIfNeeded() {
    if (net) return net;
    setStatus('Loading BodyPix model...');
    try {
      // choose multiplier based on quality
      const q = qualitySelect ? qualitySelect.value : 'medium';
      let multiplier = 0.75; // medium
      if (q === 'low') multiplier = 0.5;
      if (q === 'high') multiplier = 1.0;

      net = await bodyPix.load({ architecture: 'MobileNetV1', multiplier, outputStride: 16 });
      setStatus('Model loaded.');
      return net;
    } catch (err) {
      console.error('BodyPix load error', err);
      showError('Failed to load model. Check internet connection.');
      setStatus('');
      return null;
    }
  }

  // run segmentation and create transparent PNG
  async function removeBackgroundAction(showMask=false) {
    if (!imgElement) { showError('No image loaded.'); return; }
    const net = await loadModelIfNeeded();
    if (!net) return;

    setStatus('Segmenting image...');
    try {
      // compute segmentation for person (works best for people)
      const segmentation = await net.segmentPerson(imgElement, {
        internalResolution: 'medium',
        segmentationThreshold: 0.7
      });

      lastMask = segmentation;
      setStatus('Compositing result...');
      // draw mask + original onto canvas and create transparency
      const ctx = outputCanvas.getContext('2d');
      // draw original resized image
      const w = outputCanvas.width, h = outputCanvas.height;
      ctx.clearRect(0,0,w,h);
      ctx.drawImage(imgElement, 0, 0, w, h);

      // get image data and mask
      const imgData = ctx.getImageData(0,0,w,h);
      const pixels = imgData.data;

      // segmentation.data is boolean array - length = w*h? bodyPix gives array matching original img width/height.
      // bodyPix segmentation was run on original image size; we need to map it to canvas produced size.
      // We'll create an offscreen mask at canvas size:
      const mask = bodyPix.toMask(segmentation);
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = mask.width;
      maskCanvas.height = mask.height;
      const mCtx = maskCanvas.getContext('2d');
      mCtx.putImageData(mask, 0, 0);

      // draw mask to same size as output canvas to sample per-pixel alpha
      const resizedMaskCanvas = document.createElement('canvas');
      resizedMaskCanvas.width = w;
      resizedMaskCanvas.height = h;
      const rCtx = resizedMaskCanvas.getContext('2d');
      rCtx.drawImage(maskCanvas, 0, 0, w, h);
      const maskData = rCtx.getImageData(0,0,w,h).data;

      // apply mask: if mask pixel is black (background) -> set alpha to 0
      for (let i = 0; i < pixels.length; i += 4) {
        const mi = i; // maskData aligned as RGBA
        const maskR = maskData[mi]; // red channel of mask (255 for person, 0 for background)
        if (maskR < 128) {
          // background -> make transparent
          pixels[i+3] = 0;
        } else {
          // keep alpha
          pixels[i+3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      if (showMask) {
        // show mask overlay instead: draw resizedMaskCanvas to output
        ctx.clearRect(0,0,w,h);
        ctx.drawImage(resizedMaskCanvas, 0, 0, w, h);
      }

      setStatus('Done. You can download the PNG with transparent background.');
      // enable download
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
    } catch (err) {
      console.error('segmentation error', err);
      showError('Background removal failed. Try a different image or lower the quality.');
      setStatus('');
    }
  }

  // event handlers
  removeBtn.addEventListener('click', () => removeBackgroundAction(false));
  previewBtn.addEventListener('click', () => removeBackgroundAction(true));
  resetBtn.addEventListener('click', clearAll);

  // expose debug
  window._ppt_bgremover = { clearAll, removeBackgroundAction };
});

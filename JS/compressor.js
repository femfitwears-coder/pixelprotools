// compressor.js (robust, supports drag/drop + quality slider)
document.addEventListener('DOMContentLoaded', () => {
  console.log('compressor.js loaded');

  const uploadBox = document.getElementById('uploadBox');
  const imageInput = document.getElementById('imageInput');
  const uploadError = document.getElementById('uploadError');
  const resultSection = document.getElementById('resultSection');
  const previewImage = document.getElementById('previewImage');
  const downloadBtn = document.getElementById('downloadBtn');
  const downloadOriginalBtn = document.getElementById('downloadOriginalBtn');
  const settings = document.getElementById('settings');
  const qualityRange = document.getElementById('qualityRange');
  const qualityVal = document.getElementById('qualityVal');
  const metaInfo = document.getElementById('metaInfo');

  let originalDataUrl = null;
  let originalFile = null;
  let compressedDataUrl = null;

  function showError(msg) {
    if (!uploadError) return;
    uploadError.textContent = msg || '';
    uploadError.style.display = msg ? 'block' : 'none';
    if (msg) console.warn('Compressor:', msg);
  }

  // UI helpers
  function resetState() {
    originalDataUrl = null;
    originalFile = null;
    compressedDataUrl = null;
    previewImage.src = '';
    resultSection.classList.add('hidden');
    settings.classList.add('hidden');
    imageInput.value = '';
    showError('');
    metaInfo.textContent = '';
  }

  function bytesToKb(n) { return Math.round(n/1024); }

  // Drag & drop + click handlers
  uploadBox.addEventListener('click', () => imageInput.click());
  uploadBox.addEventListener('dragover', (e) => { e.preventDefault(); uploadBox.classList.add('drag'); });
  uploadBox.addEventListener('dragleave', (e) => { e.preventDefault(); uploadBox.classList.remove('drag'); });
  uploadBox.addEventListener('drop', (e) => {
    e.preventDefault(); uploadBox.classList.remove('drag');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  imageInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
  });

  function handleFile(file) {
    resetState();
    if (!file || !file.type || !file.type.startsWith('image/')) {
      showError('Please upload a valid image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 50 * 1024 * 1024) { // 50 MB cap
      showError('File is too large. Use images smaller than 50 MB.');
      return;
    }

    originalFile = file;
    const reader = new FileReader();
    reader.onerror = () => showError('Failed to read file.');
    reader.onload = (ev) => {
      originalDataUrl = ev.target.result;
      settings.classList.remove('hidden');
      resultSection.classList.add('hidden');
      metaInfo.textContent = `Original: ${file.type} • ${bytesToKb(file.size)} KB • ${file.width || ''}`;
      // show preview as original until compressed
      previewImage.src = originalDataUrl;
      // run initial compression automatically
      compressImage();
    };
    reader.readAsDataURL(file);
  }

  // quality slider UI
  if (qualityRange && qualityVal) {
    qualityRange.addEventListener('input', () => {
      qualityVal.textContent = qualityRange.value;
      if (originalDataUrl) compressImage();
    });
  }

  // compress function (supports PNG/JPEG/WebP -> exports jpeg by default or keep type)
  function compressImage() {
    if (!originalDataUrl) return;
    const img = new Image();
    img.onload = () => {
      // create canvas at same dimensions
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // choose output mime: if original is png/webp we can optionally keep png (but PNG won't compress much)
      // We'll export as JPEG for best size reduction unless original is PNG and user wants PNG (not implemented UI)
      const outMime = 'image/jpeg';
      const quality = Number(qualityRange ? qualityRange.value : 0.75);

      try {
        const dataUrl = canvas.toDataURL(outMime, quality);
        compressedDataUrl = dataUrl;
        previewImage.src = dataUrl;
        resultSection.classList.remove('hidden');

        // approximate size in KB
        const approxSizeKB = Math.round((dataUrl.length * 3 / 4) / 1024);
        metaInfo.textContent = `Compressed approx: ${approxSizeKB} KB (quality ${quality}) — Original: ${bytesToKb(originalFile.size)} KB`;
        // download handlers
        downloadBtn.onclick = () => {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `compressed-${originalFile.name.split('.').slice(0,-1).join('.') || 'image'}.jpg`;
          a.click();
        };
        downloadOriginalBtn.onclick = () => {
          const a = document.createElement('a');
          a.href = originalDataUrl;
          a.download = originalFile.name;
          a.click();
        };
      } catch (err) {
        showError('Compression failed: ' + (err.message || err));
        console.error('compress error', err);
      }
    };
    img.onerror = () => showError('Failed to load image for compression.');
    img.src = originalDataUrl;
  }

  // expose for debugging
  window._ppt_compressor = { resetState, compressImage };
});

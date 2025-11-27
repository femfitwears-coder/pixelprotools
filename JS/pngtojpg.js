// pngtojpg.js - robust PNG -> JPG converter
document.addEventListener('DOMContentLoaded', () => {
  console.log("pngtojpg.js running after DOMContentLoaded");

  const imageInput = document.getElementById('imageInput');
  const uploadBox = document.getElementById('uploadBox');
  const uploadText = document.getElementById('uploadText');
  const uploadError = document.getElementById('uploadError');
  const options = document.getElementById('options');
  const filenameInput = document.getElementById('filenameInput');
  const qualityInput = document.getElementById('qualityInput');
  const fillWhite = document.getElementById('fillWhite');
  const convertBtn = document.getElementById('convertBtn');
  const resetBtn = document.getElementById('resetBtn');

  const resultSection = document.getElementById('resultSection');
  const previewImage = document.getElementById('previewImage');
  const downloadBtn = document.getElementById('downloadBtn');
  const metaInfo = document.getElementById('metaInfo');

  if (!uploadBox || !imageInput) {
    console.error('Required elements not found (uploadBox / imageInput).');
    if (uploadError) uploadError.textContent = 'Internal error: required elements not found.';
    return;
  }

  let originalDataUrl = null;
  let originalName = 'image';

  function showError(msg) {
    if (!uploadError) return;
    uploadError.textContent = msg || '';
    uploadError.style.display = msg ? 'block' : 'none';
    if (msg) console.warn('PNG->JPG error:', msg);
  }

  function clearState() {
    originalDataUrl = null;
    originalName = 'image';
    imageInput.value = '';
    if (filenameInput) filenameInput.value = '';
    if (options) options.classList.add('hidden');
    if (resultSection) resultSection.classList.add('hidden');
    showError('');
  }

  // click & keyboard open
  uploadBox.addEventListener('click', () => imageInput.click());
  uploadBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') imageInput.click(); });

  // drag & drop
  uploadBox.addEventListener('dragover', (e) => { e.preventDefault(); uploadBox.classList.add('drag'); });
  uploadBox.addEventListener('dragleave', (e) => { e.preventDefault(); uploadBox.classList.remove('drag'); });
  uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('drag');
    const file = (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) || null;
    if (file) {
      try { imageInput.files = e.dataTransfer.files; } catch (err) {}
      handleFile(file);
    }
  });

  imageInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) { showError('No file selected.'); return; }
    handleFile(file);
  });

  function handleFile(file) {
    showError('');
    if (!file || !file.type) { showError('Please upload a valid image file.'); return; }
    if (!file.type.startsWith('image/')) { showError('Please upload an image (PNG preferred).'); return; }
    if (file.size > 40 * 1024 * 1024) { showError('File too large. Use < 40 MB.'); return; }

    originalName = (file.name && file.name.split('.').slice(0, -1).join('.')) || 'image';
    if (filenameInput) filenameInput.value = `${originalName}.jpg`;

    const reader = new FileReader();
    reader.onerror = (err) => {
      showError('Could not read file.');
      console.error('FileReader error', err);
    };
    reader.onload = (ev) => {
      originalDataUrl = ev.target.result;
      if (options) options.classList.remove('hidden');
      if (resultSection) resultSection.classList.add('hidden');
      if (metaInfo) metaInfo.innerText = `Original: ${file.type} • ${Math.round(file.size/1024)} KB`;
      showError('');
    };
    try { reader.readAsDataURL(file); } catch (ex) {
      showError('Read failed. Try another browser.');
      console.error('readAsDataURL exception', ex);
    }
  }

  // convert handler
  if (convertBtn) {
    convertBtn.addEventListener('click', () => {
      if (!originalDataUrl) { showError('Please upload an image first.'); return; }
      const img = new Image();
      img.onload = () => {
        const w = img.width, h = img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // If user wants white background (to replace transparency)
        if (fillWhite && fillWhite.checked) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        } else {
          // leave as-is (transparent areas will be flattened by JPEG anyway)
          ctx.clearRect(0,0,w,h);
        }

        ctx.drawImage(img, 0, 0);

        let quality = 0.9;
        if (qualityInput) {
          const q = parseFloat(qualityInput.value);
          if (!isNaN(q) && q >= 0.1 && q <= 1) quality = q;
        }

        canvas.toBlob((blob) => {
          if (!blob) { showError('Conversion failed.'); return; }
          const url = URL.createObjectURL(blob);
          if (previewImage) previewImage.src = url;
          if (resultSection) resultSection.classList.remove('hidden');

          const outName = (filenameInput && filenameInput.value && filenameInput.value.trim()) ? filenameInput.value.trim() : `${originalName}.jpg`;
          if (downloadBtn) {
            downloadBtn.onclick = () => {
              const a = document.createElement('a');
              a.href = url;
              a.download = outName.endsWith('.jpg') || outName.endsWith('.jpeg') ? outName : `${outName}.jpg`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 2000);
            };
          }

          if (metaInfo) metaInfo.innerText = `Converted: ${w}px × ${h}px • ${Math.round(blob.size/1024)} KB (approx)`;
        }, 'image/jpeg', quality);
      };
      img.onerror = (err) => {
        showError('Failed to load image for conversion.');
        console.error('Image load error', err);
      };
      img.src = originalDataUrl;
    });
  }

  if (resetBtn) resetBtn.addEventListener('click', clearState);

  // debug helpers
  window._ppt_pngtojpg_debug = { handleFile, clearState };
});

// webpconvert.js
document.addEventListener('DOMContentLoaded', () => {
  console.log("webpconvert.js running after DOMContentLoaded");

  const uploadBox = document.getElementById('uploadBox');
  const imageInput = document.getElementById('imageInput');
  const uploadError = document.getElementById('uploadError');
  const options = document.getElementById('options');
  const formatSelect = document.getElementById('formatSelect');
  const qualityInput = document.getElementById('qualityInput');
  const qualityRow = document.getElementById('qualityRow');
  const filenameInput = document.getElementById('filenameInput');
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
    if (msg) console.warn('WEBP convert error:', msg);
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

  // UI: show quality control only for jpeg
  function updateFormatUI() {
    const fmt = formatSelect ? formatSelect.value : 'image/png';
    if (qualityRow) qualityRow.style.display = fmt === 'image/jpeg' ? 'block' : 'none';
    if (filenameInput) {
      const ext = fmt === 'image/png' ? '.png' : '.jpg';
      if (!filenameInput.value) filenameInput.value = originalName + ext;
      else if (!filenameInput.value.endsWith(ext)) filenameInput.value = originalName + ext;
    }
  }

  formatSelect.addEventListener('change', updateFormatUI);

  // Click / keyboard to open file dialog
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
    if (!file.type.startsWith('image/')) { showError('Please upload an image file.'); return; }
    if (file.size > 40 * 1024 * 1024) { showError('File too large. Use < 40 MB.'); return; }

    originalName = (file.name && file.name.split('.').slice(0, -1).join('.')) || 'image';
    if (filenameInput) filenameInput.value = originalName;

    const reader = new FileReader();
    reader.onerror = (err) => { showError('Could not read file.'); console.error(err); };
    reader.onload = (ev) => {
      originalDataUrl = ev.target.result;
      if (options) options.classList.remove('hidden');
      if (resultSection) resultSection.classList.add('hidden');
      if (metaInfo) metaInfo.innerText = `Original: ${file.type} • ${Math.round(file.size/1024)} KB`;
      updateFormatUI();
    };
    reader.readAsDataURL(file);
  }

  // convert
  if (convertBtn) {
    convertBtn.addEventListener('click', () => {
      if (!originalDataUrl) { showError('Please upload an image first.'); return; }
      const fmt = formatSelect ? formatSelect.value : 'image/png';
      let quality = 0.9;
      if (fmt === 'image/jpeg' && qualityInput) {
        const q = parseFloat(qualityInput.value);
        if (!isNaN(q) && q >= 0.1 && q <= 1) quality = q;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        // For JPEG, fill white behind transparency
        if (fmt === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0,0,canvas.width,canvas.height);
        } else {
          ctx.clearRect(0,0,canvas.width,canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        // toBlob with correct mime and quality
        canvas.toBlob((blob) => {
          if (!blob) { showError('Conversion failed.'); return; }
          const url = URL.createObjectURL(blob);
          if (previewImage) previewImage.src = url;
          if (resultSection) resultSection.classList.remove('hidden');

          const ext = fmt === 'image/png' ? '.png' : '.jpg';
          const outName = (filenameInput && filenameInput.value && filenameInput.value.trim()) ? filenameInput.value.trim() : `${originalName}${ext}`;
          if (downloadBtn) {
            downloadBtn.onclick = () => {
              const a = document.createElement('a');
              a.href = url;
              a.download = outName.endsWith(ext) ? outName : `${outName}${ext}`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 2000);
            };
          }

          if (metaInfo) metaInfo.innerText = `Converted: ${img.width}px × ${img.height}px • ${Math.round(blob.size/1024)} KB (approx)`;
        }, fmt, fmt === 'image/jpeg' ? quality : undefined);

      };
      img.onerror = (err) => { showError('Failed to load image for conversion.'); console.error(err); };
      img.src = originalDataUrl;
    });
  }

  if (resetBtn) resetBtn.addEventListener('click', clearState);

  // debug
  window._ppt_webpconvert_debug = { handleFile, clearState };
});

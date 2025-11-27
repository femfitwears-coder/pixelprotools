// jpgtopng.js - robust version (paste whole file)
document.addEventListener('DOMContentLoaded', () => {
  console.log("jpgtopng.js running after DOMContentLoaded");

  const imageInput = document.getElementById('imageInput');
  const uploadBox = document.getElementById('uploadBox');
  const uploadText = document.getElementById('uploadText');
  const uploadError = document.getElementById('uploadError');
  const options = document.getElementById('options');
  const filenameInput = document.getElementById('filenameInput');
  const convertBtn = document.getElementById('convertBtn');
  const resetBtn = document.getElementById('resetBtn');

  const resultSection = document.getElementById('resultSection');
  const previewImage = document.getElementById('previewImage');
  const downloadBtn = document.getElementById('downloadBtn');
  const metaInfo = document.getElementById('metaInfo');

  // defensive checks
  if (!uploadBox || !imageInput) {
    console.error('Required elements not found. Check IDs in HTML (uploadBox, imageInput).');
    if (uploadError) uploadError.textContent = 'Internal error: required elements not found.';
    return;
  }

  let originalDataUrl = null;
  let originalName = 'image';

  // Utility
  function showError(msg) {
    if (!uploadError) return;
    uploadError.textContent = msg || '';
    uploadError.style.display = msg ? 'block' : 'none';
    if (msg) console.warn('Upload error:', msg);
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

  // Click to open file dialog
  uploadBox.addEventListener('click', () => imageInput.click());
  uploadBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') imageInput.click(); });

  // Drag & drop handlers
  uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.classList.add('drag');
  });
  uploadBox.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('drag');
  });
  uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('drag');
    const file = (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) || null;
    if (file) {
      // set files on input so browser sees it too
      try { imageInput.files = e.dataTransfer.files; } catch (err) { /* some browsers don't allow programmatic set - okay */ }
      handleFile(file);
    }
  });

  // Change event from file input
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      showError('No file selected.');
      return;
    }
    handleFile(file);
  });

  function handleFile(file) {
    showError('');
    if (!file || !file.type) {
      showError('Please upload a valid image file.');
      return;
    }
    // basic validation
    if (!file.type.startsWith('image/')) {
      showError('Please upload an image (JPG, PNG, WEBP, etc.).');
      return;
    }
    if (file.size > 30 * 1024 * 1024) { // 30 MB cap
      showError('File is too large. Please upload an image smaller than 30 MB.');
      return;
    }

    originalName = (file.name && file.name.split('.').slice(0, -1).join('.')) || 'image';
    if (filenameInput) filenameInput.value = `${originalName}.png`;

    const reader = new FileReader();

    reader.onerror = (err) => {
      showError('Failed to read the file. Try a different image or browser.');
      console.error('FileReader error:', err);
    };

    reader.onload = (ev) => {
      originalDataUrl = ev.target.result;
      console.log('File loaded, size (bytes):', file.size, 'type:', file.type);

      if (options) options.classList.remove('hidden');
      if (resultSection) resultSection.classList.add('hidden');
      if (metaInfo) metaInfo.innerText = `Original: ${file.type || 'image'} • ${Math.round(file.size/1024)} KB`;
      showError('');
    };

    try {
      reader.readAsDataURL(file);
    } catch (ex) {
      showError('Could not read file. This may be a browser restriction.');
      console.error('reader.readAsDataURL exception', ex);
    }
  }

  // Convert button
  if (convertBtn) {
    convertBtn.addEventListener('click', () => {
      if (!originalDataUrl) {
        showError('Please upload an image first.');
        return;
      }
      const img = new Image();
      img.onload = () => {
        // create canvas and convert
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) {
            showError('Conversion failed. Try another image.');
            return;
          }
          const url = URL.createObjectURL(blob);
          if (previewImage) previewImage.src = url;
          if (resultSection) resultSection.classList.remove('hidden');

          const outName = (filenameInput && filenameInput.value && filenameInput.value.trim()) ? filenameInput.value.trim() : `${originalName}.png`;
          if (downloadBtn) {
            downloadBtn.onclick = () => {
              const a = document.createElement('a');
              a.href = url;
              a.download = outName.endsWith('.png') ? outName : `${outName}.png`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 2000);
            };
          }

          if (metaInfo) metaInfo.innerText = `Converted: ${img.width}px × ${img.height}px • ${Math.round(blob.size/1024)} KB (approx)`;
        }, 'image/png');
      };
      img.onerror = (err) => {
        showError('Failed to load image for conversion.');
        console.error('Image onerror', err);
      };
      img.src = originalDataUrl;
    });
  }

  // Reset
  if (resetBtn) resetBtn.addEventListener('click', clearState);

  // Expose debug helpers if needed
  window._ppt_jpgtopng_debug = { handleFile, clearState };
});

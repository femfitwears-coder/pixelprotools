// croptool.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('croptool.js running');

  const uploadBox = document.getElementById('uploadBox');
  const imageInput = document.getElementById('imageInput');
  const uploadError = document.getElementById('uploadError');
  const cropInterface = document.getElementById('cropInterface');
  const imagePreview = document.getElementById('imagePreview');
  const aspectSelect = document.getElementById('aspectSelect');
  const cropBtn = document.getElementById('cropBtn');
  const getDataBtn = document.getElementById('getDataBtn');
  const outFilename = document.getElementById('outFilename');
  const smallPreview = document.getElementById('smallPreview');

  let cropper = null;
  let originalDataUrl = null;
  let originalName = 'image';

  function showError(msg) {
    if (!uploadError) return;
    uploadError.textContent = msg || '';
    uploadError.style.display = msg ? 'block' : 'none';
  }

  // upload handlers
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
    showError('');
    if (!file || !file.type || !file.type.startsWith('image/')) {
      showError('Please upload an image file.');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      showError('File too large. Use < 30 MB.');
      return;
    }
    originalName = (file.name && file.name.split('.').slice(0, -1).join('.')) || 'image';
    outFilename.value = `cropped-${originalName}.png`;

    const reader = new FileReader();
    reader.onload = (ev) => {
      originalDataUrl = ev.target.result;
      imagePreview.src = originalDataUrl;

      // destroy previous cropper if exists
      if (cropper) {
        cropper.destroy();
        cropper = null;
      }

      // wait image to load in DOM
      imagePreview.onload = () => {
        cropInterface.classList.remove('hidden');

        // init cropper
        cropper = new Cropper(imagePreview, {
          viewMode: 1,
          autoCropArea: 0.8,
          responsive: true,
          background: false,
        });

        // reset small preview area
        smallPreview.innerHTML = '';
      };
    };
    reader.onerror = () => showError('Failed to read file.');
    reader.readAsDataURL(file);
  }

  // aspect ratio change
  aspectSelect.addEventListener('change', () => {
    if (!cropper) return;
    const val = aspectSelect.value;
    if (val === 'NaN') {
      cropper.setAspectRatio(NaN);
    } else {
      // eval safe ratio like "16/9"
      const ratio = Number(eval(val));
      cropper.setAspectRatio(ratio);
    }
  });

  // Preview small cropped result
  getDataBtn.addEventListener('click', () => {
    if (!cropper) { showError('Please upload an image first.'); return; }
    const canvas = cropper.getCroppedCanvas({ imageSmoothingQuality: 'high' });
    if (!canvas) { showError('Crop failed.'); return; }
    smallPreview.innerHTML = '';
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/png');
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';
    smallPreview.appendChild(img);
  });

  // Crop and download
  cropBtn.addEventListener('click', () => {
    if (!cropper) { showError('Please upload an image first.'); return; }
    const filename = (outFilename.value && outFilename.value.trim()) ? outFilename.value.trim() : `cropped-${originalName}.png`;
    const canvas = cropper.getCroppedCanvas({ imageSmoothingQuality: 'high' });
    if (!canvas) { showError('Crop failed.'); return; }

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  });

  // expose destroy helper
  window._ppt_croptool = {
    destroy: () => { if (cropper) { cropper.destroy(); cropper = null; } }
  };
});

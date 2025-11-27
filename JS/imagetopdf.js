// imagetopdf.js
document.addEventListener('DOMContentLoaded', () => {
  console.log("imagetopdf.js running after DOMContentLoaded");

  const { jsPDF } = window.jspdf || {}; // jspdf UMD exposes window.jspdf
  if (!jsPDF) {
    console.error('jsPDF not loaded. Check CDN script tag.');
  }

  const uploadBox = document.getElementById('uploadBox');
  const imageInput = document.getElementById('imageInput');
  const uploadError = document.getElementById('uploadError');
  const filesList = document.getElementById('filesList');
  const thumbs = document.getElementById('thumbs');
  const makePdfBtn = document.getElementById('makePdfBtn');
  const clearBtn = document.getElementById('clearBtn');
  const pdfMeta = document.getElementById('pdfMeta');
  const resultSection = document.getElementById('resultSection');
  const pdfInfo = document.getElementById('pdfInfo');
  const downloadLink = document.getElementById('downloadLink');

  if (!uploadBox || !imageInput) {
    console.error('Required elements not found.');
    return;
  }

  let fileItems = []; // { file, dataUrl, width, height }

  function showError(msg) {
    if (!uploadError) return;
    uploadError.textContent = msg || '';
    uploadError.style.display = msg ? 'block' : 'none';
    if (msg) console.warn('Image->PDF error:', msg);
  }

  function clearAll() {
    fileItems = [];
    thumbs.innerHTML = '';
    filesList.classList.add('hidden');
    resultSection.classList.add('hidden');
    pdfMeta.innerText = '';
    imageInput.value = '';
    showError('');
  }

  // open file dialog
  uploadBox.addEventListener('click', () => imageInput.click());
  uploadBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') imageInput.click(); });

  // drag/drop
  uploadBox.addEventListener('dragover', e => { e.preventDefault(); uploadBox.classList.add('drag'); });
  uploadBox.addEventListener('dragleave', e => { e.preventDefault(); uploadBox.classList.remove('drag'); });
  uploadBox.addEventListener('drop', e => {
    e.preventDefault();
    uploadBox.classList.remove('drag');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) processFiles(files);
  });

  imageInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length) processFiles(files);
  });

  function processFiles(fileList) {
    showError('');
    const files = Array.from(fileList).slice(0, 20); // limit to 20 images for safety
    thumbs.innerHTML = '';
    fileItems = [];

    let loadedCount = 0;
    files.forEach((file, idx) => {
      if (!file.type || !file.type.startsWith('image/')) {
        showError('One or more files are not images. Only images allowed.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10 MB per image limit
        showError('Please upload images smaller than 10 MB each.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const img = new Image();
        img.onload = () => {
          fileItems.push({ file, dataUrl, width: img.width, height: img.height });
          const div = document.createElement('div');
          div.className = 'thumb';
          div.innerHTML = `<img src="${dataUrl}" alt="thumb"><div class="thumb-meta">${img.width}×${img.height}</div>`;
          thumbs.appendChild(div);
          loadedCount++;
          if (loadedCount === files.length) {
            filesList.classList.remove('hidden');
            pdfMeta.innerText = `${fileItems.length} images selected • Total approximate size: ${Math.round(files.reduce((s,f)=>s+f.size,0)/1024)} KB`;
          }
        };
        img.onerror = () => {
          showError('Could not load one of the images.');
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  makePdfBtn.addEventListener('click', async () => {
    if (!fileItems.length) { showError('No images selected.'); return; }
    if (!jsPDF) { showError('PDF library not loaded.'); return; }

    // Create PDF
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    // A4 size in pts: 595.28 x 841.89 (approx)
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < fileItems.length; i++) {
      const it = fileItems[i];
      // load image into an offscreen img element to calculate size
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // calculate fit inside A4 with margin
          const margin = 20;
          let w = img.width;
          let h = img.height;
          const scale = Math.min((pageW - margin*2) / w, (pageH - margin*2) / h, 1);
          w = w * scale;
          h = h * scale;
          const x = (pageW - w) / 2;
          const y = (pageH - h) / 2;

          pdf.addImage(img, 'JPEG', x, y, w, h);

          if (i < fileItems.length - 1) pdf.addPage();
          resolve();
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = it.dataUrl;
      });
    }

    // output blob & provide download link
    const arrayBuf = pdf.output('arraybuffer');
    const blob = new Blob([arrayBuf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = 'images.pdf';
    pdfInfo.innerText = `PDF ready — ${fileItems.length} pages`;
    resultSection.classList.remove('hidden');

    // cleanup: revoke object URL after some time when user downloads
    setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  });

  clearBtn.addEventListener('click', clearAll);

  // expose debug
  window._ppt_imagetopdf_debug = { clearAll, fileItems };
});

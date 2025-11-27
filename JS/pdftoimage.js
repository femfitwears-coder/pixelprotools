// pdftoimage.js
document.addEventListener('DOMContentLoaded', () => {
  console.log("pdftoimage.js running after DOMContentLoaded");

  const pdfInput = document.getElementById('pdfInput');
  const uploadBox = document.getElementById('uploadBox');
  const uploadError = document.getElementById('uploadError');
  const pagesList = document.getElementById('pagesList');
  const pagesThumbs = document.getElementById('pagesThumbs');
  const clearBtn = document.getElementById('clearBtn');
  const status = document.getElementById('status');

  if (!window['pdfjsLib']) {
    console.error('pdfjsLib not found. Check CDN include.');
    if (uploadError) uploadError.textContent = 'PDF library not loaded. Please check your internet connection.';
    return;
  }

  function showError(msg) {
    if (!uploadError) return;
    uploadError.textContent = msg || '';
    uploadError.style.display = msg ? 'block' : 'none';
    if (msg) console.warn('PDF->Image error:', msg);
  }

  function setStatus(msg) {
    if (!status) return;
    status.innerText = msg || '';
  }

  function clearAll() {
    pagesThumbs.innerHTML = '';
    pagesList.classList.add('hidden');
    setStatus('');
    pdfInput.value = '';
    showError('');
  }

  // file dialog / drag & drop
  uploadBox.addEventListener('click', () => pdfInput.click());
  uploadBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') pdfInput.click(); });
  uploadBox.addEventListener('dragover', (e) => { e.preventDefault(); uploadBox.classList.add('drag'); });
  uploadBox.addEventListener('dragleave', (e) => { e.preventDefault(); uploadBox.classList.remove('drag'); });
  uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('drag');
    const f = (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) || null;
    if (f) handleFile(f);
  });

  pdfInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
  });

  async function handleFile(file) {
    clearAll();
    showError('');
    setStatus('');

    if (!file || file.type !== 'application/pdf') {
      showError('Please upload a valid PDF file.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) { // 50 MB cap
      showError('File too large. Please use a PDF smaller than 50 MB.');
      return;
    }

    setStatus('Loading PDF...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = window['pdfjsLib'].getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      setStatus(`PDF loaded — ${numPages} page(s). Rendering pages...`);
      pagesThumbs.innerHTML = '';

      // limit pages to 30 to avoid locking browser
      const maxPages = Math.min(numPages, 30);
      for (let p = 1; p <= maxPages; p++) {
        setStatus(`Rendering page ${p} of ${maxPages}...`);
        const page = await pdf.getPage(p);

        // render at device pixel ratio for clearer images but scale down to reasonable width
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const renderContext = { canvasContext: context, viewport: viewport };
        await page.render(renderContext).promise;

        // create thumbnail container
        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'thumb';

        // convert canvas to blob (png)
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const url = URL.createObjectURL(blob);

        thumbWrap.innerHTML = `
          <img src="${url}" alt="page-${p}">
          <div class="thumb-meta">Page ${p}</div>
          <div style="margin-top:8px;">
            <a class="cta" href="${url}" download="${file.name.replace('.pdf','')}-page-${p}.png">Download PNG</a>
          </div>
        `;

        pagesThumbs.appendChild(thumbWrap);
      }

      if (numPages > 30) {
        const note = document.createElement('div');
        note.style.marginTop = '10px';
        note.style.color = '#666';
        note.innerText = `Only first 30 pages rendered to avoid browser overload.`;
        pagesThumbs.appendChild(note);
      }

      pagesList.classList.remove('hidden');
      setStatus('Done. Click "Download PNG" on each page to save.');
    } catch (err) {
      console.error('PDF render error:', err);
      showError('Failed to process PDF. Try a different file or smaller PDF.');
      setStatus('');
    }
  }

  clearBtn.addEventListener('click', clearAll);

  // expose debug
  window._ppt_pdftoimage_debug = { clearAll };
});

// colorpicker.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('colorpicker.js loaded');

  const uploadBox = document.getElementById('uploadBox');
  const imageInput = document.getElementById('imageInput');
  const uploadError = document.getElementById('uploadError');
  const pickerInterface = document.getElementById('pickerInterface');

  const canvas = document.getElementById('imageCanvas');
  const ctx = canvas.getContext('2d');

  const swatch = document.getElementById('swatch');
  const hexText = document.getElementById('hexText');
  const rgbText = document.getElementById('rgbText');
  const hslText = document.getElementById('hslText');
  const hexCoord = document.getElementById('hexCoord');
  const rgbCoord = document.getElementById('rgbCoord');
  const coords = document.getElementById('coords');

  const copyHex = document.getElementById('copyHex');
  const copyRgb = document.getElementById('copyRgb');
  const copyHsl = document.getElementById('copyHsl');
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');

  let img = new Image();
  let imgDataUrl = null;
  let locked = false;
  let lastSample = { r:255,g:255,b:255, x:0, y:0 };

  function showError(msg) {
    if (!uploadError) return;
    uploadError.textContent = msg || '';
    uploadError.style.display = msg ? 'block' : 'none';
  }

  // upload handling
  uploadBox.addEventListener('click', () => imageInput.click());
  uploadBox.addEventListener('dragover', (e) => { e.preventDefault(); uploadBox.classList.add('drag'); });
  uploadBox.addEventListener('dragleave', (e) => { e.preventDefault(); uploadBox.classList.remove('drag'); });
  uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('drag');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) { imageInput.files = e.dataTransfer.files; handleFile(f); }
  });

  imageInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
  });

  function handleFile(file) {
    showError('');
    if (!file || !file.type || !file.type.startsWith('image/')) { showError('Please upload an image file.'); return; }
    if (file.size > 30 * 1024 * 1024) { showError('Image too large. Use < 30 MB.'); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      imgDataUrl = ev.target.result;
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // resize canvas to fit container but keep natural ratio
        const maxW = 900; // cap width
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        pickerInterface.classList.remove('hidden');
        locked = false;
        lastSample = { r:255,g:255,b:255, x:0, y:0 };
        updateUIFromSample(lastSample);
      };
      img.onerror = () => showError('Failed to load image.');
      img.src = imgDataUrl;
    };
    reader.onerror = () => showError('Could not read file.');
    reader.readAsDataURL(file);
  }

  // helper: get pixel at canvas coords
  function sampleAt(x, y) {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x >= canvas.width) x = canvas.width - 1;
    if (y >= canvas.height) y = canvas.height - 1;
    const d = ctx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3], x, y };
  }

  // convert helpers
  function rgbToHex(r,g,b) {
    return "#" + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  function rgbToHsl(r,g,b) {
    r/=255; g/=255; b/=255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h=0, s=0, l=(max+min)/2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      switch(max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
  }

  function updateUIFromSample(s) {
    const hex = rgbToHex(s.r,s.g,s.b);
    const hsl = rgbToHsl(s.r,s.g,s.b);
    swatch.style.background = hex;
    hexText.textContent = hex;
    rgbText.textContent = `rgb(${s.r}, ${s.g}, ${s.b})`;
    hslText.textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    hexCoord.textContent = hex;
    rgbCoord.textContent = `${s.r},${s.g},${s.b}`;
    coords.textContent = `x:${s.x} y:${s.y}`;
  }

  // mouse move preview
  canvas.addEventListener('mousemove', (e) => {
    if (!imgDataUrl || locked) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left));
    const y = Math.floor((e.clientY - rect.top));
    const s = sampleAt(x,y);
    updateUIFromSample(s);
  });

  // click to lock sample
  canvas.addEventListener('click', (e) => {
    if (!imgDataUrl) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left));
    const y = Math.floor((e.clientY - rect.top));
    const s = sampleAt(x,y);
    locked = true;
    lastSample = s;
    updateUIFromSample(s);
  });

  // double-click to unlock
  canvas.addEventListener('dblclick', () => { locked = false; });

  // copy handlers
  async function copyToClipboard(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(()=> btn.textContent = old, 900);
    } catch (e) {
      showError('Copy failed. Use manual copy.');
    }
  }
  copyHex.addEventListener('click', () => copyToClipboard(hexCoord.textContent, copyHex));
  copyRgb.addEventListener('click', () => copyToClipboard(rgbCoord.textContent, copyRgb));
  copyHsl.addEventListener('click', () => copyToClipboard(hslText.textContent, copyHsl));

  // download sample as small PNG
  downloadBtn.addEventListener('click', () => {
    const s = lastSample || sampleAt(0,0);
    // create tiny canvas filled with sampled color
    const c = document.createElement('canvas');
    c.width = 200; c.height = 200;
    const cctx = c.getContext('2d');
    cctx.fillStyle = rgbToHex(s.r,s.g,s.b);
    cctx.fillRect(0,0,c.width,c.height);
    c.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${hexCoord.textContent.replace('#','')}-sample.png`;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  });

  // reset
  resetBtn.addEventListener('click', () => {
    pickerInterface.classList.add('hidden');
    canvas.width = 0; canvas.height = 0;
    imageInput.value = '';
    imgDataUrl = null;
    showError('');
  });

  // keyboard: Esc to reset locked state
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') locked = false;
  });

  // expose debug
  window._ppt_colorpicker = { sampleAt, updateUIFromSample };
});

// resizer.js
const imageInput = document.getElementById('imageInput');
const uploadBox = document.getElementById('uploadBox');
const controls = document.getElementById('controls');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const keepAspect = document.getElementById('keepAspect');
const resizeBtn = document.getElementById('resizeBtn');
const resetBtn = document.getElementById('resetBtn');

const resultSection = document.getElementById('resultSection');
const previewImage = document.getElementById('previewImage');
const downloadBtn = document.getElementById('downloadBtn');
const metaInfo = document.getElementById('metaInfo');

let originalImg = new Image();
let originalDataUrl = null;
let origW = 0, origH = 0;

imageInput.addEventListener('change', handleFile);
uploadBox.addEventListener('click', () => imageInput.click());
uploadBox.addEventListener('dragover', e => { e.preventDefault(); uploadBox.classList.add('drag'); });
uploadBox.addEventListener('dragleave', e => { e.preventDefault(); uploadBox.classList.remove('drag'); });
uploadBox.addEventListener('drop', e => {
  e.preventDefault();
  uploadBox.classList.remove('drag');
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) {
    imageInput.files = e.dataTransfer.files;
    handleFile();
  }
});

function handleFile() {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    originalDataUrl = e.target.result;
    originalImg = new Image();
    originalImg.onload = () => {
      origW = originalImg.width;
      origH = originalImg.height;
      // populate inputs
      widthInput.value = origW;
      heightInput.value = origH;
      controls.classList.remove('hidden');
      resultSection.classList.add('hidden');
      metaInfo.innerText = `Original: ${origW}px × ${origH}px • ${Math.round(file.size/1024)} KB`;
    };
    originalImg.src = originalDataUrl;
  };
  reader.readAsDataURL(file);
}

// keep aspect ratio logic
widthInput.addEventListener('input', () => {
  if (keepAspect.checked && originalImg.width) {
    const newW = Number(widthInput.value) || origW;
    const ratio = newW / origW;
    heightInput.value = Math.round(origH * ratio);
  }
});
heightInput.addEventListener('input', () => {
  if (keepAspect.checked && originalImg.width) {
    const newH = Number(heightInput.value) || origH;
    const ratio = newH / origH;
    widthInput.value = Math.round(origW * ratio);
  }
});

resizeBtn.addEventListener('click', () => {
  const w = Math.max(1, Math.floor(Number(widthInput.value) || origW));
  const h = Math.max(1, Math.floor(Number(heightInput.value) || origH));

  // create canvas and draw
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // for better quality downscaling, use drawImage with smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(originalImg, 0, 0, w, h);

  const mime = 'image/jpeg'; // export as jpeg for smaller size; you can detect original type if needed
  const dataUrl = canvas.toDataURL(mime, 0.9); // quality 0.9

  previewImage.src = dataUrl;
  resultSection.classList.remove('hidden');
  metaInfo.innerText = `Resized: ${w}px × ${h}px • ${(Math.round((dataUrl.length * (3/4))/1024))} KB (approx)`;

  downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `resized-${w}x${h}.jpg`;
    link.click();
  };
});

resetBtn.addEventListener('click', () => {
  controls.classList.add('hidden');
  resultSection.classList.add('hidden');
  imageInput.value = '';
  originalImg = new Image();
  originalDataUrl = null;
});

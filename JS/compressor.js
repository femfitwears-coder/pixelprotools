// /js/compressor.js - universal image tool binding
document.addEventListener('DOMContentLoaded', () => {
  const toolContainers = Array.from(document.querySelectorAll('[data-image-tool], .image-tool'));
  const directInputs = Array.from(document.querySelectorAll('input[type="file"][data-image-input]'));
  directInputs.forEach(inp => { if (!toolContainers.find(c => c.contains(inp))) toolContainers.push(inp); });

  if (!toolContainers.length) return;

  toolContainers.forEach(container => {
    const isInput = container.tagName === 'INPUT' && container.type === 'file';
    const fileInput = isInput ? container : container.querySelector('input[type="file"]');
    if (!fileInput) return;

    let previewWrap = container.querySelector('.preview-wrap');
    if (!previewWrap) {
      previewWrap = document.createElement('div');
      previewWrap.className = 'preview-wrap';
      fileInput.insertAdjacentElement('afterend', previewWrap);
    }
    let qualityRange = container.querySelector('input[type="range"].quality') || container.querySelector('[data-quality]');
    if (!qualityRange) {
      qualityRange = document.createElement('input');
      qualityRange.type = 'range';
      qualityRange.min = 0.1; qualityRange.max = 1; qualityRange.step = 0.05; qualityRange.value = 0.8;
      qualityRange.className = 'quality';
      previewWrap.insertAdjacentElement('afterend', qualityRange);
    }
    let compressBtn = container.querySelector('button.compress-btn') || container.querySelector('[data-compress-btn]');
    if (!compressBtn) {
      compressBtn = document.createElement('button');
      compressBtn.className = 'compress-btn cta';
      compressBtn.textContent = 'Compress / Convert';
      qualityRange.insertAdjacentElement('afterend', compressBtn);
    }
    let downloadLink = container.querySelector('a.download-link') || container.querySelector('[data-download]');
    if (!downloadLink) {
      downloadLink = document.createElement('a');
      downloadLink.className = 'download-link outline';
      downloadLink.style.display = 'none';
      downloadLink.textContent = 'Download';
      compressBtn.insertAdjacentElement('afterend', downloadLink);
    }
    let msg = container.querySelector('.tool-msg') || container.querySelector('[data-msg]');
    if (!msg) {
      msg = document.createElement('div');
      msg.className = 'tool-msg';
      msg.style.marginTop = '10px';
      compressBtn.insertAdjacentElement('afterend', msg);
    }

    let currentFile = null;
    let currentImg = null;

    function clearPreview(){
      previewWrap.innerHTML = '';
      downloadLink.style.display = 'none';
      msg.textContent = '';
      currentFile = null; currentImg = null;
    }

    fileInput.addEventListener('change', (e)=>{
      clearPreview();
      const f = (e.target.files && e.target.files[0]) || null;
      if(!f) return;
      if(!f.type.startsWith('image/')) {
        msg.textContent = 'Please upload an image file.';
        return;
      }
      currentFile = f;
      const url = URL.createObjectURL(f);
      const img = document.createElement('img');
      img.style.maxWidth = '100%';
      img.style.maxHeight = '420px';
      img.alt = f.name;
      previewWrap.appendChild(img);
      img.onload = () => { URL.revokeObjectURL(url); };
      img.onerror = () => { msg.textContent = 'Unable to load image.'; };
      img.src = url;
      currentImg = img;
    });

    function compressImage(imgElement, quality=0.8, outputType='image/jpeg', maxDim=2000) {
      return new Promise((resolve,reject)=>{
        try{
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          let w = imgElement.naturalWidth, h = imgElement.naturalHeight;
          const ratio = Math.min(1, maxDim / Math.max(w,h));
          w = Math.round(w * ratio); h = Math.round(h * ratio);
          canvas.width = w; canvas.height = h;
          ctx.drawImage(imgElement,0,0,w,h);
          if (!canvas.toBlob) {
            const data = canvas.toDataURL(outputType, quality);
            const bin = atob(data.split(',')[1]);
            const arr = new Uint8Array(bin.length);
            for (let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
            resolve(new Blob([arr], {type: outputType}));
            return;
          }
          canvas.toBlob((blob)=> {
            if(!blob) reject(new Error('Compression failed'));
            else resolve(blob);
          }, outputType, quality);
        } catch(err){ reject(err); }
      });
    }

    compressBtn.addEventListener('click', async ()=>{
      msg.textContent = '';
      if(!currentImg){ msg.textContent = 'Please upload an image first.'; return; }
      compressBtn.disabled = true; compressBtn.textContent = 'Processing...';
      const qual = Number(qualityRange.value) || 0.8;
      let outType = currentFile.type || 'image/jpeg';
      try {
        const blob = await compressImage(currentImg, qual, outType, 2000);
        const sizeKB = Math.round(blob.size/1024);
        msg.textContent = `Done — ${sizeKB} KB.`;
        const blobUrl = URL.createObjectURL(blob);
        downloadLink.href = blobUrl;
        const ext = outType.includes('png') ? 'png' : outType.includes('webp') ? 'webp' : 'jpg';
        downloadLink.download = (currentFile.name.replace(/\.[^/.]+$/,'') || 'image') + `-compressed.${ext}`;
        downloadLink.style.display = 'inline-block';
      } catch(err){
        console.error(err);
        msg.textContent = 'Error: ' + (err.message || err);
      } finally {
        compressBtn.disabled = false; compressBtn.textContent = 'Compress / Convert';
      }
    });

    previewWrap.addEventListener('dblclick', clearPreview);
  });
});

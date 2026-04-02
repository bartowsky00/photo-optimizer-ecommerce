/* ── State ─────────────────────────────────────────────────── */
let files = [];
let currentJobId = null;
let pollInterval = null;

/* ── DOM refs ──────────────────────────────────────────────── */
const dropzone        = document.getElementById('dropzone');
const fileInput       = document.getElementById('fileInput');
const fileList        = document.getElementById('fileList');
const fileCount       = document.getElementById('fileCount');
const uploadActions   = document.getElementById('uploadActions');
const clearBtn        = document.getElementById('clearBtn');
const processBtn      = document.getElementById('processBtn');
const processBtnText  = document.getElementById('processBtnText');
const progressWrap    = document.getElementById('progressWrap');
const progressBar     = document.getElementById('progressBar');
const progressLabel   = document.getElementById('progressLabel');
const progressCount   = document.getElementById('progressCount');
const downloadWrap    = document.getElementById('downloadWrap');
const downloadBtn     = document.getElementById('downloadBtn');
const successSub      = document.getElementById('successSub');
const newBatchBtn     = document.getElementById('newBatchBtn');
const resetSettings   = document.getElementById('resetSettings');

/* ── Sliders ───────────────────────────────────────────────── */
const sliders = [
  { id: 'webp_quality',        valId: 'val-quality',    format: v => v },
  { id: 'brightness',          valId: 'val-brightness', format: v => (v / 100).toFixed(1) },
  { id: 'contrast',            valId: 'val-contrast',   format: v => (v / 100).toFixed(1) },
  { id: 'saturation',          valId: 'val-saturation', format: v => (v / 100).toFixed(1) },
  { id: 'sharpness',           valId: 'val-sharpness',  format: v => (v / 100).toFixed(1) },
  { id: 'reflection_strength', valId: 'val-reflection', format: v => v + '%' },
];

sliders.forEach(({ id, valId, format }) => {
  const el  = document.getElementById(id);
  const val = document.getElementById(valId);
  if (!el || !val) return;
  el.addEventListener('input', () => { val.textContent = format(el.value); });
});

/* ── Toggles ───────────────────────────────────────────────── */
const toggleCards = document.querySelectorAll('.toggle-card');
toggleCards.forEach(card => {
  const cb = card.querySelector('input[type=checkbox]');
  cb.addEventListener('change', () => {
    card.classList.toggle('active', cb.checked);
  });
});

// Show/hide reflection strength slider
document.getElementById('reduce_reflections').addEventListener('change', function () {
  document.getElementById('reflectionStrengthGroup').style.display = this.checked ? 'block' : 'none';
});

/* ── Reset settings ─────────────────────────────────────────── */
resetSettings.addEventListener('click', () => {
  document.getElementById('webp_quality').value  = 85;
  document.getElementById('brightness').value    = 100;
  document.getElementById('contrast').value      = 100;
  document.getElementById('saturation').value    = 100;
  document.getElementById('sharpness').value     = 100;
  document.getElementById('reflection_strength').value = 50;
  sliders.forEach(({ id, valId, format }) => {
    const el  = document.getElementById(id);
    const val = document.getElementById(valId);
    if (el && val) val.textContent = format(el.value);
  });
  ['auto_enhance', 'white_balance', 'reduce_reflections'].forEach(id => {
    const cb   = document.getElementById(id);
    const card = cb.closest('.toggle-card');
    cb.checked = false;
    card.classList.remove('active');
  });
  document.getElementById('reflectionStrengthGroup').style.display = 'none';
});

/* ── File handling ──────────────────────────────────────────── */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function addFiles(newFiles) {
  const remaining = 50 - files.length;
  const toAdd = Array.from(newFiles).slice(0, remaining);
  toAdd.forEach(f => {
    if (!files.find(x => x.name === f.name && x.size === f.size)) {
      files.push(f);
    }
  });
  renderFileList();
}

function removeFile(index) {
  files.splice(index, 1);
  renderFileList();
}

function renderFileList() {
  fileList.innerHTML = '';
  fileCount.textContent = `${files.length} / 50`;
  uploadActions.style.display = files.length > 0 ? 'flex' : 'none';
  processBtn.disabled = files.length === 0;

  files.forEach((f, i) => {
    const li = document.createElement('li');
    li.className = 'file-item';

    const thumb = document.createElement('img');
    thumb.className = 'file-thumb';
    thumb.alt = f.name;
    const url = URL.createObjectURL(f);
    thumb.src = url;
    thumb.onload = () => URL.revokeObjectURL(url);

    const info = document.createElement('div');
    info.className = 'file-info';
    info.innerHTML = `<div class="file-name">${f.name}</div><div class="file-size">${formatSize(f.size)}</div>`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Rimuovi';
    removeBtn.addEventListener('click', () => removeFile(i));

    li.append(thumb, info, removeBtn);
    fileList.appendChild(li);
  });
}

/* ── Drag & Drop ────────────────────────────────────────────── */
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => addFiles(fileInput.files));

dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  addFiles(e.dataTransfer.files);
});

clearBtn.addEventListener('click', () => { files = []; renderFileList(); });

/* ── Process ─────────────────────────────────────────────────── */
processBtn.addEventListener('click', startProcessing);

async function startProcessing() {
  if (files.length === 0) return;

  setProcessingUI(true);

  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('webp_quality',          document.getElementById('webp_quality').value);
  formData.append('brightness',            (document.getElementById('brightness').value / 100).toFixed(2));
  formData.append('contrast',              (document.getElementById('contrast').value / 100).toFixed(2));
  formData.append('saturation',            (document.getElementById('saturation').value / 100).toFixed(2));
  formData.append('sharpness',             (document.getElementById('sharpness').value / 100).toFixed(2));
  formData.append('auto_enhance',          document.getElementById('auto_enhance').checked);
  formData.append('white_balance',         document.getElementById('white_balance').checked);
  formData.append('reduce_reflections',    document.getElementById('reduce_reflections').checked);
  formData.append('reflection_strength',   (document.getElementById('reflection_strength').value / 100).toFixed(2));

  try {
    const res  = await fetch('/process', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Errore server');
    currentJobId = data.job_id;
    startPolling(files.length);
  } catch (err) {
    alert('Errore: ' + err.message);
    setProcessingUI(false);
  }
}

function startPolling(total) {
  progressBar.style.width = '0%';
  progressCount.textContent = `0 / ${total}`;
  progressLabel.textContent = 'Elaborazione in corso...';

  pollInterval = setInterval(async () => {
    try {
      const res  = await fetch(`/progress/${currentJobId}`);
      const data = await res.json();

      const pct = Math.round((data.progress / data.total) * 100);
      progressBar.style.width = pct + '%';
      progressCount.textContent = `${data.progress} / ${data.total}`;

      if (data.status === 'done') {
        clearInterval(pollInterval);
        showDownload(data.total);
      } else if (data.status === 'error') {
        clearInterval(pollInterval);
        alert('Errore durante l\'elaborazione: ' + (data.error || 'sconosciuto'));
        setProcessingUI(false);
      }
    } catch (e) {
      clearInterval(pollInterval);
      setProcessingUI(false);
    }
  }, 600);
}

function showDownload(total) {
  progressWrap.style.display = 'none';
  downloadWrap.style.display = 'flex';
  downloadBtn.href = `/download/${currentJobId}`;
  successSub.textContent = `${total} foto convertite in WebP`;
  processBtnText.textContent = 'Elabora foto';
  processBtn.disabled = false;
}

function setProcessingUI(processing) {
  processBtn.disabled = processing;
  processBtnText.textContent = processing ? 'Elaborazione...' : 'Elabora foto';
  progressWrap.style.display  = processing ? 'block' : 'none';
  downloadWrap.style.display  = 'none';
}

/* ── New batch ──────────────────────────────────────────────── */
newBatchBtn.addEventListener('click', async () => {
  if (currentJobId) {
    fetch(`/job/${currentJobId}`, { method: 'DELETE' }).catch(() => {});
    currentJobId = null;
  }
  files = [];
  renderFileList();
  downloadWrap.style.display = 'none';
  progressWrap.style.display = 'none';
});

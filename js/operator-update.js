// ==========================================
// OPERATOR UPDATE - DMS, Insurance and RTO (Vahan)
// HSRP sheet is the master. Each save is mirrored into the matching Data-sheet row by the server.
// ==========================================

let currentUser = null;
let opRows = [];           // vehicles currently loaded (a month, or search results)
let activeCard = 'all';    // dashboard card used as list filter
let searchMode = false;    // true while showing search results
const MAX_SELECT = 20;

document.addEventListener('DOMContentLoaded', async function () {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  currentUser = session.user;
  if (currentUser.role !== 'operator' && currentUser.role !== 'admin') {
    alert('Access denied. This page is only for Operator and Admin users.');
    window.location.href = 'home.html';
    return;
  }
  document.getElementById('currentUser').textContent = (currentUser.name || '') + ' (' + currentUser.role + ')';
  document.getElementById('opName').textContent = currentUser.name || '';

  initMonthYear();
  document.getElementById('bulkDate').value = _yesterdayISO();
  document.getElementById('searchBox').addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
  await loadMonth();
});

// ---------- helpers ----------
function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function _iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function _yesterdayISO() { const d = new Date(); d.setDate(d.getDate() - 1); return _iso(d); }
function _todayISO() { return _iso(new Date()); }

function _fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return iso || '';
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return m[3] + '-' + names[parseInt(m[2], 10) - 1] + '-' + m[1];
}

let _toastTimer = null;
function toast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (type === 'error' ? 'err' : 'ok');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = 'toast'; }, 5000);
}

function initMonthYear() {
  const now = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const ms = document.getElementById('dashMonth');
  months.forEach((m, i) => {
    const o = document.createElement('option'); o.value = i + 1; o.textContent = m;
    if (i === now.getMonth()) o.selected = true;
    ms.appendChild(o);
  });
  const ys = document.getElementById('dashYear');
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
    const o = document.createElement('option'); o.value = y; o.textContent = y;
    if (y === now.getFullYear()) o.selected = true;
    ys.appendChild(o);
  }
}

// stage state of a vehicle
function stageState(r) {
  return {
    dms: !!r.dmsOperator,
    ins: r.insuranceStatus === 'Yes',
    vah: r.vahanStatus === 'Yes'
  };
}

// ---------- data loading ----------
async function loadMonth() {
  searchMode = false;
  document.getElementById('searchBox').value = '';
  const month = document.getElementById('dashYear').value + '-' + String(document.getElementById('dashMonth').value).padStart(2, '0');
  await fetchRows(month, '');
}

async function runSearch() {
  const q = document.getElementById('searchBox').value.trim();
  if (!q) { await loadMonth(); return; }
  searchMode = true;
  await fetchRows('', q);
}

async function clearSearch() {
  document.getElementById('searchBox').value = '';
  await loadMonth();
}

async function fetchRows(month, query) {
  document.getElementById('opBody').innerHTML = '<tr><td colspan="12" class="empty">⏳ Loading…</td></tr>';
  try {
    const r = await API.getOperatorHsrpData(month, query);
    if (!r.success) { document.getElementById('opBody').innerHTML = '<tr><td colspan="12" class="empty">' + esc(r.message || 'Error loading data') + '</td></tr>'; return; }
    opRows = r.rows || [];
    clearSelection(true);
    renderAll();
  } catch (e) {
    document.getElementById('opBody').innerHTML = '<tr><td colspan="12" class="empty">Error: ' + esc(e.message) + '</td></tr>';
  }
}

// ---------- dashboard + list ----------
function renderAll() {
  renderDashboard();
  renderList();
}

function renderDashboard() {
  const total = opRows.length;
  let dmsDone = 0, insDone = 0, vahDone = 0, allDone = 0;
  opRows.forEach(r => {
    const s = stageState(r);
    if (s.dms) dmsDone++; if (s.ins) insDone++; if (s.vah) vahDone++;
    if (s.dms && s.ins && s.vah) allDone++;
  });
  const cards = [
    { key: 'all',  cls: 'c-all',  count: total,           label: '📋 Vehicles',          sub: searchMode ? 'search results' : 'this month' },
    { key: 'dms',  cls: 'c-dms',  count: total - dmsDone, label: '🖥️ DMS Pending',       sub: dmsDone + ' done' },
    { key: 'ins',  cls: 'c-ins',  count: total - insDone, label: '🛡️ Insurance Pending', sub: insDone + ' done' },
    { key: 'vah',  cls: 'c-rto',  count: total - vahDone, label: '📑 RTO Pending',       sub: vahDone + ' done' },
    { key: 'done', cls: 'c-done', count: allDone,         label: '✅ Completed',         sub: 'DMS + Insurance + RTO' }
  ];
  document.getElementById('dashCards').innerHTML = cards.map(c =>
    '<div class="dash-card ' + c.cls + (activeCard === c.key ? ' active' : '') + '" onclick="setCard(\'' + c.key + '\')">' +
    '<div class="dash-count">' + c.count + '</div><div class="dash-label">' + c.label + '</div><div class="dash-sub">' + c.sub + '</div></div>').join('');
}

function setCard(key) { activeCard = key; renderAll(); }

function visibleRows() {
  return opRows.filter(r => {
    const s = stageState(r);
    if (activeCard === 'dms') return !s.dms;
    if (activeCard === 'ins') return !s.ins;
    if (activeCard === 'vah') return !s.vah;
    if (activeCard === 'done') return s.dms && s.ins && s.vah;
    return true;
  });
}

function stageCell(done, text, who) {
  return done ? '<div class="stage ok">✔ ' + esc(text) + (who ? '<div class="who-name">' + esc(who) + '</div>' : '') + '</div>'
              : '<div class="stage pend">Pending</div>';
}

function renderList() {
  const rows = visibleRows();
  const labels = { all: 'All vehicles', dms: 'DMS pending', ins: 'Insurance pending', vah: 'RTO pending', done: 'Completed' };
  document.getElementById('filterLabel').textContent = '📌 ' + labels[activeCard] + ' · ' + rows.length + ' record' + (rows.length === 1 ? '' : 's') + (searchMode ? ' (search, all months)' : '');

  const body = document.getElementById('opBody');
  if (rows.length === 0) { body.innerHTML = '<tr><td colspan="12" class="empty">No records</td></tr>'; updateBulkBar(); return; }

  const isAdmin = currentUser.role === 'admin';
  body.innerHTML = rows.map(r => {
    const s = stageState(r);
    const complete = s.dms && s.ins && s.vah;
    return '<tr class="' + (complete ? 'done-row' : '') + '">' +
      '<td><input type="checkbox" class="row-cb" value="' + esc(r.srNo) + '"' + (complete ? ' disabled' : '') + ' onchange="onRowSelect(this)"></td>' +
      '<td style="white-space:nowrap;font-weight:700;">' + esc(r.invoiceNo) + '</td>' +
      '<td style="white-space:nowrap;">' + esc(_fmtDate(r.invoiceDate)) + '</td>' +
      '<td>' + esc(r.customerName) + '</td>' +
      '<td style="white-space:nowrap;">' + esc(r.mobileNo) + '</td>' +
      '<td>' + esc(r.modelName) + '</td>' +
      '<td style="font-family:monospace;font-size:12px;">' + esc(r.frameNo) + '</td>' +
      '<td>' + esc(r.refCustomer) + '</td>' +
      '<td>' + stageCell(s.dms, 'DMS', r.dmsOperator) + '</td>' +
      '<td>' + stageCell(s.ins, _fmtDate(r.insuranceDate) || 'Done', r.insuranceOperator) + '</td>' +
      '<td>' + stageCell(s.vah, _fmtDate(r.vahanDate) || 'Done', r.vahanOperator) + '</td>' +
      '<td style="white-space:nowrap;">' +
        (complete ? '' : '<button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="openUpdate(\'' + esc(r.srNo) + '\')">Update</button> ') +
        (isAdmin && (s.dms || s.ins || s.vah) ? '<button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" onclick="openUndo(\'' + esc(r.srNo) + '\')">Undo</button>' : '') +
      '</td></tr>';
  }).join('');
  document.getElementById('selectAll').checked = false;
  updateBulkBar();
}

// ---------- selection + bulk ----------
function selectedIds() { return Array.from(document.querySelectorAll('.row-cb:checked')).map(cb => cb.value); }

function updateBulkBar() {
  const n = selectedIds().length;
  document.getElementById('bulkCount').textContent = n + ' selected';
  const any = document.getElementById('bulkDms').checked || document.getElementById('bulkIns').checked || document.getElementById('bulkVah').checked;
  document.getElementById('bulkApplyBtn').disabled = n === 0 || !any;
}

function onRowSelect(cb) {
  if (cb.checked && selectedIds().length > MAX_SELECT) { cb.checked = false; toast('You can select a maximum of ' + MAX_SELECT + ' vehicles at once.', 'error'); }
  updateBulkBar();
}

function toggleSelectAll(master) {
  const boxes = Array.from(document.querySelectorAll('.row-cb:not(:disabled)'));
  if (!master.checked) { boxes.forEach(cb => { cb.checked = false; }); }
  else {
    boxes.forEach((cb, i) => { cb.checked = i < MAX_SELECT; });
    if (boxes.length > MAX_SELECT) { toast('Selected the first ' + MAX_SELECT + ' (maximum per update).', 'error'); master.checked = false; }
  }
  updateBulkBar();
}

function clearSelection(silent) {
  document.querySelectorAll('.row-cb').forEach(cb => { cb.checked = false; });
  const sa = document.getElementById('selectAll'); if (sa) sa.checked = false;
  updateBulkBar();
}

function onBulkStageChange() {
  const needsDate = document.getElementById('bulkIns').checked || document.getElementById('bulkVah').checked;
  document.getElementById('bulkDateWrap').style.display = needsDate ? 'inline' : 'none';
  updateBulkBar();
}

function _summarise(results) {
  let updated = 0; const skipped = []; const notMirrored = [];
  results.forEach(r => {
    if (r.done && r.done.length) updated++;
    if (r.skipped && r.skipped.length) skipped.push((r.customerName || r.srNo) + ': ' + r.skipped.join(', '));
    if (r.done && r.done.length && r.mirror && r.mirror.indexOf('Also saved') !== 0) notMirrored.push((r.customerName || r.srNo) + ' — ' + r.mirror);
  });
  let msg = updated + ' vehicle' + (updated === 1 ? '' : 's') + ' updated.';
  if (skipped.length) msg += '\n\nSkipped (' + skipped.length + '):\n' + skipped.slice(0, 8).join('\n') + (skipped.length > 8 ? '\n…' : '');
  if (notMirrored.length) msg += '\n\nSaved in HSRP but not in the Data sheet (' + notMirrored.length + '):\n' + notMirrored.slice(0, 8).join('\n') + (notMirrored.length > 8 ? '\n…' : '');
  return msg;
}

async function applyBulk() {
  const ids = selectedIds();
  const stages = { dms: document.getElementById('bulkDms').checked, insurance: document.getElementById('bulkIns').checked, vahan: document.getElementById('bulkVah').checked };
  if (!ids.length) { toast('Select at least one vehicle', 'error'); return; }
  if (!stages.dms && !stages.insurance && !stages.vahan) { toast('Tick DMS, Insurance and/or RTO', 'error'); return; }
  const date = document.getElementById('bulkDate').value;
  if ((stages.insurance || stages.vahan) && !date) { toast('Pick the date', 'error'); return; }
  if (date && date > _todayISO()) { toast('Date cannot be in the future', 'error'); return; }

  const names = [stages.dms ? 'DMS' : '', stages.insurance ? 'Insurance' : '', stages.vahan ? 'RTO' : ''].filter(Boolean).join(' + ');
  if (!confirm('Mark ' + names + ' done for ' + ids.length + ' vehicle' + (ids.length === 1 ? '' : 's') +
      ((stages.insurance || stages.vahan) ? ' with date ' + _fmtDate(date) : '') + '?\n\nIt will be saved under your name (' + (currentUser.name || '') + ').\nInsurance and RTO cannot be changed afterwards.')) return;

  const btn = document.getElementById('bulkApplyBtn');
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1'; btn.disabled = true; const old = btn.textContent; btn.textContent = '⏳ Saving…';
  try {
    const r = await API.applyOperatorStages(ids, stages, date);
    if (!r.success) { alert('Error: ' + (r.message || 'Save failed')); return; }
    alert(_summarise(r.results || []));
    await refreshCurrent();
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    delete btn.dataset.busy; btn.textContent = old; updateBulkBar();
  }
}

async function refreshCurrent() {
  if (searchMode) await runSearch(); else await loadMonth();
}

// ---------- single update ----------
let updTarget = null;

function openUpdate(srNo) {
  const r = opRows.find(x => String(x.srNo) === String(srNo));
  if (!r) return;
  updTarget = r;
  const s = stageState(r);
  document.getElementById('updTitle').textContent = 'Update — ' + (r.customerName || r.invoiceNo);
  document.getElementById('updInfo').textContent = 'Invoice ' + r.invoiceNo + ' · ' + (r.modelName || '') + ' · ' + (r.frameNo || '');

  const setOpt = (id, noteId, done, note, allowed, blockedNote) => {
    const cb = document.getElementById(id);
    cb.checked = false;
    cb.disabled = done || !allowed;
    document.getElementById(noteId).textContent = done ? '— done' + (note ? ' (' + note + ')' : '') : (allowed ? '' : '— ' + blockedNote);
  };
  setOpt('updDms', 'updDmsNote', s.dms, r.dmsOperator, true, '');
  setOpt('updIns', 'updInsNote', s.ins, (_fmtDate(r.insuranceDate) + ' ' + (r.insuranceOperator || '')).trim(), true, '');
  setOpt('updVah', 'updVahNote', s.vah, (_fmtDate(r.vahanDate) + ' ' + (r.vahanOperator || '')).trim(), true, '');
  document.getElementById('updDate').value = _yesterdayISO();
  document.getElementById('updateModal').classList.add('show');
}

async function saveSingle() {
  if (!updTarget) return;
  const stages = { dms: document.getElementById('updDms').checked, insurance: document.getElementById('updIns').checked, vahan: document.getElementById('updVah').checked };
  if (!stages.dms && !stages.insurance && !stages.vahan) { toast('Tick at least one stage', 'error'); return; }
  const date = document.getElementById('updDate').value;
  if ((stages.insurance || stages.vahan) && !date) { toast('Pick the date', 'error'); return; }
  if (date && date > _todayISO()) { toast('Date cannot be in the future', 'error'); return; }
  const btn = document.getElementById('updSaveBtn');
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1'; btn.disabled = true;
  try {
    const r = await API.applyOperatorStages([updTarget.srNo], stages, date);
    if (!r.success) { alert('Error: ' + (r.message || 'Save failed')); return; }
    closeModals();
    alert(_summarise(r.results || []));
    await refreshCurrent();
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    delete btn.dataset.busy; btn.disabled = false;
  }
}

// ---------- admin undo ----------
function openUndo(srNo) {
  const r = opRows.find(x => String(x.srNo) === String(srNo));
  if (!r) return;
  const s = stageState(r);
  document.getElementById('undoTitle').textContent = 'Undo — ' + (r.customerName || r.invoiceNo);
  // RTO first, then Insurance, then DMS
  const btns = [];
  if (s.vah) btns.push(['vahan', 'RTO', _fmtDate(r.vahanDate) + ' · ' + (r.vahanOperator || ''), true]);
  if (s.ins) btns.push(['insurance', 'Insurance', _fmtDate(r.insuranceDate) + ' · ' + (r.insuranceOperator || ''), !s.vah]);
  if (s.dms) btns.push(['dms', 'DMS', r.dmsOperator || '', !s.ins]);
  document.getElementById('undoBody').innerHTML =
    '<div style="font-size:13px;color:#555;margin-bottom:10px;">Undo clears the stage in the HSRP sheet and in the Data sheet. Undo RTO first, then Insurance, then DMS.</div>' +
    btns.map(b => '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee;">' +
      '<div><strong>' + b[1] + '</strong><div style="font-size:12px;color:#777;">' + esc(b[2]) + '</div></div>' +
      '<button class="btn btn-danger" ' + (b[3] ? '' : 'disabled title="Undo the later stage first"') + ' onclick="doUndo(\'' + esc(r.srNo) + '\', \'' + b[0] + '\', \'' + b[1] + '\')">Undo</button></div>').join('');
  document.getElementById('undoModal').classList.add('show');
}

async function doUndo(srNo, stage, label) {
  if (!confirm('Undo ' + label + ' for this vehicle? This clears it in both sheets.')) return;
  try {
    const r = await API.undoOperatorStage(srNo, stage);
    if (!r.success) { alert('Error: ' + (r.message || 'Undo failed')); return; }
    closeModals();
    toast(label + ' undone', 'ok');
    await refreshCurrent();
  } catch (e) { alert('Error: ' + e.message); }
}

function closeModals() {
  document.getElementById('updateModal').classList.remove('show');
  document.getElementById('undoModal').classList.remove('show');
}

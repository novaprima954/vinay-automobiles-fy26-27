// ==========================================
// DELIVERY CHALLAN (DO)
// Admin / Accessories: every customer. Sales: own customers only.
// Only bookings with Account Check = Yes are listed (enforced on the server).
// Printing / PDF building lives in do-print.js (shared with the Accounts screen).
// ==========================================

let dcRecords = [];
let dcBusy = false; // blocks double-clicks while a challan is being issued / saved

document.addEventListener('DOMContentLoaded', function () {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  const user = session.user;
  if (user.role !== 'admin' && user.role !== 'accessories' && user.role !== 'sales') {
    alert('Access denied');
    window.location.href = 'home.html';
    return;
  }
  document.getElementById('currentUser').textContent = user.name || '';
  if (user.role === 'sales') {
    document.getElementById('dcScopeHint').textContent = 'Showing your customers only';
  }

  const today = _isoToday();
  document.getElementById('dcFromDate').value = today;
  document.getElementById('dcToDate').value = today;

  // Name search runs only on button click / Enter — no search-as-you-type
  document.getElementById('dcSearch').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') loadList();
  });

  loadList();
});

function goBack() {
  window.location.href = 'home.html';
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _isoToday() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function clearFilters() {
  document.getElementById('dcSearch').value = '';
  document.getElementById('dcFromDate').value = _isoToday();
  document.getElementById('dcToDate').value = _isoToday();
  loadList();
}

async function loadList() {
  const fromDate = document.getElementById('dcFromDate').value;
  const toDate   = document.getElementById('dcToDate').value;
  const search   = document.getElementById('dcSearch').value;
  const listEl   = document.getElementById('dcList');
  document.getElementById('resultSummary').textContent = '';

  listEl.innerHTML = '<div class="empty-state">Loading…</div>';

  try {
    const r = await API.getDeliveryChallanList(fromDate, toDate, search);
    if (!r.success) {
      listEl.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div>' + esc(r.message || 'Error loading list') + '</div>';
      return;
    }
    dcRecords = r.results || [];
    renderList(search.trim());
  } catch (e) {
    listEl.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div>Error loading list</div>';
  }
}

function _initials(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return ((parts[0] || '')[0] || '?').toUpperCase() + ((parts[1] || '')[0] || '').toUpperCase();
}

function renderList(searchTerm) {
  const listEl = document.getElementById('dcList');
  const summaryEl = document.getElementById('resultSummary');

  if (dcRecords.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><div class="icon">📭</div>No deliveries found for this filter</div>';
    summaryEl.textContent = '';
    return;
  }

  summaryEl.textContent = dcRecords.length + (dcRecords.length === 1 ? ' delivery found' : ' deliveries found') +
    (searchTerm ? ' for "' + searchTerm + '" (all dates)' : '');

  listEl.innerHTML = dcRecords.map(function (rec, idx) {
    const modelLine = [rec.model, rec.variant].filter(Boolean).join(' ');
    const pendingBadge = rec.accessoryPending
      ? '<div class="pending-badge">⚠️ Pending: ' + esc(rec.accessoryPending) + '</div>'
      : '';
    const rowClass = rec.challanNo ? 'is-issued' : (rec.accessoryPending ? 'has-pending' : '');
    const printLabel = rec.challanNo ? '🖨️ Print Again' : '🖨️ Print DO';
    const rightSide =
      (rec.challanNo ? '<span class="challan-badge">✅ DO #' + esc(rec.challanNo) + '</span>' : '') +
      '<button class="' + (rec.challanNo ? 'reprint' : '') + '" onclick="printRecord(' + idx + ')">' + printLabel + '</button>' +
      '<button class="drive" onclick="saveRecordToDrive(' + idx + ')">💾 Save to Drive</button>';

    return '<div class="dc-row ' + rowClass + '">' +
      '<div class="dc-avatar">' + esc(_initials(rec.customerName)) + '</div>' +
      '<div class="info">' +
        '<div class="customer">' + esc(rec.customerName) + '</div>' +
        '<div class="pills">' +
          '<span class="dc-pill">🧾 ' + esc(rec.receiptNo) + '</span>' +
          '<span class="dc-pill">🏍️ ' + esc(modelLine) + '</span>' +
          '<span class="dc-pill">👤 ' + esc(rec.executiveName || 'Unassigned') + '</span>' +
          '<span class="dc-pill">📅 ' + esc(rec.deliveryDate) + '</span>' +
        '</div>' +
        pendingBadge +
      '</div>' +
      '<div class="actions">' + rightSide + '</div>' +
    '</div>';
  }).join('');
}

async function printRecord(idx) {
  const rec = dcRecords[idx];
  if (!rec || dcBusy) return;
  dcBusy = true;
  try {
    const r = await DOPrint.printReceipt(rec.receiptNo);
    if (!r.ok) { showMessage(r.message, 'error'); return; }
    rec.challanNo = r.challanNo;
    renderList();
  } catch (e) {
    showMessage('Error preparing Delivery Challan', 'error');
  } finally {
    dcBusy = false;
  }
}

async function saveRecordToDrive(idx) {
  const rec = dcRecords[idx];
  if (!rec || dcBusy) return;
  dcBusy = true;
  showMessage('⏳ Saving to Drive... Please wait.', 'success');
  try {
    const p = await DOPrint.prepare(rec.receiptNo, 'Drive');
    if (!p.ok) { showMessage(p.message, 'error'); return; }
    rec.challanNo = p.challanNo;
    renderList();

    const pdfBase64 = await DOPrint.buildPdfBase64(p.record, p.challanNo);
    const r = await API.saveDeliveryChallanToDrive(rec.receiptNo, p.challanNo, pdfBase64);
    showMessage(r.success ? ('✅ ' + (r.message || 'Saved to Drive')) : ('❌ ' + (r.message || 'Could not save to Drive')), r.success ? 'success' : 'error');
  } catch (e) {
    if (e && e.message === 'NO_LIBRARY') showMessage('PDF library not loaded — cannot save to Drive.', 'error');
    else showMessage('⚠️ Could not save to Drive: ' + (e && e.message), 'error');
  } finally {
    dcBusy = false;
  }
}

let _msgTimer = null;
function showMessage(msg, type) {
  const el = document.getElementById('statusMessage');
  el.textContent = msg;
  el.className = 'message ' + (type === 'error' ? 'error' : 'success');
  el.classList.remove('hidden');
  clearTimeout(_msgTimer);
  _msgTimer = setTimeout(function () { el.classList.add('hidden'); }, 5000);
}

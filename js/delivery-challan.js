// ==========================================
// DELIVERY CHALLAN (DO) — admin only
// ==========================================

let dcRecords = [];

document.addEventListener('DOMContentLoaded', function () {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  const user = session.user;
  if (user.role !== 'admin') {
    alert('Access denied — admin only');
    window.location.href = 'home.html';
    return;
  }
  document.getElementById('currentUser').textContent = user.name || '';

  const today = _isoToday();
  document.getElementById('dcFromDate').value = today;
  document.getElementById('dcToDate').value = today;

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
    const rightSide = rec.challanNo
      ? '<span class="challan-badge">✅ DO #' + esc(rec.challanNo) + '</span><button class="reprint" onclick="printRecord(' + idx + ')">🖨️ Print Again</button>'
      : '<button onclick="printRecord(' + idx + ')"' + (rec.canPrint ? '' : ' disabled') + '>🖨️ Print DO</button>';

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
  if (!rec) return;

  try {
    const r = await API.issueDeliveryChallan(rec.receiptNo);
    if (!r.success) {
      showMessage(r.message || 'Could not issue Delivery Challan', 'error');
      return;
    }
    rec.challanNo = r.challanNo;

    // Need the full record (executive mobile, chassis/engine no, financier, etc.) to print
    const fullRes = await API.getDeliveryChallanRecord(rec.receiptNo);
    if (!fullRes.success) {
      showMessage(fullRes.message || 'Could not load record details', 'error');
      return;
    }

    buildPrintArea(fullRes.record, r.challanNo);
    renderList();
    setTimeout(function () { window.print(); }, 200);
  } catch (e) {
    showMessage('Error preparing Delivery Challan', 'error');
  }
}

function _formatDMY(isoDate) {
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return isoDate;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function _todayDMY() {
  const d = new Date();
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function _doCopyHtml(rec, challanNo, copyLabel) {
  const modelLine = 'TVS ' + [rec.model, rec.variant].filter(Boolean).join(' ');
  const checkItems = ['Owner Manual', 'Tool Kit', 'Battery & Warranty Card', 'Mirror', 'Saree Guard', 'Leg Guard'];

  const pendingHtml = rec.accessoryPending
    ? '<div class="do-pending"><span class="title">Pending Accessories:</span> ' + esc(rec.accessoryPending) + '</div>'
    : '';

  return '<div class="do-copy">' +
    '<div class="do-copy-label">' + esc(copyLabel) + '</div>' +
    '<div class="do-header">' +
      '<div class="do-logo"><div class="tri"></div><div class="tri-inner"></div></div>' +
      '<div class="do-header-text">' +
        '<div class="company">VINAY AUTOMOBILES</div>' +
        '<div class="addr">Mahaveer Nagar, Darwha Road, Yavatmal</div>' +
      '</div>' +
      '<span class="tvs-mark">TVS</span>' +
    '</div>' +
    '<div class="do-contact-row">' +
      '<span>👤 Executive: ' + esc(rec.executiveName || '-') + (rec.executiveMobile ? ' — ' + esc(rec.executiveMobile) : '') + '</span>' +
      '<span>☎ 9130040050</span>' +
    '</div>' +
    '<div class="do-box">' +
      '<div class="do-top-row">' +
        '<div class="from-block">' +
          '<div class="do-field-label">From: Shri</div>' +
          '<div class="do-field-value">' + esc(rec.customerName) + '</div>' +
        '</div>' +
        '<div class="meta-block">' +
          '<div class="do-field-label">Date</div>' +
          '<div class="do-field-value">' + esc(rec.deliveryDate ? _formatDMY(rec.deliveryDate) : _todayDMY()) + '</div>' +
          '<div class="do-field-label" style="margin-top:6px;">Delivery Challan No.</div>' +
          '<div class="do-field-value">' + esc(challanNo) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="do-declaration">I have taken delivery of the following described vehicle from Vinay Automobiles, Yavatmal, in good condition and to my entire satisfaction.</div>' +
      '<div class="do-desc-title">Description</div>' +
      '<div class="do-desc-grid">' +
        '<div class="do-desc-row full"><span class="lbl">One TVS Model</span><span class="val">' + esc(modelLine) + '</span></div>' +
        '<div class="do-desc-row"><span class="lbl">Chassis No.</span><span class="val">' + esc(rec.frameNumber) + '</span></div>' +
        '<div class="do-desc-row"><span class="lbl">Engine No.</span><span class="val">' + esc(rec.engineNumber) + '</span></div>' +
        '<div class="do-desc-row"><span class="lbl">Colour</span><span class="val">' + esc(rec.colour) + '</span></div>' +
        '<div class="do-desc-row"><span class="lbl">Key No.</span><span class="val"></span></div>' +
      '</div>' +
      '<div class="do-received-title">I have also received the following</div>' +
      '<div class="do-checks">' +
        checkItems.map(function (item) {
          return '<div class="do-check-item"><span class="do-check-box"></span>' + item + '</div>';
        }).join('') +
      '</div>' +
      '<div class="do-desc-row do-hyp-row"><span class="lbl">Hypothecation</span><span class="val">' + esc(rec.financierName || 'Cash') + '</span></div>' +
      pendingHtml +
      '<div class="do-sign-row">' +
        '<div class="line">Customer\'s Signature</div>' +
        '<div class="line">For: Vinay Automobiles</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function buildPrintArea(rec, challanNo) {
  const area = document.getElementById('doPrintArea');
  area.innerHTML = '<div class="do-page">' +
    _doCopyHtml(rec, challanNo, 'Customer Copy') +
    _doCopyHtml(rec, challanNo, 'Office Copy') +
  '</div>';
}

let _msgTimer = null;
function showMessage(msg, type) {
  const el = document.getElementById('statusMessage');
  el.textContent = msg;
  el.className = 'message ' + (type === 'error' ? 'error' : 'success');
  el.classList.remove('hidden');
  clearTimeout(_msgTimer);
  _msgTimer = setTimeout(function () { el.classList.add('hidden'); }, 4000);
}

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

async function loadList() {
  const fromDate = document.getElementById('dcFromDate').value;
  const toDate   = document.getElementById('dcToDate').value;
  const search   = document.getElementById('dcSearch').value;
  const listEl   = document.getElementById('dcList');

  listEl.innerHTML = '<div class="empty-state">Loading…</div>';

  try {
    const r = await API.getDeliveryChallanList(fromDate, toDate, search);
    if (!r.success) {
      listEl.innerHTML = '<div class="empty-state">' + esc(r.message || 'Error loading list') + '</div>';
      return;
    }
    dcRecords = r.results || [];
    renderList();
  } catch (e) {
    listEl.innerHTML = '<div class="empty-state">Error loading list</div>';
  }
}

function renderList() {
  const listEl = document.getElementById('dcList');
  if (dcRecords.length === 0) {
    listEl.innerHTML = '<div class="empty-state">📭 No deliveries found for this filter</div>';
    return;
  }

  listEl.innerHTML = dcRecords.map(function (rec, idx) {
    const modelLine = [rec.model, rec.variant].filter(Boolean).join(' ');
    const pendingBadge = rec.accessoryPending
      ? '<div class="pending-badge">⚠️ Pending: ' + esc(rec.accessoryPending) + '</div>'
      : '';
    const rightSide = rec.challanNo
      ? '<span class="challan-badge">DO #' + esc(rec.challanNo) + '</span> <button onclick="printRecord(' + idx + ')">🖨️ Print Again</button>'
      : '<button onclick="printRecord(' + idx + ')"' + (rec.accessoryPending ? ' disabled' : '') + '>🖨️ Print DO</button>';

    return '<div class="dc-row">' +
      '<div class="info">' +
        '<div class="customer">' + esc(rec.customerName) + '</div>' +
        '<div class="meta">' + esc(rec.receiptNo) + ' · ' + esc(modelLine) + ' · 👤 ' + esc(rec.executiveName || 'Unassigned') + ' · 📅 ' + esc(rec.deliveryDate) + '</div>' +
        pendingBadge +
      '</div>' +
      rightSide +
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

function _doCopyHtml(rec, challanNo) {
  const modelLine = 'TVS ' + [rec.model, rec.variant].filter(Boolean).join(' ');
  const checkItems = ['Owner Manual', 'Tool Kit', 'Battery & Warranty Card', 'Mirror', 'Saree Guard', 'Leg Guard'];

  const pendingHtml = rec.accessoryPending
    ? '<div class="do-pending"><span class="title">Pending Accessories:</span> ' + esc(rec.accessoryPending) + '</div>'
    : '';

  const execContact = 'Executive: ' + esc(rec.executiveName || '-') +
    (rec.executiveMobile ? ' (' + esc(rec.executiveMobile) + ')' : '') +
    ' &nbsp;·&nbsp; 9130040050';

  return '<div class="do-copy">' +
    '<div class="do-header">' +
      '<span class="tvs">TVS</span>' +
      '<div class="company">VINAY AUTOMOBILES</div>' +
      '<div class="addr">Mahaveer Nagar, Darwha Road, Yavatmal</div>' +
      '<div class="contact">' + execContact + '</div>' +
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
          '<div class="do-field-label" style="margin-top:5px;">Delivery Challan No.</div>' +
          '<div class="do-field-value">' + esc(challanNo) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="do-declaration">I have taken delivery of the following described vehicle from Vinay Automobiles, Yavatmal, in good condition and to my entire satisfaction.</div>' +
      '<div class="do-desc-title">Description</div>' +
      '<div class="do-desc-row"><span class="lbl">One TVS Model</span><span class="val">' + esc(modelLine) + '</span></div>' +
      '<div class="do-desc-row"><span class="lbl">Chassis No.</span><span class="val">' + esc(rec.frameNumber) + '</span></div>' +
      '<div class="do-desc-row"><span class="lbl">Engine No.</span><span class="val">' + esc(rec.engineNumber) + '</span></div>' +
      '<div class="do-desc-row"><span class="lbl">Colour</span><span class="val">' + esc(rec.colour) + '</span><span class="lbl" style="min-width:50px;">Key No.</span><span class="val"></span></div>' +
      '<div class="do-received-title">I have also received the following</div>' +
      '<div class="do-checks">' +
        checkItems.map(function (item) {
          return '<div class="do-check-item"><span class="do-check-box"></span>' + item + '</div>';
        }).join('') +
      '</div>' +
      '<div class="do-desc-row" style="margin-top:9px;"><span class="lbl">Hypothecation</span><span class="val">' + esc(rec.financierName || 'Cash') + '</span></div>' +
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
  area.innerHTML = '<div class="do-page">' + _doCopyHtml(rec, challanNo) + _doCopyHtml(rec, challanNo) + '</div>';
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

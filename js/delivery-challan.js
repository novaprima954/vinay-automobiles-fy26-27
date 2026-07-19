// ==========================================
// DELIVERY CHALLAN (DO) — admin only
// ==========================================

let currentDCRecord = null;
let currentDCChallanNo = null;

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
});

function goBack() {
  window.location.href = 'home.html';
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function searchRecord() {
  const receiptNo = document.getElementById('receiptSearch').value.trim();
  if (!receiptNo) { showMessage('Enter a receipt number', 'error'); return; }

  const btn = document.getElementById('searchBtn');
  btn.disabled = true; btn.textContent = 'Searching...';

  try {
    const r = await API.getDeliveryChallanRecord(receiptNo);
    btn.disabled = false; btn.textContent = '🔍 Search';

    if (!r.success) {
      showMessage(r.message || 'Record not found', 'error');
      document.getElementById('recordCard').style.display = 'none';
      document.getElementById('printBtn').style.display = 'none';
      document.getElementById('gateBanner').style.display = 'none';
      return;
    }

    currentDCRecord = r.record;
    currentDCChallanNo = r.challanNo || null;
    renderRecord();
  } catch (e) {
    btn.disabled = false; btn.textContent = '🔍 Search';
    showMessage('Error searching record', 'error');
  }
}

function renderRecord() {
  const rec = currentDCRecord;
  document.getElementById('recordCard').style.display = 'block';
  document.getElementById('rCustomerName').textContent = rec.customerName || '-';
  document.getElementById('rModel').textContent = [rec.model, rec.variant].filter(Boolean).join(' ') || '-';
  document.getElementById('rExecutive').textContent = rec.executiveName || '-';
  document.getElementById('rAccessoryFitted').textContent = rec.accessoryFitted || 'No';
  document.getElementById('rChallanNo').textContent = currentDCChallanNo || 'Not yet issued';

  const gate = document.getElementById('gateBanner');
  const printBtn = document.getElementById('printBtn');
  printBtn.style.display = 'block';

  if (rec.accessoryFitted !== 'Yes') {
    gate.style.display = 'block';
    gate.textContent = '⚠️ Accessories are not yet marked as fitted for this record — Delivery Challan cannot be printed until Accessory Fitted = Yes.';
    printBtn.disabled = true;
  } else {
    gate.style.display = 'none';
    printBtn.disabled = false;
  }
}

async function printDeliveryChallan() {
  if (!currentDCRecord) return;
  const btn = document.getElementById('printBtn');
  btn.disabled = true; btn.textContent = '⏳ Preparing...';

  try {
    const r = await API.issueDeliveryChallan(currentDCRecord.receiptNo);
    if (!r.success) {
      showMessage(r.message || 'Could not issue Delivery Challan', 'error');
      btn.disabled = false; btn.textContent = '🖨️ Generate & Print Delivery Challan';
      return;
    }
    currentDCChallanNo = r.challanNo;
    document.getElementById('rChallanNo').textContent = currentDCChallanNo;

    buildPrintArea(currentDCRecord, currentDCChallanNo);
    btn.disabled = false; btn.textContent = '🖨️ Generate & Print Delivery Challan';

    setTimeout(function () { window.print(); }, 200);
  } catch (e) {
    showMessage('Error preparing Delivery Challan', 'error');
    btn.disabled = false; btn.textContent = '🖨️ Generate & Print Delivery Challan';
  }
}

function _todayDDMMYYYY() {
  const d = new Date();
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function _doCopyHtml(rec, challanNo) {
  const modelLine = 'TVS ' + [rec.model, rec.variant].filter(Boolean).join(' ');
  const checkItems = ['Owner Mannual', 'Tool Kit', 'Battery & Warranty Card', 'Mirror', 'Saree Guard', 'Leg Guard'];

  const pendingHtml = rec.accessoryPending
    ? '<div class="do-pending"><span class="title">Pending Accessories:</span> ' + esc(rec.accessoryPending) + '</div>'
    : '';

  return '<div class="do-copy">' +
    '<div class="do-header">' +
      '<span class="tvs">TVS</span>' +
      '<div class="company">VINAY AUTOMOBILES</div>' +
      '<div class="addr">Mahavir Nagar, Darwha Road, YAVATMAL</div>' +
      '<div class="contact">Executive: ' + esc(rec.executiveName || '-') + ' &nbsp;·&nbsp; 9130040050</div>' +
    '</div>' +
    '<div class="do-box">' +
      '<div class="do-top-row">' +
        '<div class="from-block">' +
          '<div class="do-field-label">From: Shri</div>' +
          '<div class="do-field-value">' + esc(rec.customerName) + '</div>' +
        '</div>' +
        '<div class="meta-block">' +
          '<div class="do-field-label">Date</div>' +
          '<div class="do-field-value">' + esc(rec.deliveryDate ? _formatDMY(rec.deliveryDate) : _todayDDMMYYYY()) + '</div>' +
          '<div class="do-field-label" style="margin-top:4px;">Delivery Challan No.</div>' +
          '<div class="do-field-value">' + esc(challanNo) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="do-declaration">I have taken the delivery of the following described Vehicle from Vinay Automobiles, Yavatmal in Good Condition &amp; to my entire satisfaction</div>' +
      '<div class="do-desc-title">Descreption :</div>' +
      '<div class="do-desc-row"><span class="lbl">One TVS MODEL</span><span class="val">' + esc(modelLine) + '</span></div>' +
      '<div class="do-desc-row"><span class="lbl">Chasis No.</span><span class="val">' + esc(rec.frameNumber) + '</span></div>' +
      '<div class="do-desc-row"><span class="lbl">Engine No.</span><span class="val">' + esc(rec.engineNumber) + '</span></div>' +
      '<div class="do-desc-row"><span class="lbl">Colour</span><span class="val">' + esc(rec.colour) + '</span><span class="lbl" style="min-width:50px;">Key No.</span><span class="val"></span></div>' +
      '<div class="do-received-title">I have also received the following.</div>' +
      '<div class="do-checks">' +
        checkItems.map(function(item) {
          return '<div class="do-check-item"><span class="do-check-box"></span>' + item + '</div>';
        }).join('') +
      '</div>' +
      '<div class="do-desc-row" style="margin-top:8px;"><span class="lbl">HYP Bank</span><span class="val">' + esc(rec.financierName || 'Cash') + '</span></div>' +
      pendingHtml +
      '<div class="do-sign-row">' +
        '<div class="line">Customer\'s Signature</div>' +
        '<div class="line">For: Vinay Automobiles</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function _formatDMY(isoDate) {
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return isoDate;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
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

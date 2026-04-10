// ==========================================
// FINANCIER DETAILS PAGE
// HP Finance Tracking - admin and accounts only
// ==========================================

console.log('=== FINANCIER PAGE ===');

let records = [];
let currentFilters = { customerName: '', refCustomer: '', financier: '' };
let currentSort = 'all';
let displayedData = [];  // currently rendered subset

// ==========================================
// AUTH & INIT
// ==========================================

window.addEventListener('DOMContentLoaded', async () => {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const validation = await API.validateSession(session.sessionId);
  if (!validation.success) {
    SessionManager.clearSession();
    window.location.href = 'index.html';
    return;
  }

  if (validation.user.role !== 'admin' && validation.user.role !== 'accounts') {
    alert('Access denied. This page is only for Admin and Accounts users.');
    window.location.href = 'dashboard.html';
    return;
  }

  loadFinancierData();
});

// ==========================================
// DATA LOADING
// ==========================================

async function loadFinancierData() {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const tbody = document.getElementById('financierBody');
  tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:40px;color:#666;">Loading...</td></tr>';

  try {
    const response = await API.call('getFinancierData', {
      sessionId: session.sessionId,
      customerName: '', refCustomer: '', financier: ''
    });

    if (response.success) {
      records = response.data || [];
      populateDropdowns(records);
      applyFiltersAndSort();
    } else {
      tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:40px;color:#dc3545;">Error: ' + (response.message || 'Failed to load') + '</td></tr>';
    }
  } catch (err) {
    console.error('loadFinancierData error:', err);
    tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:40px;color:#dc3545;">Error: ' + err.message + '</td></tr>';
  }
}

// ==========================================
// DROPDOWNS
// ==========================================

function populateDropdowns(data) {
  const refSet = new Set();
  const finSet = new Set();
  data.forEach(function(r) {
    if (r.refCustomer) refSet.add(r.refCustomer);
    if (r.financier)   finSet.add(r.financier);
  });

  function rebuild(id, values) {
    const sel = document.getElementById(id);
    const prev = sel.value;
    sel.innerHTML = '<option value="">-- All --</option>';
    Array.from(values).sort().forEach(function(v) {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      if (v === prev) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  rebuild('filterRefCustomer', refSet);
  rebuild('filterFinancier', finSet);
}

// ==========================================
// FILTER + SORT (combined)
// ==========================================

function getDiffValue(record) {
  const d = parseFloat(record.disbursalAmount);
  const r = parseFloat(record.amountReceived);
  const hasD = !isNaN(d) && record.disbursalAmount !== '';
  const hasR = !isNaN(r) && record.amountReceived !== '';
  if (!hasD && !hasR) return null; // no data
  return (hasD ? d : 0) - (hasR ? r : 0);
}

function applyFiltersAndSort() {
  const customerName = document.getElementById('filterCustomer').value.trim().toLowerCase();
  const refCustomer  = document.getElementById('filterRefCustomer').value;
  const financier    = document.getElementById('filterFinancier').value;
  currentSort        = document.getElementById('sortDiff').value;

  let filtered = records.filter(function(r) {
    if (customerName && r.customerName.toLowerCase().indexOf(customerName) === -1) return false;
    if (refCustomer && r.refCustomer !== refCustomer) return false;
    if (financier   && r.financier   !== financier)   return false;
    return true;
  });

  // Sort / filter by difference
  if (currentSort === 'positive') {
    filtered = filtered.filter(function(r) { const d = getDiffValue(r); return d !== null && d > 0; });
  } else if (currentSort === 'zero') {
    filtered = filtered.filter(function(r) { const d = getDiffValue(r); return d !== null && d === 0; });
  } else if (currentSort === 'negative') {
    filtered = filtered.filter(function(r) { const d = getDiffValue(r); return d !== null && d < 0; });
  } else if (currentSort === 'nodata') {
    filtered = filtered.filter(function(r) { return getDiffValue(r) === null; });
  }

  displayedData = filtered;
  renderTable(filtered);
}

function applyFilters() { applyFiltersAndSort(); }

function clearFilters() {
  document.getElementById('filterCustomer').value    = '';
  document.getElementById('filterRefCustomer').value = '';
  document.getElementById('filterFinancier').value   = '';
  document.getElementById('sortDiff').value          = 'all';
  currentSort = 'all';
  displayedData = records;
  renderTable(records);
}

function sortRecords() { applyFiltersAndSort(); }

// ==========================================
// ROW COLORS
// ==========================================

function getRowStyle(disbursalAmount, amountReceived) {
  const d = parseFloat(disbursalAmount);
  const r = parseFloat(amountReceived);
  const hasD = !isNaN(d) && disbursalAmount !== '' && disbursalAmount !== null && disbursalAmount !== undefined;
  const hasR = !isNaN(r) && amountReceived  !== '' && amountReceived  !== null && amountReceived  !== undefined;
  if (!hasD && !hasR) return '';  // no color — white row
  const diff = (hasD ? d : 0) - (hasR ? r : 0);
  if (diff > 0)  return 'background:#fca5a5;';        // dark red — more disbursed than received
  if (diff < 0)  return 'background:#bbf7d0;';        // green — received more
  return 'background:#bfdbfe;';                        // calm blue — balanced
}

function getDiffDisplay(disbursalAmount, amountReceived) {
  const d = parseFloat(disbursalAmount);
  const r = parseFloat(amountReceived);
  const hasD = !isNaN(d) && disbursalAmount !== '' && disbursalAmount !== null;
  const hasR = !isNaN(r) && amountReceived  !== '' && amountReceived  !== null;
  if (!hasD && !hasR) return '—';
  const diff = (hasD ? d : 0) - (hasR ? r : 0);
  return formatCurrency(diff);
}

// ==========================================
// TABLE RENDER
// ==========================================

function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  const abs = Math.round(Math.abs(num)).toString();
  let result = abs.length <= 3 ? abs : abs.slice(-3);
  let rem = abs.slice(0, abs.length - 3);
  while (rem.length > 2) { result = rem.slice(-2) + ',' + result; rem = rem.slice(0, rem.length - 2); }
  if (rem) result = rem + ',' + result;
  return (num < 0 ? '-' : '') + '₹' + result;
}

function inputStyle() {
  return 'width:100%;padding:5px 7px;border:1px solid #ccc;border-radius:5px;font-size:12px;box-sizing:border-box;background:rgba(255,255,255,0.85);';
}

function renderTable(data) {
  const tbody = document.getElementById('financierBody');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:40px;color:#666;">No records found</td></tr>';
    return;
  }

  let html = '';
  data.forEach(function(record, idx) {
    const rowStyle = getRowStyle(record.disbursalAmount, record.amountReceived);
    const diffText = getDiffDisplay(record.disbursalAmount, record.amountReceived);
    const invoiceStr = String(record.invoiceNo || '');
    const invoiceEsc = invoiceStr.replace(/"/g, '&quot;');

    html += '<tr id="frow-' + idx + '" data-invoice="' + invoiceEsc + '" style="' + rowStyle + '">';
    html += '<td style="white-space:nowrap;">' + (record.srNo || '—') + '</td>';
    html += '<td style="white-space:nowrap;font-weight:600;">' + (invoiceStr || '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (record.invoiceDate || '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (record.customerName || '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (record.mobileNo || '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (record.modelName || '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (record.refCustomer || '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (record.financier || '—') + '</td>';
    html += '<td><input type="number" id="disb-' + idx + '" value="' + (record.disbursalAmount !== '' && record.disbursalAmount !== null && record.disbursalAmount !== undefined ? record.disbursalAmount : '') + '" oninput="updateDiff(' + idx + ')" style="' + inputStyle() + 'min-width:100px;" placeholder="0"></td>';
    html += '<td><input type="number" id="rcvd-' + idx + '" value="' + (record.amountReceived  !== '' && record.amountReceived  !== null && record.amountReceived  !== undefined ? record.amountReceived  : '') + '" oninput="updateDiff(' + idx + ')" style="' + inputStyle() + 'min-width:100px;" placeholder="0"></td>';
    html += '<td><input type="date"   id="rcvdate-' + idx + '" value="' + (record.receivedDate || '') + '" style="' + inputStyle() + 'min-width:120px;"></td>';
    html += '<td><input type="date"   id="dodate-'  + idx + '" value="' + (record.doDate       || '') + '" style="' + inputStyle() + 'min-width:120px;"></td>';
    html += '<td><input type="text"   id="dono-'    + idx + '" value="' + (record.doNumber     || '') + '" style="' + inputStyle() + 'min-width:90px;" placeholder="DO No"></td>';
    html += '<td style="text-align:center;font-weight:700;white-space:nowrap;" id="diff-' + idx + '">' + diffText + '</td>';
    html += '<td style="text-align:center;"><button id="savebtn-' + idx + '" onclick="saveRow(' + idx + ')" style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">Save</button></td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;
}

// ==========================================
// DYNAMIC DIFF UPDATE (whole row recolors)
// ==========================================

function updateDiff(idx) {
  const disbVal = document.getElementById('disb-' + idx).value;
  const rcvdVal = document.getElementById('rcvd-' + idx).value;
  document.getElementById('diff-' + idx).textContent = getDiffDisplay(disbVal, rcvdVal);
  const row = document.getElementById('frow-' + idx);
  row.style.cssText = getRowStyle(disbVal, rcvdVal);
}

// ==========================================
// SAVE ROW
// ==========================================

async function saveRow(idx) {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const row = document.getElementById('frow-' + idx);
  const invoiceNo = row.getAttribute('data-invoice');
  const disbursalAmountRaw = document.getElementById('disb-' + idx).value.trim();
  const amountReceivedRaw  = document.getElementById('rcvd-' + idx).value.trim();
  const receivedDate = document.getElementById('rcvdate-' + idx).value.trim();
  const doDate       = document.getElementById('dodate-'  + idx).value.trim();
  const doNumber     = document.getElementById('dono-'    + idx).value.trim();

  let disbursalAmount = '';
  let amountReceived  = '';
  if (disbursalAmountRaw !== '') {
    const p = parseFloat(disbursalAmountRaw);
    if (isNaN(p)) { showMessage('Row ' + (idx + 1) + ': Disbursal Amount must be a number.', 'error'); return; }
    disbursalAmount = p;
  }
  if (amountReceivedRaw !== '') {
    const p = parseFloat(amountReceivedRaw);
    if (isNaN(p)) { showMessage('Row ' + (idx + 1) + ': Amount Received must be a number.', 'error'); return; }
    amountReceived = p;
  }

  const btn = document.getElementById('savebtn-' + idx);
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    const res = await API.call('saveFinancierData', {
      sessionId: session.sessionId,
      invoiceNo, disbursalAmount, amountReceived, receivedDate, doDate, doNumber
    });
    if (res.success) {
      showMessage('Saved — Invoice ' + invoiceNo, 'success');
      btn.textContent = '✓ Saved';
      setTimeout(function() { btn.textContent = 'Save'; btn.disabled = false; }, 2000);
    } else {
      showMessage('Error: ' + (res.message || 'Failed to save'), 'error');
      btn.textContent = 'Save'; btn.disabled = false;
    }
  } catch (err) {
    showMessage('Error: ' + err.message, 'error');
    btn.textContent = 'Save'; btn.disabled = false;
  }
}

// ==========================================
// SAVE ALL
// ==========================================

async function saveAllRows() {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const rows = document.querySelectorAll('tr[id^="frow-"]');
  const toSave = [];

  rows.forEach(function(row) {
    const idx = row.id.replace('frow-', '');
    const invoiceNo        = row.getAttribute('data-invoice');
    const disbursalAmountRaw = (document.getElementById('disb-' + idx)    || {}).value || '';
    const amountReceivedRaw  = (document.getElementById('rcvd-' + idx)    || {}).value || '';
    const receivedDate       = (document.getElementById('rcvdate-' + idx) || {}).value || '';
    const doDate             = (document.getElementById('dodate-'  + idx) || {}).value || '';
    const doNumber           = (document.getElementById('dono-'    + idx) || {}).value || '';

    // Only include rows with at least one field filled
    if (!disbursalAmountRaw && !amountReceivedRaw && !receivedDate && !doDate && !doNumber) return;

    toSave.push({
      invoiceNo,
      disbursalAmount: disbursalAmountRaw !== '' ? (parseFloat(disbursalAmountRaw) || '') : '',
      amountReceived:  amountReceivedRaw  !== '' ? (parseFloat(amountReceivedRaw)  || '') : '',
      receivedDate, doDate, doNumber
    });
  });

  if (toSave.length === 0) { showMessage('No data entered to save.', 'error'); return; }

  const btn = document.getElementById('saveAllBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    const res = await API.call('batchSaveFinancierData', {
      sessionId: session.sessionId,
      records: toSave
    });
    if (res.success) {
      showMessage(res.message || ('Saved ' + toSave.length + ' records'), 'success');
      btn.textContent = '✓ All Saved';
      setTimeout(function() { btn.textContent = '💾 Save All'; btn.disabled = false; }, 2500);
    } else {
      showMessage('Error: ' + (res.message || 'Failed'), 'error');
      btn.textContent = '💾 Save All'; btn.disabled = false;
    }
  } catch (err) {
    showMessage('Error: ' + err.message, 'error');
    btn.textContent = '💾 Save All'; btn.disabled = false;
  }
}

// ==========================================
// EXPORT TO EXCEL
// ==========================================

function exportToExcel() {
  const rows = document.querySelectorAll('tr[id^="frow-"]');
  if (rows.length === 0) { showMessage('No data to export.', 'error'); return; }

  const wsData = [['Sr No', 'Invoice No', 'Invoice Date', 'Customer Name', 'Mobile', 'Model', 'Ref Customer', 'Financier', 'Disbursal Amount', 'Amount Received', 'Received Date', 'DO Date', 'DO Number', 'Difference']];

  rows.forEach(function(row) {
    const idx = row.id.replace('frow-', '');
    const cells = row.querySelectorAll('td');
    const disbVal = (document.getElementById('disb-' + idx) || {}).value || '';
    const rcvdVal = (document.getElementById('rcvd-' + idx) || {}).value || '';
    const d = parseFloat(disbVal);
    const r = parseFloat(rcvdVal);
    const diff = (!isNaN(d) && disbVal !== '' ? d : 0) - (!isNaN(r) && rcvdVal !== '' ? r : 0);
    const diffDisplay = (disbVal !== '' || rcvdVal !== '') ? diff : '';

    wsData.push([
      cells[0].textContent.trim(),   // Sr No
      cells[1].textContent.trim(),   // Invoice No
      cells[2].textContent.trim(),   // Invoice Date
      cells[3].textContent.trim(),   // Customer
      cells[4].textContent.trim(),   // Mobile
      cells[5].textContent.trim(),   // Model
      cells[6].textContent.trim(),   // Ref Customer
      cells[7].textContent.trim(),   // Financier
      disbVal !== '' ? parseFloat(disbVal) : '',
      rcvdVal !== '' ? parseFloat(rcvdVal) : '',
      (document.getElementById('rcvdate-' + idx) || {}).value || '',
      (document.getElementById('dodate-'  + idx) || {}).value || '',
      (document.getElementById('dono-'    + idx) || {}).value || '',
      diffDisplay
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [6,14,14,24,14,20,18,20,16,16,14,14,14,14].map(function(w){ return {wch: w}; });

  XLSX.utils.book_append_sheet(wb, ws, 'Financier Details');
  XLSX.writeFile(wb, 'Financier_Details_' + new Date().toISOString().split('T')[0] + '.xlsx');
  showMessage('Excel exported successfully.', 'success');
}

// ==========================================
// TAB SWITCHING
// ==========================================

function switchTab(tab) {
  document.querySelectorAll('.fin-tab').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');
  if (tab === 'payout') loadPayouts();
}

// ==========================================
// PAYOUT — LOAD & RENDER
// ==========================================

let payoutRecords = [];

async function loadPayouts() {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const month = (document.getElementById('payFilterMonth') || {}).value || '';
  const tbody = document.getElementById('payoutBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#666;">Loading...</td></tr>';

  try {
    const res = await API.call('getPayouts', { sessionId: session.sessionId, month });
    if (res.success) {
      payoutRecords = res.payouts || [];
      renderPayouts(payoutRecords);
    } else {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#dc3545;">Error: ' + (res.message || 'Failed to load') + '</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#dc3545;">Error: ' + err.message + '</td></tr>';
  }
}

function renderPayouts(data) {
  const tbody = document.getElementById('payoutBody');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#999;">No payout records found</td></tr>';
    return;
  }
  let html = '';
  data.forEach(function(p, idx) {
    html += '<tr>';
    html += '<td style="color:#999;font-size:12px;">' + (idx + 1) + '</td>';
    html += '<td style="white-space:nowrap;font-size:12px;">' + (p.createdDate || '—') + '</td>';
    html += '<td style="font-weight:600;">' + (p.invoiceAmount !== '' && p.invoiceAmount !== null ? formatCurrency(p.invoiceAmount) : '—') + '</td>';
    html += '<td style="font-weight:600;color:#166534;">' + (p.payoutAmount !== '' && p.payoutAmount !== null ? formatCurrency(p.payoutAmount) : '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (p.payoutMonth || '—') + '</td>';
    html += '<td style="color:#555;font-size:13px;">' + (p.notes || '—') + '</td>';
    html += '<td style="font-size:12px;color:#999;">' + (p.enteredBy || '—') + '</td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

function clearPayoutFilter() {
  document.getElementById('payFilterMonth').value = '';
  loadPayouts();
}

// ==========================================
// PAYOUT — SAVE
// ==========================================

async function savePayout() {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const invoiceAmountRaw = document.getElementById('payInvoiceAmount').value.trim();
  const payoutAmountRaw  = document.getElementById('payPayoutAmount').value.trim();
  const payoutMonth      = document.getElementById('payPayoutMonth').value.trim();
  const notes            = document.getElementById('payNotes').value.trim();

  // Validate
  if (!invoiceAmountRaw && !payoutAmountRaw && !payoutMonth) {
    showPayoutMsg('Please fill in at least Invoice Amount, Payout Amount or Payout Month.', 'error');
    return;
  }
  let invoiceAmount = '';
  let payoutAmount  = '';
  if (invoiceAmountRaw !== '') {
    invoiceAmount = parseFloat(invoiceAmountRaw);
    if (isNaN(invoiceAmount)) { showPayoutMsg('Invoice Amount must be a valid number.', 'error'); return; }
  }
  if (payoutAmountRaw !== '') {
    payoutAmount = parseFloat(payoutAmountRaw);
    if (isNaN(payoutAmount)) { showPayoutMsg('Payout Amount must be a valid number.', 'error'); return; }
  }

  const btn = document.getElementById('paySubmitBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    const res = await API.call('savePayout', {
      sessionId: session.sessionId,
      invoiceAmount, payoutAmount, payoutMonth, notes
    });
    if (res.success) {
      showPayoutMsg('Payout saved successfully!', 'success');
      clearPayoutForm();
      loadPayouts();
    } else {
      showPayoutMsg('Error: ' + (res.message || 'Failed to save'), 'error');
    }
  } catch (err) {
    showPayoutMsg('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Save Payout';
  }
}

function clearPayoutForm() {
  document.getElementById('payInvoiceAmount').value = '';
  document.getElementById('payPayoutAmount').value  = '';
  document.getElementById('payPayoutMonth').value   = '';
  document.getElementById('payNotes').value         = '';
  const msg = document.getElementById('payoutFormMsg');
  msg.style.display = 'none';
}

function showPayoutMsg(text, type) {
  const el = document.getElementById('payoutFormMsg');
  el.textContent = text;
  el.className = 'page-message ' + type;
  el.style.display = 'block';
  if (type === 'success') setTimeout(function() { el.style.display = 'none'; }, 4000);
}

// ==========================================
// PAYOUT — EXPORT EXCEL
// ==========================================

function exportPayoutExcel() {
  if (!payoutRecords || payoutRecords.length === 0) { showMessage('No payout data to export.', 'error'); return; }
  const wsData = [['#', 'Date Added', 'Invoice Amount', 'Payout Amount', 'Payout Month', 'Notes', 'Entered By']];
  payoutRecords.forEach(function(p, idx) {
    wsData.push([
      idx + 1,
      p.createdDate || '',
      p.invoiceAmount !== '' && p.invoiceAmount !== null ? parseFloat(p.invoiceAmount) || '' : '',
      p.payoutAmount  !== '' && p.payoutAmount  !== null ? parseFloat(p.payoutAmount)  || '' : '',
      p.payoutMonth || '',
      p.notes || '',
      p.enteredBy || ''
    ]);
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [4, 18, 16, 16, 14, 30, 16].map(function(w) { return { wch: w }; });
  XLSX.utils.book_append_sheet(wb, ws, 'Payouts');
  XLSX.writeFile(wb, 'Payout_Records_' + new Date().toISOString().split('T')[0] + '.xlsx');
  showMessage('Payout Excel exported.', 'success');
}

// ==========================================
// HELPERS
// ==========================================

function showMessage(text, type) {
  const el = document.getElementById('pageMessage');
  el.textContent = text;
  el.className = 'page-message ' + type;
  el.style.display = 'block';
  if (type === 'success') setTimeout(function() { el.style.display = 'none'; }, 4000);
}

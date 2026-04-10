// ==========================================
// FINANCIER DETAILS PAGE
// HP Finance Tracking - admin and accounts only
// ==========================================

console.log('=== FINANCIER PAGE ===');

let records = [];
let currentFilters = { customerName: '', refCustomer: '', financier: '' };

// ==========================================
// AUTHENTICATION & INITIALIZATION
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
      renderTable(records);
    } else {
      tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:40px;color:#dc3545;">Error: ' + (response.message || 'Failed to load data') + '</td></tr>';
    }
  } catch (err) {
    console.error('loadFinancierData error:', err);
    tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:40px;color:#dc3545;">Error: ' + err.message + '</td></tr>';
  }
}

// ==========================================
// DROPDOWN POPULATION
// ==========================================

function populateDropdowns(data) {
  const refSet = new Set();
  const finSet = new Set();

  data.forEach(function(r) {
    if (r.refCustomer) refSet.add(r.refCustomer);
    if (r.financier)   finSet.add(r.financier);
  });

  function rebuildSelect(id, values) {
    const sel = document.getElementById(id);
    const prev = sel.value;
    sel.innerHTML = '<option value="">-- All --</option>';
    Array.from(values).sort().forEach(function(v) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      if (v === prev) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  rebuildSelect('filterRefCustomer', refSet);
  rebuildSelect('filterFinancier', finSet);
}

// ==========================================
// TABLE RENDERING (inline editable)
// ==========================================

function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num) || value === '' || value === null || value === undefined) return '—';
  const abs = Math.round(Math.abs(num)).toString();
  let result = abs.length <= 3 ? abs : abs.slice(-3);
  let rem = abs.slice(0, abs.length - 3);
  while (rem.length > 2) { result = rem.slice(-2) + ',' + result; rem = rem.slice(0, rem.length - 2); }
  if (rem) result = rem + ',' + result;
  return (num < 0 ? '-' : '') + '₹' + result;
}

function diffStyle(disb, rcvd) {
  const d = parseFloat(disb);
  const r = parseFloat(rcvd);
  if ((isNaN(d) || disb === '') && (isNaN(r) || rcvd === '')) {
    return 'background:#f0f0f0;color:#999;';
  }
  const diff = (isNaN(d) ? 0 : d) - (isNaN(r) ? 0 : r);
  if (diff === 0) return 'background:#dbeafe;color:#1e40af;font-weight:600;';   // calm blue — balanced
  if (diff > 0)  return 'background:#fee2e2;color:#991b1b;font-weight:600;';   // red — more disbursed than received
  return 'background:#dcfce7;color:#166534;font-weight:600;';                   // green — received more
}

function diffText(disb, rcvd) {
  const d = parseFloat(disb);
  const r = parseFloat(rcvd);
  if ((isNaN(d) || disb === '') && (isNaN(r) || rcvd === '')) return '—';
  const diff = (isNaN(d) ? 0 : d) - (isNaN(r) ? 0 : r);
  return formatCurrency(diff);
}

function inputStyle() {
  return 'width:100%;padding:5px 7px;border:1px solid #ddd;border-radius:5px;font-size:12px;box-sizing:border-box;background:#fafafa;';
}

function renderTable(data) {
  const tbody = document.getElementById('financierBody');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:40px;color:#666;">No records found</td></tr>';
    return;
  }

  let html = '';
  data.forEach(function(record, idx) {
    const ds = diffStyle(record.disbursalAmount, record.amountReceived);
    const dt = diffText(record.disbursalAmount, record.amountReceived);
    const invoiceEsc = (record.invoiceNo || '').replace(/"/g, '&quot;');

    html += '<tr id="frow-' + idx + '" data-invoice="' + invoiceEsc + '">';
    html += '<td style="white-space:nowrap;">' + (record.srNo || '—') + '</td>';
    html += '<td style="white-space:nowrap;font-weight:600;">' + (record.invoiceNo || '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (record.invoiceDate || '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (record.customerName || '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (record.mobileNo || '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (record.modelName || '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (record.refCustomer || '—') + '</td>';
    html += '<td style="white-space:nowrap;">' + (record.financier || '—') + '</td>';
    // Editable fields
    html += '<td><input type="number" id="disb-' + idx + '" value="' + (record.disbursalAmount !== '' ? record.disbursalAmount : '') + '" oninput="updateDiff(' + idx + ')" style="' + inputStyle() + 'min-width:100px;" placeholder="0"></td>';
    html += '<td><input type="number" id="rcvd-' + idx + '" value="' + (record.amountReceived !== '' ? record.amountReceived : '') + '" oninput="updateDiff(' + idx + ')" style="' + inputStyle() + 'min-width:100px;" placeholder="0"></td>';
    html += '<td><input type="date" id="rcvdate-' + idx + '" value="' + (record.receivedDate || '') + '" style="' + inputStyle() + 'min-width:120px;"></td>';
    html += '<td><input type="date" id="dodate-' + idx + '" value="' + (record.doDate || '') + '" style="' + inputStyle() + 'min-width:120px;"></td>';
    html += '<td><input type="text" id="dono-' + idx + '" value="' + (record.doNumber || '') + '" style="' + inputStyle() + 'min-width:90px;" placeholder="DO No"></td>';
    // Dynamic difference cell
    html += '<td id="diff-' + idx + '" style="text-align:center;white-space:nowrap;' + ds + '">' + dt + '</td>';
    // Save button
    html += '<td style="text-align:center;"><button onclick="saveRow(' + idx + ')" style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">Save</button></td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;
}

// ==========================================
// DYNAMIC DIFFERENCE UPDATE
// ==========================================

function updateDiff(idx) {
  const disbVal = document.getElementById('disb-' + idx).value;
  const rcvdVal = document.getElementById('rcvd-' + idx).value;
  const diffEl = document.getElementById('diff-' + idx);
  diffEl.textContent = diffText(disbVal, rcvdVal);
  diffEl.setAttribute('style', 'text-align:center;white-space:nowrap;' + diffStyle(disbVal, rcvdVal));
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
  const doDate       = document.getElementById('dodate-' + idx).value.trim();
  const doNumber     = document.getElementById('dono-' + idx).value.trim();

  let disbursalAmount = '';
  let amountReceived  = '';

  if (disbursalAmountRaw !== '') {
    const p = parseFloat(disbursalAmountRaw);
    if (isNaN(p)) { showMessage('Row ' + (idx + 1) + ': Disbursal Amount must be a valid number.', 'error'); return; }
    disbursalAmount = p;
  }
  if (amountReceivedRaw !== '') {
    const p = parseFloat(amountReceivedRaw);
    if (isNaN(p)) { showMessage('Row ' + (idx + 1) + ': Amount Received must be a valid number.', 'error'); return; }
    amountReceived = p;
  }

  const saveBtn = row.querySelector('button');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const response = await API.call('saveFinancierData', {
      sessionId: session.sessionId,
      invoiceNo, disbursalAmount, amountReceived, receivedDate, doDate, doNumber
    });

    if (response.success) {
      showMessage('Saved — Invoice ' + invoiceNo, 'success');
      saveBtn.textContent = '✓ Saved';
      setTimeout(function() { saveBtn.textContent = 'Save'; saveBtn.disabled = false; }, 2000);
    } else {
      showMessage('Error: ' + (response.message || 'Failed to save'), 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  } catch (err) {
    showMessage('Error: ' + err.message, 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

// ==========================================
// FILTERS
// ==========================================

function applyFilters() {
  const customerName = document.getElementById('filterCustomer').value.trim().toLowerCase();
  const refCustomer  = document.getElementById('filterRefCustomer').value;
  const financier    = document.getElementById('filterFinancier').value;

  const filtered = records.filter(function(r) {
    if (customerName && r.customerName.toLowerCase().indexOf(customerName) === -1) return false;
    if (refCustomer && r.refCustomer !== refCustomer) return false;
    if (financier   && r.financier   !== financier)   return false;
    return true;
  });

  renderTable(filtered);
}

function clearFilters() {
  document.getElementById('filterCustomer').value    = '';
  document.getElementById('filterRefCustomer').value = '';
  document.getElementById('filterFinancier').value   = '';
  renderTable(records);
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

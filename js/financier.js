// ==========================================
// FINANCIER DETAILS PAGE
// HP Finance Tracking - admin and accounts only
// ==========================================

console.log('=== FINANCIER PAGE ===');

// Module-level state
let records = [];
let currentInvoiceNo = null;
let currentFilters = { customerName: '', refCustomer: '', financier: '' };

// ==========================================
// AUTHENTICATION & INITIALIZATION
// ==========================================

window.addEventListener('DOMContentLoaded', async () => {
  const session = SessionManager.getSession();

  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const validation = await API.validateSession(session.sessionId);

  if (!validation.success) {
    SessionManager.clearSession();
    window.location.href = 'index.html';
    return;
  }

  const role = validation.user.role;

  if (role !== 'admin' && role !== 'accounts') {
    alert('Access denied. This page is only for Admin and Accounts users.');
    window.location.href = 'dashboard.html';
    return;
  }

  console.log('User:', validation.user.name, '| Role:', role);

  // Load all data on page load (no filters)
  loadFinancierData({});
});

// ==========================================
// DATA LOADING
// ==========================================

/**
 * Load financier data with optional filters.
 * filters: { customerName, refCustomer, financier } — all optional strings
 */
async function loadFinancierData(filters) {
  const session = SessionManager.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const sessionId = session.sessionId;

  // Always fetch all data from GAS; filtering is done client-side
  const params = { sessionId, customerName: '', refCustomer: '', financier: '' };

  // Show loading state
  const tbody = document.getElementById('financierBody');
  tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:40px;color:#666;">Loading...</td></tr>';

  try {
    const response = await API.call('getFinancierData', params);

    if (response.success) {
      records = response.data || [];
      populateDropdowns(records);
      renderTable(records);
      console.log('Loaded', records.length, 'financier records');
    } else {
      tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:40px;color:#dc3545;">' +
        'Error: ' + (response.message || 'Failed to load data') + '</td></tr>';
    }
  } catch (error) {
    console.error('Error loading financier data:', error);
    tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:40px;color:#dc3545;">' +
      'Error: ' + error.message + '</td></tr>';
  }
}

// ==========================================
// DROPDOWN POPULATION
// ==========================================

/**
 * Populate Ref Customer and Financier dropdowns from all loaded records.
 * Preserves existing selections when reloading.
 */
function populateDropdowns(data) {
  const refSet = new Set();
  const finSet = new Set();

  data.forEach(function(r) {
    if (r.refCustomer) refSet.add(r.refCustomer);
    if (r.financier)   finSet.add(r.financier);
  });

  function rebuildSelect(id, values) {
    const sel = document.getElementById(id);
    const prev = new Set(Array.from(sel.selectedOptions).map(o => o.value));
    sel.innerHTML = '';
    Array.from(values).sort().forEach(function(v) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      if (prev.has(v)) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  rebuildSelect('filterRefCustomer', refSet);
  rebuildSelect('filterFinancier', finSet);
}

// ==========================================
// TABLE RENDERING
// ==========================================

/**
 * Format a number as Indian currency string (e.g. ₹1,23,456)
 */
function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  // Indian numbering: last 3 digits, then groups of 2
  const str = Math.abs(Math.round(num)).toString();
  let result = '';
  if (str.length <= 3) {
    result = str;
  } else {
    result = str.slice(-3);
    let remaining = str.slice(0, str.length - 3);
    while (remaining.length > 2) {
      result = remaining.slice(-2) + ',' + result;
      remaining = remaining.slice(0, remaining.length - 2);
    }
    result = remaining + ',' + result;
  }
  return '₹' + (num < 0 ? '-' : '') + result;
}

/**
 * Return value or em-dash if blank/null/undefined
 */
function displayVal(val) {
  if (val === null || val === undefined || val === '') return '—';
  return val;
}

/**
 * Render records into the table body
 */
function renderTable(data) {
  const tbody = document.getElementById('financierBody');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:40px;color:#666;">No records found</td></tr>';
    return;
  }

  let html = '';

  data.forEach(function(record) {
    const disbursalAmount = parseFloat(record.disbursalAmount) || 0;
    const amountReceived  = parseFloat(record.amountReceived)  || 0;

    let differenceHtml;
    if (record.disbursalAmount === '' && record.amountReceived === '') {
      // Both blank — no meaningful difference
      const diff = 0;
      differenceHtml = '<span style="color:#999;">—</span>';
    } else {
      const diff = disbursalAmount - amountReceived;
      if (diff > 0) {
        differenceHtml = '<span style="color:#28a745;font-weight:600;">' + formatCurrency(diff) + '</span>';
      } else if (diff < 0) {
        differenceHtml = '<span style="color:#dc3545;font-weight:600;">' + formatCurrency(diff) + '</span>';
      } else {
        differenceHtml = '<span style="color:#999;">' + formatCurrency(0) + '</span>';
      }
    }

    html += '<tr>';
    html += '<td>' + displayVal(record.srNo) + '</td>';
    html += '<td>' + displayVal(record.invoiceNo) + '</td>';
    html += '<td>' + displayVal(record.invoiceDate) + '</td>';
    html += '<td>' + displayVal(record.customerName) + '</td>';
    html += '<td>' + displayVal(record.mobileNo) + '</td>';
    html += '<td>' + displayVal(record.modelName) + '</td>';
    html += '<td>' + displayVal(record.refCustomer) + '</td>';
    html += '<td>' + displayVal(record.financier) + '</td>';
    html += '<td>' + (record.disbursalAmount !== '' && record.disbursalAmount !== null && record.disbursalAmount !== undefined ? formatCurrency(record.disbursalAmount) : '—') + '</td>';
    html += '<td>' + (record.amountReceived  !== '' && record.amountReceived  !== null && record.amountReceived  !== undefined ? formatCurrency(record.amountReceived)  : '—') + '</td>';
    html += '<td>' + displayVal(record.receivedDate) + '</td>';
    html += '<td>' + displayVal(record.doDate) + '</td>';
    html += '<td>' + displayVal(record.doNumber) + '</td>';
    html += '<td>' + differenceHtml + '</td>';
    html += '<td>';
    html += '<button class="btn-edit" onclick="openEditModal(' + JSON.stringify(record).replace(/"/g, '&quot;') + ')" title="Edit">';
    html += '&#9998;';
    html += '</button>';
    html += '</td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;
}

// ==========================================
// EDIT MODAL
// ==========================================

/**
 * Open the edit modal populated with record data
 */
function openEditModal(record) {
  currentInvoiceNo = record.invoiceNo;

  // Populate read-only invoice no label
  document.getElementById('modalInvoiceNo').textContent = record.invoiceNo || '—';

  // Populate input fields
  document.getElementById('editDisbursalAmount').value = (record.disbursalAmount !== '' && record.disbursalAmount !== null && record.disbursalAmount !== undefined) ? record.disbursalAmount : '';
  document.getElementById('editAmountReceived').value  = (record.amountReceived  !== '' && record.amountReceived  !== null && record.amountReceived  !== undefined) ? record.amountReceived  : '';
  document.getElementById('editReceivedDate').value    = record.receivedDate || '';
  document.getElementById('editDoDate').value          = record.doDate       || '';
  document.getElementById('editDoNumber').value        = record.doNumber     || '';

  // Clear modal error
  const errEl = document.getElementById('modalError');
  errEl.textContent = '';
  errEl.style.display = 'none';

  // Show modal
  document.getElementById('editModal').style.display = 'flex';
}

/**
 * Close the edit modal
 */
function closeModal() {
  document.getElementById('editModal').style.display = 'none';
  currentInvoiceNo = null;
}

// ==========================================
// SAVE FINANCIER DATA
// ==========================================

/**
 * Save edits for the currently open invoice
 */
async function saveFinancierData() {
  const session = SessionManager.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  if (!currentInvoiceNo) {
    showModalError('No invoice selected.');
    return;
  }

  const disbursalAmountRaw = document.getElementById('editDisbursalAmount').value.trim();
  const amountReceivedRaw  = document.getElementById('editAmountReceived').value.trim();
  const receivedDate = document.getElementById('editReceivedDate').value.trim();
  const doDate       = document.getElementById('editDoDate').value.trim();
  const doNumber     = document.getElementById('editDoNumber').value.trim();

  // Validate numbers if provided
  let disbursalAmount = '';
  let amountReceived  = '';

  if (disbursalAmountRaw !== '') {
    const parsed = parseFloat(disbursalAmountRaw);
    if (isNaN(parsed)) {
      showModalError('Disbursal Amount must be a valid number.');
      return;
    }
    disbursalAmount = parsed;
  }

  if (amountReceivedRaw !== '') {
    const parsed = parseFloat(amountReceivedRaw);
    if (isNaN(parsed)) {
      showModalError('Amount Received must be a valid number.');
      return;
    }
    amountReceived = parsed;
  }

  // Disable save button during request
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const response = await API.call('saveFinancierData', {
      sessionId: session.sessionId,
      invoiceNo: currentInvoiceNo,
      disbursalAmount: disbursalAmount,
      amountReceived:  amountReceived,
      receivedDate:    receivedDate,
      doDate:          doDate,
      doNumber:        doNumber
    });

    if (response.success) {
      closeModal();
      showMessage('Financier data saved successfully.', 'success');
      // Reload with current filters
      loadFinancierData(currentFilters);
    } else {
      showModalError('Error: ' + (response.message || 'Failed to save data'));
    }
  } catch (error) {
    console.error('Error saving financier data:', error);
    showModalError('Error: ' + error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

// ==========================================
// FILTER FUNCTIONS
// ==========================================

/**
 * Read filter inputs and reload data
 */
function applyFilters() {
  const customerName = document.getElementById('filterCustomer').value.trim();

  // Multi-select: collect all selected option values
  const refSel = document.getElementById('filterRefCustomer');
  const refSelected = Array.from(refSel.selectedOptions).map(o => o.value).filter(Boolean);

  const finSel = document.getElementById('filterFinancier');
  const finSelected = Array.from(finSel.selectedOptions).map(o => o.value).filter(Boolean);

  currentFilters = { customerName, refCustomer: refSelected, financier: finSelected };

  // Filter client-side from full records list (avoids extra API call)
  const filtered = records.filter(function(r) {
    if (customerName && r.customerName.toLowerCase().indexOf(customerName.toLowerCase()) === -1) return false;
    if (refSelected.length > 0 && !refSelected.includes(r.refCustomer)) return false;
    if (finSelected.length > 0 && !finSelected.includes(r.financier)) return false;
    return true;
  });

  renderTable(filtered);
}

/**
 * Clear all filter inputs and re-render full records list
 */
function clearFilters() {
  document.getElementById('filterCustomer').value = '';

  // Deselect all options in multi-selects
  Array.from(document.getElementById('filterRefCustomer').options).forEach(o => o.selected = false);
  Array.from(document.getElementById('filterFinancier').options).forEach(o => o.selected = false);

  currentFilters = { customerName: '', refCustomer: [], financier: [] };
  renderTable(records);
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Show a page-level message (success or error)
 */
function showMessage(text, type) {
  const el = document.getElementById('pageMessage');
  el.textContent = text;
  el.className = 'page-message ' + type;
  el.style.display = 'block';

  // Auto-hide success messages after 4 seconds
  if (type === 'success') {
    setTimeout(function() {
      el.style.display = 'none';
    }, 4000);
  }
}

/**
 * Show an error message inside the edit modal
 */
function showModalError(text) {
  const el = document.getElementById('modalError');
  el.textContent = text;
  el.style.display = 'block';
}

// Close modal when clicking the overlay background
window.addEventListener('click', function(e) {
  const modal = document.getElementById('editModal');
  if (e.target === modal) {
    closeModal();
  }
});

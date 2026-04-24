// ==========================================
// BUSY UPLOAD PAGE
// Vehicle Name Master + V Series Export
// ==========================================

let currentUserRole = null;

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
    alert('Access denied.');
    window.location.href = 'home.html';
    return;
  }

  currentUserRole = validation.user.role;

  // Set default date range (current month) for both cards
  const now      = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fd = fmtInputDate(firstDay);
  const ld = fmtInputDate(lastDay);

  document.getElementById('vim_fromDate').value = fd;
  document.getElementById('vim_toDate').value   = ld;
  document.getElementById('vs_fromDate').value  = fd;
  document.getElementById('vs_toDate').value    = ld;

  showFilterType('vim', 'date');
  showFilterType('vs',  'date');
});

// ==========================================
// SHARED HELPERS
// ==========================================

function fmtInputDate(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function showFilterType(prefix, type) {
  document.getElementById(prefix + '_dateFilterGroup').style.display    = type === 'date'    ? 'block' : 'none';
  document.getElementById(prefix + '_invoiceFilterGroup').style.display = type === 'invoice' ? 'block' : 'none';
  document.querySelectorAll('.filter-tab[data-prefix="' + prefix + '"]').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

function getFilterParams(prefix) {
  const activeTab = document.querySelector('.filter-tab[data-prefix="' + prefix + '"].active');
  const filterType = activeTab ? activeTab.dataset.type : 'date';
  const params = { filterType: filterType, fromDate: '', toDate: '', fromInvoice: '', toInvoice: '' };

  if (filterType === 'date') {
    params.fromDate = document.getElementById(prefix + '_fromDate').value;
    params.toDate   = document.getElementById(prefix + '_toDate').value;
    if (!params.fromDate || !params.toDate) return { error: 'Please select both From and To dates.' };
    if (new Date(params.fromDate) > new Date(params.toDate)) return { error: 'From date cannot be after To date.' };
  } else {
    params.fromInvoice = document.getElementById(prefix + '_fromInvoice').value.trim();
    params.toInvoice   = document.getElementById(prefix + '_toInvoice').value.trim();
    if (!params.fromInvoice || !params.toInvoice) return { error: 'Please enter both From and To invoice numbers.' };
  }
  return params;
}

function showStatus(prefix, msg, type) {
  var el = document.getElementById(prefix + '_statusMsg');
  el.textContent = msg;
  el.className = 'status-msg ' + type;
  el.style.display = 'block';
}

function splitAddress(address) {
  if (!address) return ['', '', ''];
  const parts = address.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  if (parts.length === 0) return ['', '', ''];
  if (parts.length <= 3) { while (parts.length < 3) parts.push(''); return parts; }
  return [parts[0], parts[1], parts.slice(2).join(', ')];
}

function getCurrentMonthName() {
  return ['January','February','March','April','May','June',
          'July','August','September','October','November','December'][new Date().getMonth()];
}

function todayDateSuffix() {
  const now = new Date();
  return now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');
}

// ==========================================
// VEHICLE NAME MASTER
// ==========================================

async function generateVehicleNameMaster() {
  const params = getFilterParams('vim');
  if (params.error) { showStatus('vim', params.error, 'error'); return; }

  showStatus('vim', '⏳ Fetching data...', 'info');
  document.getElementById('vim_generateBtn').disabled = true;

  try {
    const response = await API.getBusyUploadData(
      params.filterType, params.fromDate, params.toDate, params.fromInvoice, params.toInvoice
    );
    document.getElementById('vim_generateBtn').disabled = false;

    if (!response.success) { showStatus('vim', '⚠️ ' + (response.message || 'Failed'), 'error'); return; }
    if (!response.data || response.data.length === 0) { showStatus('vim', 'No records found.', 'error'); return; }

    buildVehicleNameMasterExcel(response.data);
    showStatus('vim', '✅ Downloaded — ' + response.data.length + ' records', 'success');
  } catch(e) {
    document.getElementById('vim_generateBtn').disabled = false;
    showStatus('vim', 'Error: ' + e.message, 'error');
  }
}

function buildVehicleNameMasterExcel(records) {
  const monthName = getCurrentMonthName();
  const rows = [['Customer Name', '', 'Ref Customer', 'Address 1', 'Address 2', 'Address 3', 'Mobile No']];

  records.forEach(function(r) {
    const addrParts = splitAddress(r.customerAddress);
    const refVal    = (r.refCustomer || '').replace(/vinay automobiles/i, monthName);
    rows.push([
      r.customerName || '',
      '',
      refVal,
      addrParts[0],
      addrParts[1],
      addrParts[2],
      r.mobileNo || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vehicle Name Master');
  XLSX.writeFile(wb, 'Vehicle_Name_Master_' + todayDateSuffix() + '.xlsx');
}

// ==========================================
// V SERIES EXPORT
// ==========================================

async function generateVSeriesExport() {
  const params = getFilterParams('vs');
  if (params.error) { showStatus('vs', params.error, 'error'); return; }

  showStatus('vs', '⏳ Fetching data...', 'info');
  document.getElementById('vs_generateBtn').disabled = true;

  try {
    const response = await API.getVSeriesExportData(
      params.filterType, params.fromDate, params.toDate, params.fromInvoice, params.toInvoice
    );
    document.getElementById('vs_generateBtn').disabled = false;

    if (!response.success) { showStatus('vs', '⚠️ ' + (response.message || 'Failed'), 'error'); return; }
    if (!response.data || response.data.length === 0) { showStatus('vs', 'No records found.', 'error'); return; }

    buildVSeriesExcel(response.data);
    showStatus('vs', '✅ Downloaded — ' + response.data.length + ' records', 'success');
  } catch(e) {
    document.getElementById('vs_generateBtn').disabled = false;
    showStatus('vs', 'Error: ' + e.message, 'error');
  }
}

function buildVSeriesExcel(records) {
  // Header row (A–R = 18 cols)
  const header = [
    'Series',           // A
    'Voucher Inv Date', // B
    'Voucher Number',   // C
    'Model Name',       // D
    'Frame Number',     // E
    'Engine Number',    // F
    'Customer Name',    // G
    'HP Company',       // H
    'Insurance',        // I
    '',                 // J (blank)
    'Accessories',      // K
    'Invoice Amount',   // L
    'Broker Name',      // M
    'Quantity',         // N
    'Unit',             // O
    'Sale/Purc Type',   // P
    'MC Name',          // Q
    'Qty'               // R
  ];

  const rows = [header];

  records.forEach(function(r) {
    rows.push([
      'V',                                        // A: Series
      r.invoiceDate    || '',                      // B: Voucher Invoice Date
      'V/' + (r.invoiceNo || '') + '/26-27',       // C: Voucher Number
      r.modelName      || '',                      // D: Model Name
      r.frameNo        || '',                      // E: Frame Number
      r.engineNo       || '',                      // F: Engine Number
      r.customerName   || '',                      // G: Customer Name
      r.hpCompany      || '',                      // H: HP Company
      'SBI General Insurance',                     // I: Insurance
      '',                                          // J: Blank
      r.accessories    || 'N',                     // K: Accessories Y/N
      r.invoiceAmount  || '',                      // L: Invoice Amount
      r.brokerName     || '',                      // M: Broker Name
      1,                                           // N: Quantity
      'Nos',                                       // O: Unit
      'GST SALES',                                 // P: Sale/Purc Type
      'Main Store',                                // Q: MC Name
      1                                            // R: Qty
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 8  }, // A
    { wch: 14 }, // B
    { wch: 22 }, // C
    { wch: 20 }, // D
    { wch: 20 }, // E
    { wch: 20 }, // F
    { wch: 28 }, // G
    { wch: 20 }, // H
    { wch: 22 }, // I
    { wch: 5  }, // J
    { wch: 12 }, // K
    { wch: 14 }, // L
    { wch: 20 }, // M
    { wch: 10 }, // N
    { wch: 8  }, // O
    { wch: 14 }, // P
    { wch: 14 }, // Q
    { wch: 8  }  // R
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'V Series Export');
  XLSX.writeFile(wb, 'V_Series_Export_' + todayDateSuffix() + '.xlsx');
}

// ==========================================
// NAVIGATION
// ==========================================

function goBack() { window.location.href = 'home.html'; }

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
  document.getElementById('std_fromDate').value   = fd;
  document.getElementById('std_toDate').value     = ld;
  document.getElementById('vahan_fromDate').value = fd;
  document.getElementById('vahan_toDate').value   = ld;

  showFilterType('vim',   'date');
  showFilterType('vs',    'date');
  showFilterType('std',   'date');
  showFilterType('vahan', 'date');
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
    'Scheme',           // J
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
      'No',                                        // J: Scheme
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
// STANDARD ACCESSORIES EXPORT
// ==========================================

// Cached fetch results
var _stdVaData      = [];
var _stdNonVaInvoices = [];

async function generateStdAccessoriesExport() {
  const params = getFilterParams('std');
  if (params.error) { showStatus('std', params.error, 'error'); return; }

  showStatus('std', '⏳ Fetching invoices...', 'info');
  document.getElementById('std_generateBtn').disabled = true;
  document.getElementById('std_nonVaSection').style.display = 'none';

  try {
    const response = await API.getStdAccessoriesExportData(
      params.filterType, params.fromDate, params.toDate, params.fromInvoice, params.toInvoice
    );
    document.getElementById('std_generateBtn').disabled = false;

    if (!response.success) { showStatus('std', '⚠️ ' + (response.message || 'Failed'), 'error'); return; }

    _stdVaData       = response.vaData       || [];
    _stdNonVaInvoices = response.nonVaInvoices || [];

    var vaCount    = _stdVaData.length;
    var nonVaCount = _stdNonVaInvoices.length;

    if (vaCount === 0 && nonVaCount === 0) {
      showStatus('std', 'No invoices found in this range.', 'error'); return;
    }

    if (nonVaCount === 0) {
      // Only VA records — download directly
      buildStdAccessoriesExcel(_stdVaData, []);
      showStatus('std', '✅ Downloaded — ' + vaCount + ' accessory rows', 'success');
      return;
    }

    // Non-VA invoices present — show manual entry form
    renderNonVaForm(_stdNonVaInvoices);
    document.getElementById('std_nonVaSection').style.display = 'block';
    var msg = '✅ Fetched. VA rows: ' + vaCount + '. ';
    msg += 'Non-VA invoices: ' + nonVaCount + ' — enter amounts below then click Download.';
    showStatus('std', msg, 'info');

  } catch(e) {
    document.getElementById('std_generateBtn').disabled = false;
    showStatus('std', 'Error: ' + e.message, 'error');
  }
}

function renderNonVaForm(invoices) {
  var iStyle = 'width:100%;padding:6px 8px;border:1.5px solid #e0e0e0;border-radius:6px;font-size:13px;box-sizing:border-box;';
  var html = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
  html += '<thead><tr style="background:#f0f0f0;">';
  html += '<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Invoice No</th>';
  html += '<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Date</th>';
  html += '<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Customer</th>';
  html += '<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Model</th>';
  html += '<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Std Accessories (₹)</th>';
  html += '</tr></thead><tbody>';

  invoices.forEach(function(inv, i) {
    html += '<tr>';
    html += '<td style="padding:5px 8px;border:1px solid #ddd;font-weight:600;white-space:nowrap;">' + (inv.invoiceNo    || '') + '</td>';
    html += '<td style="padding:5px 8px;border:1px solid #ddd;white-space:nowrap;">'                 + (inv.invoiceDate || '') + '</td>';
    html += '<td style="padding:5px 8px;border:1px solid #ddd;">'                                    + (inv.customerName|| '') + '</td>';
    html += '<td style="padding:5px 8px;border:1px solid #ddd;white-space:nowrap;">'                 + (inv.modelName   || '') + '</td>';
    html += '<td style="padding:5px 8px;border:1px solid #ddd;"><input type="number" id="nonva_sa_' + i + '" min="0" placeholder="0" style="' + iStyle + '"></td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('std_nonVaTable').innerHTML = html;
}

function downloadStdExcel() {
  // Collect non-VA rows — service charge always 1380; std accessories from manual input
  var nonVaRows = [];
  _stdNonVaInvoices.forEach(function(inv, i) {
    var saVal = parseFloat((document.getElementById('nonva_sa_' + i) || {}).value) || 0;

    // Standard Accessories — manual input
    if (saVal > 0) {
      nonVaRows.push({
        invoiceDate:  inv.invoiceDate,
        invoiceNo:    inv.invoiceNo,
        customerName: inv.customerName,
        itemName:     'Standard Accessories',
        quantity:     1,
        unitPrice:    Math.round((saVal / 1.18) * 100) / 100,
        amount:       saVal
      });
    }

    // Service Charge — fixed 1380 for all non-VA customers
    nonVaRows.push({
      invoiceDate:  inv.invoiceDate,
      invoiceNo:    inv.invoiceNo,
      customerName: inv.customerName,
      itemName:     'Service Charge',
      quantity:     1,
      unitPrice:    Math.round((1380 / 1.18) * 100) / 100,
      amount:       1380
    });
  });

  var total = _stdVaData.length + nonVaRows.length;
  if (total === 0) { showStatus('std', 'No data to download — enter at least one amount.', 'error'); return; }

  buildStdAccessoriesExcel(_stdVaData, nonVaRows);
  showStatus('std', '✅ Downloaded — ' + total + ' rows (' + _stdVaData.length + ' VA + ' + nonVaRows.length + ' non-VA)', 'success');
}

function buildStdAccessoriesExcel(vaRecords, nonVaRecords) {
  var records = (vaRecords || []).concat(nonVaRecords || []);
  const header = [
    'Series',      // A
    'Date',        // B
    'Invoice No',  // C
    'Sale Type',   // D
    'Party Name',  // E
    'MC_Name',     // F
    'Item Name',   // G
    'Quantity',    // H
    'Unit',        // I
    'Price',       // J
    'CGST %',      // K
    'SGST %',      // L
    'Amount'       // M
  ];

  const rows = [header];

  records.forEach(function(r) {
    rows.push([
      'STD',                                    // A
      r.invoiceDate,                            // B
      'STD/' + (r.invoiceNo || '') + '/26-27',  // C
      'GST SALES',                              // D
      r.customerName || '',                     // E
      'Main Store',                             // F
      r.itemName     || '',                     // G
      r.quantity,                               // H
      'Pcs.',                                   // I
      r.unitPrice,                              // J  (price master rate / 1.18)
      9,                                        // K
      9,                                        // L
      r.amount                                  // M  (price master rate × qty)
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 8  }, // A Series
    { wch: 14 }, // B Date
    { wch: 22 }, // C Invoice No
    { wch: 12 }, // D Sale Type
    { wch: 28 }, // E Party Name
    { wch: 12 }, // F MC_Name
    { wch: 16 }, // G Item Name
    { wch: 10 }, // H Quantity
    { wch: 8  }, // I Unit
    { wch: 12 }, // J Price
    { wch: 8  }, // K CGST %
    { wch: 8  }, // L SGST %
    { wch: 12 }  // M Amount
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Std Accessories');
  XLSX.writeFile(wb, 'Std_Accessories_Export_' + todayDateSuffix() + '.xlsx');
}

// ==========================================
// HARITA INSURANCE EXPORT (frontend-only)
// Input: RazorPay statement xlsx
// Col J=Date, Col K=Narration, Col R=AccName, Col V=Amount
// ==========================================

async function generateHaritaInsuranceExport() {
  const fileInput  = document.getElementById('harita_file');
  const startInput = document.getElementById('harita_startVoucher');

  if (!fileInput.files || !fileInput.files[0]) {
    showStatus('harita', 'Please select a file.', 'error'); return;
  }
  const startVoucher = parseInt(startInput.value, 10);
  if (isNaN(startVoucher) || startVoucher < 1) {
    showStatus('harita', 'Please enter a valid starting voucher number.', 'error'); return;
  }

  showStatus('harita', '⏳ Processing file...', 'info');
  document.getElementById('harita_generateBtn').disabled = true;

  try {
    const ab = await fileInput.files[0].arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Row 0 is header — start from row 1
    const records = [];
    for (var i = 1; i < rawData.length; i++) {
      var row = rawData[i];
      // Skip empty rows (no date and no acc name)
      var dateVal = row[9];  // Col J
      var accName = (row[17] || '').toString().trim(); // Col R
      if (!dateVal && !accName) continue;

      records.push({
        date:      formatDateDDMMYYYY(dateVal),
        narration: (row[10] || '').toString().trim(), // Col K
        accName:   accName,
        amount:    row[21] || ''                       // Col V
      });
    }

    document.getElementById('harita_generateBtn').disabled = false;

    if (records.length === 0) {
      showStatus('harita', 'No data rows found in file.', 'error'); return;
    }

    buildHaritaExcel(records, startVoucher);
    showStatus('harita', '✅ Downloaded — ' + records.length + ' transactions (' + (records.length * 2) + ' rows)', 'success');

  } catch(e) {
    document.getElementById('harita_generateBtn').disabled = false;
    showStatus('harita', 'Error: ' + e.message, 'error');
    console.error(e);
  }
}

function formatDateDDMMYYYY(val) {
  if (!val && val !== 0) return '';

  // JS Date object (from cellDates: true)
  if (val instanceof Date) {
    return String(val.getDate()).padStart(2, '0') + '/' +
           String(val.getMonth() + 1).padStart(2, '0') + '/' +
           val.getFullYear();
  }

  // Excel date serial number
  if (typeof val === 'number') {
    try {
      var parsed = XLSX.SSF.parse_date_code(val);
      return String(parsed.d).padStart(2, '0') + '/' +
             String(parsed.m).padStart(2, '0') + '/' + parsed.y;
    } catch(e) {}
  }

  // String — handle M/D/YYYY or MM/DD/YYYY
  var str = val.toString().trim();
  var mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    // Assume M/D/YYYY (US format from RazorPay)
    return String(mdy[2]).padStart(2, '0') + '/' +
           String(mdy[1]).padStart(2, '0') + '/' + mdy[3];
  }

  // Fallback: try native Date parse
  try {
    var d = new Date(str);
    if (!isNaN(d)) {
      return String(d.getDate()).padStart(2, '0') + '/' +
             String(d.getMonth() + 1).padStart(2, '0') + '/' +
             d.getFullYear();
    }
  } catch(e) {}

  return str; // return as-is if all parsing fails
}

function buildHaritaExcel(records, startVoucher) {
  var outputRows = [];

  // Header row
  outputRows.push([
    'VCH Series', 'Voucher Date', 'Voucher Number', 'GST Nature',
    'Acc Name', 'Amount DR', 'Amount CR', 'Short Narration'
  ]);

  records.forEach(function(r, i) {
    var voucherNo = startVoucher + i;

    // Row 1: main DR entry
    outputRows.push([
      'RTO/INSU',           // A: VCH Series
      r.date,               // B: Voucher Date
      'INS/' + voucherNo,   // C: Voucher Number
      'Not Applicable', // D: GST Nature
      r.accName,        // E: Acc Name (from col R)
      r.amount,         // F: Amount DR
      '',               // G: Amount CR (blank)
      r.narration       // H: Short Narration
    ]);

    // Row 2: HARITA INSURANCE CR entry
    outputRows.push([
      '',               // A
      '',               // B
      '',               // C
      '',               // D
      'HARITA INSURANCE', // E: Acc Name
      '',               // F: Amount DR (blank)
      r.amount,         // G: Amount CR
      r.narration       // H: Short Narration
    ]);
  });

  var ws = XLSX.utils.aoa_to_sheet(outputRows);
  ws['!cols'] = [
    { wch: 12 }, // A
    { wch: 13 }, // B
    { wch: 16 }, // C
    { wch: 16 }, // D
    { wch: 28 }, // E
    { wch: 12 }, // F
    { wch: 12 }, // G
    { wch: 26 }  // H
  ];

  var outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, ws, 'Harita Insurance');
  XLSX.writeFile(outWb, 'Harita_Insurance_Export_' + todayDateSuffix() + '.xlsx');
}

// ==========================================
// VAHAN EXPORT
// ==========================================

async function generateVahanExport() {
  const params = getFilterParams('vahan');
  if (params.error) { showStatus('vahan', params.error, 'error'); return; }

  const startVoucher = parseInt(document.getElementById('vahan_startVoucher').value, 10);
  if (!startVoucher || startVoucher < 1) {
    showStatus('vahan', 'Please enter a valid starting voucher number.', 'error');
    return;
  }

  showStatus('vahan', '⏳ Fetching data...', 'info');
  document.getElementById('vahan_generateBtn').disabled = true;

  try {
    const response = await API.getVahanExportData(
      params.filterType, params.fromDate, params.toDate, params.fromInvoice, params.toInvoice
    );
    document.getElementById('vahan_generateBtn').disabled = false;

    if (!response.success) { showStatus('vahan', '⚠️ ' + (response.message || 'Failed'), 'error'); return; }
    if (!response.data || response.data.length === 0) { showStatus('vahan', 'No records found.', 'error'); return; }

    buildVahanExcel(response.data, startVoucher);
    showStatus('vahan', '✅ Downloaded — ' + response.data.length + ' records', 'success');
  } catch(e) {
    document.getElementById('vahan_generateBtn').disabled = false;
    showStatus('vahan', 'Error: ' + e.message, 'error');
  }
}

function buildVahanExcel(records, startVoucher) {
  var wb = XLSX.utils.book_new();

  // Build sheet data with header row
  var outputRows = [[
    'Voucher Series',  // A
    'Voucher Date',    // B
    'Voucher Number',  // C
    'GST Nature',      // D
    'Account Name',    // E
    'Amount DR',       // F
    'Amount CR',       // G
    'Short Narration', // H
    'Vehicle Name',    // I
    'HP Company'       // J
  ]];
  var voucherNo  = startVoucher;
  var excelRow   = 2; // 1-indexed; row 1 = header, data starts at row 2

  records.forEach(function(r) {
    var voucherStr = 'RTO/' + voucherNo;

    // Row 1 — customer debit line
    outputRows.push([
      'RTO/INSU',           // A — Voucher Series
      r.invoiceDate,        // B — Voucher Date
      voucherStr,           // C — Voucher Number
      'Not Applicable',     // D — GST Nature
      r.customerName,       // E — Account Name (customer)
      '',                   // F — Amount DR (filled manually)
      '',                   // G — (blank on row 1)
      '',                   // H — Short Narration
      r.modelName,          // I — Vehicle Name
      r.hpCompany           // J — HP Company
    ]);

    var row1ExcelRef = excelRow; // remember row number for formula
    excelRow++;

    // Row 2 — RTO TAX A/C credit line
    outputRows.push([
      '',                   // A
      '',                   // B
      '',                   // C
      '',                   // D
      'RTO TAX A/C',        // E — Account Name (contra)
      '',                   // F
      { f: 'F' + row1ExcelRef }, // G — formula =F<row1> (auto-fills when accountant fills F)
      '',                   // H
      '',                   // I
      ''                    // J
    ]);
    excelRow++;

    voucherNo++;
  });

  var ws = XLSX.utils.aoa_to_sheet(outputRows);

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, // A — Voucher Series
    { wch: 13 }, // B — Voucher Date
    { wch: 12 }, // C — Voucher Number
    { wch: 16 }, // D — GST Nature
    { wch: 32 }, // E — Account Name
    { wch: 12 }, // F — Amount DR
    { wch: 12 }, // G — Amount CR (formula)
    { wch: 20 }, // H — Short Narration
    { wch: 20 }, // I — Vehicle Name
    { wch: 18 }  // J — HP Company
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Vahan Export');
  XLSX.writeFile(wb, 'Vahan_Export_' + todayDateSuffix() + '.xlsx');
}

// ==========================================
// NAVIGATION
// ==========================================

function goBack() { window.location.href = 'home.html'; }

// ==========================================
// BUSY UPLOAD PAGE
// Vehicle Invoice Master Excel Export
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

  // Set default date range to current month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  document.getElementById('fromDate').value = fmtInputDate(firstDay);
  document.getElementById('toDate').value   = fmtInputDate(lastDay);

  // Show first filter type
  showFilterType('date');
});

function fmtInputDate(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function showFilterType(type) {
  document.getElementById('dateFilterGroup').style.display   = type === 'date'    ? 'block' : 'none';
  document.getElementById('invoiceFilterGroup').style.display = type === 'invoice' ? 'block' : 'none';
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

// ==========================================
// GENERATE VEHICLE INVOICE MASTER
// ==========================================

async function generateVehicleInvoiceMaster() {
  const filterType = document.querySelector('.filter-tab.active')
    ? document.querySelector('.filter-tab.active').dataset.type
    : 'date';

  let fromDate = '', toDate = '', fromInvoice = '', toInvoice = '';

  if (filterType === 'date') {
    fromDate = document.getElementById('fromDate').value;
    toDate   = document.getElementById('toDate').value;
    if (!fromDate || !toDate) {
      showStatus('Please select both From and To dates.', 'error');
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      showStatus('From date cannot be after To date.', 'error');
      return;
    }
  } else {
    fromInvoice = document.getElementById('fromInvoice').value.trim();
    toInvoice   = document.getElementById('toInvoice').value.trim();
    if (!fromInvoice || !toInvoice) {
      showStatus('Please enter both From and To invoice numbers.', 'error');
      return;
    }
  }

  showStatus('⏳ Fetching data...', 'info');
  document.getElementById('generateBtn').disabled = true;

  try {
    const response = await API.getBusyUploadData(filterType, fromDate, toDate, fromInvoice, toInvoice);

    document.getElementById('generateBtn').disabled = false;

    if (!response.success) {
      showStatus('⚠️ ' + (response.message || 'Failed to load data'), 'error');
      return;
    }

    if (!response.data || response.data.length === 0) {
      showStatus('No records found for the selected filter.', 'error');
      return;
    }

    buildExcel(response.data);
    showStatus('✅ Excel downloaded — ' + response.data.length + ' records', 'success');

  } catch(e) {
    document.getElementById('generateBtn').disabled = false;
    showStatus('Error: ' + e.message, 'error');
    console.error(e);
  }
}

// ==========================================
// EXCEL BUILDER (SheetJS)
// ==========================================

function splitAddress(address) {
  if (!address) return ['', '', ''];
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return ['', '', ''];
  if (parts.length <= 3) {
    while (parts.length < 3) parts.push('');
    return parts;
  }
  // More than 3 — merge overflow into 3rd column
  return [parts[0], parts[1], parts.slice(2).join(', ')];
}

function getCurrentMonthName() {
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return months[new Date().getMonth()];
}

function buildExcel(records) {
  const monthName = getCurrentMonthName();

  // Build rows: header + data
  const header = ['Customer Name', '', 'Ref Customer', 'Address 1', 'Address 2', 'Address 3', 'Mobile No'];
  const rows = [header];

  records.forEach(function(r) {
    const addrParts = splitAddress(r.customerAddress);
    // Replace "Vinay Automobiles" (case-insensitive) in refCustomer with month name
    const refVal = (r.refCustomer || '').replace(/vinay automobiles/i, monthName);

    rows.push([
      r.customerName || '',   // A: Customer Name
      '',                     // B: Blank
      refVal,                 // C: Ref Customer (Vinay Automobiles → month name)
      addrParts[0],           // D: Address part 1
      addrParts[1],           // E: Address part 2
      addrParts[2],           // F: Address part 3
      r.mobileNo || ''        // G: Mobile No
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 30 }, // A
    { wch: 5  }, // B
    { wch: 15 }, // C
    { wch: 25 }, // D
    { wch: 25 }, // E
    { wch: 25 }, // F
    { wch: 14 }  // G
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vehicle Invoice Master');

  const now = new Date();
  const dateSuffix = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  XLSX.writeFile(wb, 'Vehicle_Invoice_Master_' + dateSuffix + '.xlsx');
}

// ==========================================
// UI HELPERS
// ==========================================

function showStatus(msg, type) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.className = 'status-msg ' + type;
  el.style.display = 'block';
}

function goBack() {
  window.location.href = 'home.html';
}

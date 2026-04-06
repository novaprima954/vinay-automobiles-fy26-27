// ==========================================
// SALARY TRACKER MODULE
// Vinay Automobiles
// ==========================================

let salaryEmployees = [];
let currentUser = null;
let uploadedRecords = [];
let currentUploadType = 'EPF';
let currentPaymentType = 'Incentive';
let currentReportType = 'employee';

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
  // Check login session
  const session = SessionManager.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = session.user;

  // Display user in header
  document.getElementById('headerUser').textContent = currentUser.name || '';

  // Accounts role: skip password, go straight in
  if (currentUser.role === 'accounts') {
    showMainContent();
    initApp();
  } else if (checkSalaryAuth()) {
    showMainContent();
    initApp();
  } else {
    showPasswordOverlay();
  }

});

// ==========================================
// AUTH
// ==========================================

function checkSalaryAuth() {
  try {
    // Clear any old localStorage entry (migration to sessionStorage)
    localStorage.removeItem('salaryAuth');
    const raw = sessionStorage.getItem('salaryAuth');
    if (!raw) return false;
    const auth = JSON.parse(raw);
    return !!(auth && auth.ok);
  } catch (e) {
    return false;
  }
}

function showPasswordOverlay() {
  document.getElementById('passwordOverlay').style.display = 'flex';
  document.getElementById('mainContent').style.display = 'none';
  setTimeout(function () {
    document.getElementById('salaryPwd').focus();
  }, 100);
}

function showMainContent() {
  document.getElementById('passwordOverlay').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
}

async function submitPassword() {
  const pwd = document.getElementById('salaryPwd').value;
  if (!pwd) {
    document.getElementById('pwdError').textContent = 'Please enter password';
    return;
  }
  document.getElementById('pwdError').textContent = 'Checking...';

  try {
    const response = await API.verifySalaryPassword(pwd);
    if (response.success) {
      sessionStorage.setItem('salaryAuth', JSON.stringify({ ok: true }));
      showMainContent();
      initApp();
    } else {
      document.getElementById('pwdError').textContent = 'Incorrect password';
      document.getElementById('salaryPwd').value = '';
      document.getElementById('salaryPwd').focus();
    }
  } catch (e) {
    document.getElementById('pwdError').textContent = 'Error: ' + e.message;
  }
}

// ==========================================
// APP INIT
// ==========================================

function initApp() {
  populateMonthSelects();
  populateFYSelect();
  populateBonusPeriods();
  setupRoleAccess();
  loadEmployees();
}

function setupRoleAccess() {
  if (currentUser && currentUser.role === 'accounts') {
    document.getElementById('reportsTabBtn').style.display = 'none';
  }
  // Only admin can add/edit employees
  if (currentUser && currentUser.role !== 'admin') {
    const addCard = document.querySelector('[onclick="toggleAddEmployeeForm()"]');
    if (addCard) addCard.closest('.card').style.display = 'none';
  }
}

// ==========================================
// UTILITY
// ==========================================

function formatCurrency(n) {
  return '\u20b9' + Number(n || 0).toLocaleString('en-IN');
}

function monthLabel(m) {
  // '2026-03' -> 'March 2026'
  if (!m) return '';
  const parts = m.split('-');
  if (parts.length < 2) return m;
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const idx = parseInt(parts[1], 10) - 1;
  return (months[idx] || parts[1]) + ' ' + parts[0];
}

function getLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(y + '-' + m);
  }
  return months;
}

function populateMonthSelects() {
  const months = getLast12Months();
  const ids = ['uploadMonth', 'inc_month', 'rep_month'];
  ids.forEach(function (id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = months.map(function (m) {
      return '<option value="' + m + '">' + monthLabel(m) + '</option>';
    }).join('');
  });
}

function populateFYSelect() {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1-12
  // FY starts April: if Jan-Mar we're still in previous FY
  const fyStartYear = curMonth >= 4 ? curYear : curYear - 1;
  const currentFY = fyStartYear + '-' + String(fyStartYear + 1).slice(-2);
  // Update display and hidden field
  const displayEl = document.getElementById('rep_fy_display');
  const hiddenEl = document.getElementById('rep_fy');
  if (displayEl) displayEl.textContent = currentFY;
  if (hiddenEl) hiddenEl.value = currentFY;
}

function populateBonusPeriods() {
  const sel = document.getElementById('bon_period');
  if (!sel) return;
  // Generate 4 most recent half-year periods
  const now = new Date();
  const curYear = now.getFullYear();
  const periods = [];
  // Oct-Mar and Apr-Sep periods around current year
  // We generate for curYear-1, curYear, curYear+1
  for (let y = curYear - 1; y <= curYear + 1; y++) {
    periods.push({ label: 'Apr ' + y + ' \u2013 Sep ' + y, startMonth: y + '-04' });
    periods.push({ label: 'Oct ' + y + ' \u2013 Mar ' + (y + 1), startMonth: y + '-10' });
  }
  // Sort descending by startMonth
  periods.sort(function (a, b) { return b.startMonth.localeCompare(a.startMonth); });
  // Take 4 most recent that are <= current period
  const now_month = curYear + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const filtered = periods.filter(function (p) { return p.startMonth <= now_month; }).slice(0, 4);
  sel.innerHTML = filtered.map(function (p) {
    return '<option value="' + p.label + '" data-startmonth="' + p.startMonth + '">' + p.label + '</option>';
  }).join('');
}

function showMsg(elId, text, type) {
  // type: 'success' | 'error' | 'info'
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '<div class="msg msg-' + type + '">' + text + '</div>';
  if (type === 'success') {
    setTimeout(function () { el.innerHTML = ''; }, 4000);
  }
}

function toggleUanField(groupId, paymentType) {
  const group = document.getElementById(groupId);
  if (!group) return;
  if (paymentType === 'EPF') {
    group.style.display = 'flex';
  } else {
    group.style.display = 'none';
    const input = group.querySelector('input');
    if (input) input.value = '';
  }
}

// ==========================================
// TAB SWITCHING
// ==========================================

function switchTab(tabName) {
  const tabs = ['employees', 'upload', 'payments', 'reports'];
  const btns = {
    employees: 'empTabBtn',
    upload: 'uploadTabBtn',
    payments: 'paymentTabBtn',
    reports: 'reportsTabBtn'
  };
  tabs.forEach(function (t) {
    const content = document.getElementById('tab-' + t);
    const btn = document.getElementById(btns[t]);
    if (content) content.classList.toggle('active', t === tabName);
    if (btn) btn.classList.toggle('active', t === tabName);
  });

  // (reserved for future tab-switch actions)
}

// ==========================================
// EMPLOYEES TAB
// ==========================================

function toggleAddEmployeeForm() {
  const body = document.getElementById('addEmpForm');
  const icon = document.getElementById('addEmpToggleIcon');
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  icon.textContent = isOpen ? '\u25bc' : '\u25b2';
}

async function loadEmployees() {
  document.getElementById('empTableBody').innerHTML =
    '<tr><td colspan="8" class="no-data">Loading employees...</td></tr>';

  try {
    const res = await API.getSalaryEmployees();
    if (!res.success) {
      document.getElementById('empTableBody').innerHTML =
        '<tr><td colspan="8" class="no-data">Error: ' + (res.message || 'Failed to load') + '</td></tr>';
      return;
    }
    salaryEmployees = res.employees || [];
    renderEmployeeTable(salaryEmployees);
    populateEmployeeDropdowns();
  } catch (e) {
    document.getElementById('empTableBody').innerHTML =
      '<tr><td colspan="8" class="no-data">Error: ' + e.message + '</td></tr>';
  }
}

function renderEmployeeTable(employees) {
  const tbody = document.getElementById('empTableBody');
  if (!employees || employees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="no-data">No employees found. Add your first employee above.</td></tr>';
    return;
  }
  const isAdmin = currentUser && currentUser.role === 'admin';
  tbody.innerHTML = employees.map(function (emp) {
    const actionBtn = isAdmin
      ? '<button class="btn-edit" onclick="openEditModal(\'' + escHtml(emp.empCode) + '\')">&#9998; Edit</button>'
      : '';
    return '<tr>' +
      '<td>' + escHtml(emp.empCode) + '</td>' +
      '<td>' + escHtml(emp.name) + '</td>' +
      '<td>' + escHtml(emp.dept) + '</td>' +
      '<td>' + escHtml(emp.jobRole) + '</td>' +
      '<td>' + escHtml(emp.paymentType) + '</td>' +
      '<td>' + escHtml(emp.uan) + '</td>' +
      '<td>' + (emp.active === 'Yes' ? '<span style="color:#2e7d32;font-weight:600">Yes</span>' : '<span style="color:#c62828">No</span>') + '</td>' +
      '<td>' + actionBtn + '</td>' +
      '</tr>';
  }).join('');
}

function populateEmployeeDropdowns() {
  const active = salaryEmployees.filter(function (e) { return e.active === 'Yes'; });

  // Incentive & Bonus selects — standard dropdowns
  const opts = '<option value="">-- Select Employee --</option>' +
    active.map(function (e) {
      return '<option value="' + escHtml(e.empCode) + '">' + escHtml(e.name) + ' (' + escHtml(e.empCode) + ')</option>';
    }).join('');
  ['inc_emp', 'bon_emp'].forEach(function (id) {
    const sel = document.getElementById(id);
    if (sel) sel.innerHTML = opts;
  });

  // Employee history report — searchable datalist
  const datalist = document.getElementById('rep_emp_list');
  if (datalist) {
    datalist.innerHTML = active.map(function (e) {
      return '<option value="' + escHtml(e.name + ' (' + e.empCode + ')') + '">';
    }).join('');
  }

  // Department dropdown for monthly summary filter
  const depts = [];
  salaryEmployees.forEach(function (e) { if (e.dept && depts.indexOf(e.dept) === -1) depts.push(e.dept); });
  depts.sort();
  const deptSel = document.getElementById('rep_dept');
  if (deptSel) {
    deptSel.innerHTML = '<option value="">All Departments</option>' +
      depts.map(function (d) { return '<option value="' + escHtml(d) + '">' + escHtml(d) + '</option>'; }).join('');
  }
}

function syncRepEmpFromSearch() {
  const searchVal = document.getElementById('rep_emp_search').value;
  const match = salaryEmployees.find(function (e) {
    return searchVal === e.name + ' (' + e.empCode + ')';
  });
  document.getElementById('rep_emp').value = match ? match.empCode : '';
}

async function saveEmployee() {
  const empCode = document.getElementById('ae_empCode').value.trim();
  const name = document.getElementById('ae_name').value.trim();
  const paymentType = document.getElementById('ae_paymentType').value;

  if (!empCode) { showMsg('addEmpMsg', 'Employee Code is required', 'error'); return; }
  if (!name) { showMsg('addEmpMsg', 'Name is required', 'error'); return; }

  const data = {
    empCode: empCode,
    dmsCode: document.getElementById('ae_dmsCode').value.trim(),
    uan: document.getElementById('ae_uan').value.trim(),
    name: name,
    mobile: document.getElementById('ae_mobile').value.trim(),
    dept: document.getElementById('ae_dept').value.trim(),
    jobRole: document.getElementById('ae_jobRole').value.trim(),
    aadhaar: document.getElementById('ae_aadhaar').value.trim(),
    dob: document.getElementById('ae_dob').value,
    paymentType: paymentType,
    active: document.getElementById('ae_active').value
  };

  if (paymentType === 'Bank' && data.uan && data.uan.length !== 12) {
    showMsg('addEmpMsg', 'UAN must be 12 digits', 'error'); return;
  }

  try {
    const res = await API.addSalaryEmployee(data);
    if (res.success) {
      showMsg('addEmpMsg', 'Employee added successfully', 'success');
      // Clear form
      ['ae_empCode','ae_dmsCode','ae_uan','ae_name','ae_mobile','ae_dept','ae_jobRole','ae_aadhaar','ae_dob'].forEach(function (id) {
        document.getElementById(id).value = '';
      });
      loadEmployees();
    } else {
      showMsg('addEmpMsg', 'Error: ' + (res.message || 'Failed'), 'error');
    }
  } catch (e) {
    showMsg('addEmpMsg', 'Error: ' + e.message, 'error');
  }
}

function openEditModal(empCode) {
  const emp = salaryEmployees.find(function (e) { return e.empCode === empCode; });
  if (!emp) return;

  document.getElementById('ee_empCode').value = emp.empCode;
  document.getElementById('ee_dmsCode').value = emp.dmsCode || '';
  document.getElementById('ee_name').value = emp.name || '';
  document.getElementById('ee_mobile').value = emp.mobile || '';
  document.getElementById('ee_dept').value = emp.dept || '';
  document.getElementById('ee_jobRole').value = emp.jobRole || '';
  document.getElementById('ee_aadhaar').value = emp.aadhaar || '';
  document.getElementById('ee_dob').value = emp.dob || '';
  document.getElementById('ee_paymentType').value = emp.paymentType || 'Bank';
  document.getElementById('ee_uan').value = emp.uan || '';
  document.getElementById('ee_active').value = emp.active || 'Yes';
  document.getElementById('editEmpMsg').innerHTML = '';

  // Show/hide UAN field
  toggleUanField('ee_uan_group', emp.paymentType || 'Bank');

  document.getElementById('editEmpModal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('editEmpModal').classList.remove('open');
}

async function updateEmployee() {
  const empCode = document.getElementById('ee_empCode').value.trim();
  const name = document.getElementById('ee_name').value.trim();
  const paymentType = document.getElementById('ee_paymentType').value;

  if (!name) { showMsg('editEmpMsg', 'Name is required', 'error'); return; }

  const data = {
    empCode: empCode,
    dmsCode: document.getElementById('ee_dmsCode').value.trim(),
    uan: document.getElementById('ee_uan').value.trim(),
    name: name,
    mobile: document.getElementById('ee_mobile').value.trim(),
    dept: document.getElementById('ee_dept').value.trim(),
    jobRole: document.getElementById('ee_jobRole').value.trim(),
    aadhaar: document.getElementById('ee_aadhaar').value.trim(),
    dob: document.getElementById('ee_dob').value,
    paymentType: paymentType,
    active: document.getElementById('ee_active').value
  };

  try {
    const res = await API.updateSalaryEmployee(empCode, data);
    if (res.success) {
      showMsg('editEmpMsg', 'Employee updated', 'success');
      closeEditModal();
      loadEmployees();
    } else {
      showMsg('editEmpMsg', 'Error: ' + (res.message || 'Failed'), 'error');
    }
  } catch (e) {
    showMsg('editEmpMsg', 'Error: ' + e.message, 'error');
  }
}

// ==========================================
// SALARY UPLOAD TAB
// ==========================================

function switchUploadType(type) {
  currentUploadType = type;
  document.getElementById('epfBtn').classList.toggle('active', type === 'EPF');
  document.getElementById('refBtn').classList.toggle('active', type === 'Ref');
  // Reset preview
  document.getElementById('uploadPreviewSection').style.display = 'none';
  document.getElementById('salaryFile').value = '';
  document.getElementById('uploadMsg').innerHTML = '';
}

async function parseUploadedFile() {
  const fileInput = document.getElementById('salaryFile');
  const month = document.getElementById('uploadMonth').value;

  if (!month) { showMsg('uploadMsg', 'Please select a month', 'error'); return; }
  if (!fileInput.files || !fileInput.files[0]) { showMsg('uploadMsg', 'Please select a file', 'error'); return; }

  const file = fileInput.files[0];
  showMsg('uploadMsg', 'Parsing file...', 'info');

  try {
    const data = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array' });

    let records;
    if (currentUploadType === 'EPF') {
      records = parseEPFSheet(workbook);
    } else {
      records = parseRefSheet(workbook);
    }

    if (!records || records.length === 0) {
      showMsg('uploadMsg', 'No data rows found in file. Check file format.', 'error');
      return;
    }

    uploadedRecords = matchRecordsToEmployees(records, currentUploadType);
    renderUploadPreview(uploadedRecords, currentUploadType, month);
    showMsg('uploadMsg', 'Parsed ' + uploadedRecords.length + ' records from file.', 'success');

  } catch (e) {
    showMsg('uploadMsg', 'Error parsing file: ' + e.message, 'error');
  }
}

function readFileAsArrayBuffer(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function (e) { resolve(new Uint8Array(e.target.result)); };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function parseEPFSheet(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find header row containing 'UAN'
  let headerRow = rows.findIndex(function (r) {
    return r.some(function (c) { return String(c).toUpperCase().includes('UAN'); });
  });
  if (headerRow === -1) throw new Error('Not a valid EPF file \u2014 UAN column not found');

  const dataStart = headerRow + 2; // skip percentage row
  const records = [];

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r[2] || '').trim();
    if (!name || name.toUpperCase().includes('TOTAL') || name.toUpperCase().includes('GRAND')) break;
    if (!name) continue;

    records.push({
      uan: String(r[1] || '').trim(),
      name: name,
      type: 'Salary-Bank',
      paymentMode: 'EPF',
      gross: Number(r[3]) || 0,
      presentDays: Number(r[4]) || 0,
      basic: Number(r[5]) || 0,
      hra: Number(r[6]) || 0,
      conveyance: Number(r[7]) || 0,
      medical: Number(r[8]) || 0,
      education: Number(r[9]) || 0,
      wash: Number(r[10]) || 0,
      ot: Number(r[11]) || 0,
      netSalary: Number(r[12]) || 0,
      esic: Number(r[13]) || 0,
      epf: Number(r[14]) || 0,
      pt: Number(r[15]) || 0,
      otherDeduction: Number(r[16]) || 0,
      netPay: Number(r[17]) || 0
    });
  }
  return records;
}

function parseRefSheet(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find header row containing 'NAME' (exact cell)
  let headerRow = rows.findIndex(function (r) {
    return r.some(function (c) { return String(c).toUpperCase() === 'NAME'; });
  });
  if (headerRow === -1) {
    // Fallback: contains NAME
    headerRow = rows.findIndex(function (r) {
      return r.some(function (c) { return String(c).toUpperCase().includes('NAME'); });
    });
  }
  if (headerRow === -1) throw new Error('Not a valid Ref file \u2014 NAME column not found');

  const dataStart = headerRow + 1;
  const records = [];

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r[1] || '').trim();
    if (!name || name.toUpperCase().includes('TOTAL')) break;
    if (!name) continue;

    const netPay = Number(r[4]) || 0;
    records.push({
      empCode: String(r[0] || '').trim(),
      name: name,
      type: 'Salary-Cash',
      paymentMode: 'REF',
      gross: Number(r[2]) || 0,
      presentDays: Number(r[3]) || 0,
      netPay: netPay,
      amount: netPay
    });
  }
  return records;
}

function matchRecordsToEmployees(records, type) {
  return records.map(function (rec) {
    let match = null;
    if (type === 'EPF') {
      match = salaryEmployees.find(function (e) { return e.uan && e.uan === rec.uan; });
    } else {
      match = salaryEmployees.find(function (e) { return e.empCode === rec.empCode; });
    }
    return Object.assign({}, rec, {
      empCode: match ? match.empCode : (rec.empCode || ''),
      matchStatus: match ? 'matched' : 'unmatched',
      matchedName: match ? match.name : ''
    });
  });
}

function renderUploadPreview(records, type, month) {
  const section = document.getElementById('uploadPreviewSection');
  const titleEl = document.getElementById('previewTitle');
  const thead = document.getElementById('previewTableHead');
  const tbody = document.getElementById('previewTableBody');

  titleEl.textContent = (type === 'EPF' ? 'EPF (Bank)' : 'Ref (Cash)') + ' \u2014 ' + monthLabel(month);

  if (type === 'EPF') {
    thead.innerHTML = '<tr>' +
      '<th>#</th><th>UAN</th><th>Name (File)</th><th>Days</th><th>Gross</th>' +
      '<th>Net Salary</th><th>ESIC</th><th>EPF</th><th>PT</th><th>Net Pay</th>' +
      '<th>Match Status</th>' +
      '</tr>';
    tbody.innerHTML = records.map(function (rec, i) {
      const statusCell = rec.matchStatus === 'matched'
        ? '<span class="status-matched">\u2705 ' + escHtml(rec.empCode) + ' \u2014 ' + escHtml(rec.matchedName) + '</span>'
        : '<span class="status-unmatched">\u26a0\ufe0f Not in master — add employee first</span>';
      return '<tr' + (rec.matchStatus !== 'matched' ? ' style="background:#fff3e0"' : '') + '>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + escHtml(rec.uan) + '</td>' +
        '<td>' + escHtml(rec.name) + '</td>' +
        '<td>' + rec.presentDays + '</td>' +
        '<td>' + formatCurrency(rec.gross) + '</td>' +
        '<td>' + formatCurrency(rec.netSalary) + '</td>' +
        '<td>' + formatCurrency(rec.esic) + '</td>' +
        '<td>' + formatCurrency(rec.epf) + '</td>' +
        '<td>' + formatCurrency(rec.pt) + '</td>' +
        '<td>' + formatCurrency(rec.netPay) + '</td>' +
        '<td>' + statusCell + '</td>' +
        '</tr>';
    }).join('');
  } else {
    thead.innerHTML = '<tr>' +
      '<th>#</th><th>Emp Code (File)</th><th>Name (File)</th><th>Days</th>' +
      '<th>Pay Rate</th><th>Net Pay</th><th>Match Status</th>' +
      '</tr>';
    tbody.innerHTML = records.map(function (rec, i) {
      const statusCell = rec.matchStatus === 'matched'
        ? '<span class="status-matched">\u2705 ' + escHtml(rec.empCode) + ' \u2014 ' + escHtml(rec.matchedName) + '</span>'
        : '<span class="status-unmatched">\u26a0\ufe0f Not in master — add employee first</span>';
      return '<tr' + (rec.matchStatus !== 'matched' ? ' style="background:#fff3e0"' : '') + '>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + escHtml(rec.empCode) + '</td>' +
        '<td>' + escHtml(rec.name) + '</td>' +
        '<td>' + rec.presentDays + '</td>' +
        '<td>' + formatCurrency(rec.gross) + '</td>' +
        '<td>' + formatCurrency(rec.netPay) + '</td>' +
        '<td>' + statusCell + '</td>' +
        '</tr>';
    }).join('');
  }

  section.style.display = 'block';
}

function updateRecordEmpCode(idx, value) {
  if (uploadedRecords[idx]) {
    uploadedRecords[idx].empCode = value.trim();
  }
}

async function confirmSaveUpload() {
  const month = document.getElementById('uploadMonth').value;
  if (!month) { showMsg('previewMsg', 'No month selected', 'error'); return; }

  // Block if any records are unmatched — employee must exist in master first
  const unmatched = uploadedRecords.filter(function (r) { return r.matchStatus !== 'matched'; });
  if (unmatched.length > 0) {
    const names = unmatched.map(function (r) { return r.name; }).join(', ');
    showMsg('previewMsg', '\u26a0\ufe0f Cannot save: ' + unmatched.length + ' employee(s) not found in master — add them first: ' + names, 'error');
    return;
  }

  showMsg('previewMsg', 'Saving ' + uploadedRecords.length + ' records...', 'info');

  try {
    const res = await API.saveSalaryUpload(month, uploadedRecords);
    if (res.success) {
      showMsg('previewMsg', '\u2705 ' + (res.saved || uploadedRecords.length) + ' records saved successfully for ' + monthLabel(month), 'success');
      document.getElementById('uploadPreviewSection').style.display = 'none';
      document.getElementById('salaryFile').value = '';
      uploadedRecords = [];
    } else {
      showMsg('previewMsg', 'Error: ' + (res.message || 'Failed to save'), 'error');
    }
  } catch (e) {
    showMsg('previewMsg', 'Error: ' + e.message, 'error');
  }
}

// ==========================================
// INCENTIVE & BONUS TAB
// ==========================================

function switchPaymentType(type) {
  currentPaymentType = type;
  document.getElementById('incBtn').classList.toggle('active', type === 'Incentive');
  document.getElementById('bonBtn').classList.toggle('active', type === 'Bonus');
  document.getElementById('incentiveForm').style.display = type === 'Incentive' ? 'block' : 'none';
  document.getElementById('bonusForm').style.display = type === 'Bonus' ? 'block' : 'none';
  document.getElementById('incMsg').innerHTML = '';
  document.getElementById('bonMsg').innerHTML = '';
}

async function addIncentiveRecord() {
  const month = document.getElementById('inc_month').value;
  const empSel = document.getElementById('inc_emp');
  const empCode = empSel.value;
  const amount = parseFloat(document.getElementById('inc_amount').value) || 0;
  const paymentMode = document.getElementById('inc_mode').value;
  const remarks = document.getElementById('inc_remarks').value.trim();

  if (!empCode) { showMsg('incMsg', 'Please select an employee', 'error'); return; }
  if (!amount || amount <= 0) { showMsg('incMsg', 'Please enter a valid amount', 'error'); return; }

  const emp = salaryEmployees.find(function (e) { return e.empCode === empCode; });
  const empName = emp ? emp.name : empCode;

  const data = {
    type: 'Incentive',
    month: month,
    period: month,
    empCode: empCode,
    name: empName,
    uan: emp ? emp.uan : '',
    paymentMode: paymentMode,
    amount: amount,
    remarks: remarks
  };

  try {
    const res = await API.addPaymentRecord(data);
    if (res.success) {
      showMsg('incMsg', 'Incentive added successfully', 'success');
      document.getElementById('inc_amount').value = '';
      document.getElementById('inc_remarks').value = '';
    } else {
      showMsg('incMsg', 'Error: ' + (res.message || 'Failed'), 'error');
    }
  } catch (e) {
    showMsg('incMsg', 'Error: ' + e.message, 'error');
  }
}

async function addBonusRecord() {
  const periodSel = document.getElementById('bon_period');
  const period = periodSel.value;
  const selectedOpt = periodSel.options[periodSel.selectedIndex];
  const startMonth = selectedOpt ? (selectedOpt.getAttribute('data-startmonth') || period) : period;
  const empSel = document.getElementById('bon_emp');
  const empCode = empSel.value;
  const amount = parseFloat(document.getElementById('bon_amount').value) || 0;
  const paymentMode = document.getElementById('bon_mode').value;
  const remarks = document.getElementById('bon_remarks').value.trim();

  if (!empCode) { showMsg('bonMsg', 'Please select an employee', 'error'); return; }
  if (!amount || amount <= 0) { showMsg('bonMsg', 'Please enter a valid amount', 'error'); return; }

  const emp = salaryEmployees.find(function (e) { return e.empCode === empCode; });
  const empName = emp ? emp.name : empCode;

  const data = {
    type: 'Bonus',
    month: startMonth,
    period: period,
    empCode: empCode,
    name: empName,
    uan: emp ? emp.uan : '',
    paymentMode: paymentMode,
    amount: amount,
    remarks: remarks
  };

  try {
    const res = await API.addPaymentRecord(data);
    if (res.success) {
      showMsg('bonMsg', 'Bonus added successfully', 'success');
      document.getElementById('bon_amount').value = '';
      document.getElementById('bon_remarks').value = '';
    } else {
      showMsg('bonMsg', 'Error: ' + (res.message || 'Failed'), 'error');
    }
  } catch (e) {
    showMsg('bonMsg', 'Error: ' + e.message, 'error');
  }
}


// ==========================================
// REPORTS TAB
// ==========================================

function switchReportType(type) {
  currentReportType = type;
  document.getElementById('repEmpBtn').classList.toggle('active', type === 'employee');
  document.getElementById('repMonBtn').classList.toggle('active', type === 'monthly');
  document.getElementById('repEmpSection').style.display = type === 'employee' ? 'block' : 'none';
  document.getElementById('repMonSection').style.display = type === 'monthly' ? 'block' : 'none';
}

async function generateEmployeeReport() {
  const empCode = document.getElementById('rep_emp').value;
  const fyYear = document.getElementById('rep_fy').value;

  if (!empCode) { alert('Please select an employee'); return; }
  if (!fyYear) { alert('Please select a financial year'); return; }

  const btn = document.getElementById('repEmpBtn2');
  btn.innerHTML = '<span class="spinner-inline"></span>Generating...';
  btn.disabled = true;

  const resultEl = document.getElementById('repEmpResult');
  resultEl.innerHTML = '';

  try {
    const res = await API.getSalaryReport(empCode, fyYear);
    btn.innerHTML = 'Generate Report';
    btn.disabled = false;

    if (!res || !res.success) {
      const msg = (res && res.message) ? res.message : 'API call failed — please ensure the Apps Script is deployed with the latest code';
      resultEl.innerHTML = '<div class="card"><div class="msg msg-error">&#10060; ' + escHtml(msg) + '</div></div>';
      return;
    }

    const records = res.records || [];
    const emp = salaryEmployees.find(function (e) { return e.empCode === empCode; });

    // Compute totals
    let totalSalary = 0, totalIncentive = 0, totalBonus = 0;
    records.forEach(function (r) {
      if (r.type === 'Salary-Bank' || r.type === 'Salary-Cash') totalSalary += Number(r.netPay || 0);
      else if (r.type === 'Incentive') totalIncentive += Number(r.amount || 0);
      else if (r.type === 'Bonus') totalBonus += Number(r.amount || 0);
    });
    const grandTotal = totalSalary + totalIncentive + totalBonus;

    let html = '';

    // Employee info card
    if (emp) {
      html += '<div class="card">';
      html += '<div class="emp-info-card">';
      html += '<div class="emp-info-item"><div class="emp-info-label">Name</div><div class="emp-info-value">' + escHtml(emp.name) + '</div></div>';
      html += '<div class="emp-info-item"><div class="emp-info-label">Emp Code</div><div class="emp-info-value">' + escHtml(emp.empCode) + '</div></div>';
      html += '<div class="emp-info-item"><div class="emp-info-label">Department</div><div class="emp-info-value">' + escHtml(emp.dept || '-') + '</div></div>';
      html += '<div class="emp-info-item"><div class="emp-info-label">Payment Type</div><div class="emp-info-value">' + escHtml(emp.paymentType || '-') + '</div></div>';
      html += '</div>';

      // Summary cards
      html += '<div class="summary-grid">';
      html += '<div class="summary-card"><div class="s-label">Total Salary</div><div class="s-value">' + formatCurrency(totalSalary) + '</div></div>';
      html += '<div class="summary-card"><div class="s-label">Total Incentive</div><div class="s-value">' + formatCurrency(totalIncentive) + '</div></div>';
      html += '<div class="summary-card"><div class="s-label">Total Bonus</div><div class="s-value">' + formatCurrency(totalBonus) + '</div></div>';
      html += '<div class="summary-card"><div class="s-label">Grand Total</div><div class="s-value">' + formatCurrency(grandTotal) + '</div></div>';
      html += '</div>';
      html += '</div>';
    }

    // Salary records
    const salaryRecs = records.filter(function (r) { return r.type === 'Salary-Bank' || r.type === 'Salary-Cash'; });
    if (salaryRecs.length > 0) {
      html += '<div class="card"><div class="card-title">Salary Records</div><div class="table-wrap"><table>';
      html += '<thead><tr><th>Month</th><th>Type</th><th>Days</th><th>Gross</th><th>Net Salary</th><th>Deductions</th><th>Net Pay</th><th>Mode</th></tr></thead>';
      html += '<tbody>';
      salaryRecs.forEach(function (r) {
        const deductions = Number(r.esic || 0) + Number(r.epf || 0) + Number(r.pt || 0);
        html += '<tr>' +
          '<td>' + monthLabel(r.month) + '</td>' +
          '<td>' + escHtml(r.type) + '</td>' +
          '<td>' + (r.presentDays || 0) + '</td>' +
          '<td>' + formatCurrency(r.gross) + '</td>' +
          '<td>' + formatCurrency(r.netSalary) + '</td>' +
          '<td>' + formatCurrency(deductions) + '</td>' +
          '<td>' + formatCurrency(r.netPay) + '</td>' +
          '<td>' + escHtml(r.paymentMode || '') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div></div>';
    }

    // Incentive records
    const incRecs = records.filter(function (r) { return r.type === 'Incentive'; });
    if (incRecs.length > 0) {
      html += '<div class="card"><div class="card-title">Incentive Records</div><div class="table-wrap"><table>';
      html += '<thead><tr><th>Month</th><th>Amount</th><th>Mode</th><th>Remarks</th><th>Date Entered</th></tr></thead>';
      html += '<tbody>';
      incRecs.forEach(function (r) {
        html += '<tr>' +
          '<td>' + monthLabel(r.month) + '</td>' +
          '<td>' + formatCurrency(r.amount) + '</td>' +
          '<td>' + escHtml(r.paymentMode || '') + '</td>' +
          '<td>' + escHtml(r.remarks || '') + '</td>' +
          '<td>' + escHtml((r.enteredDate || '').split(' ')[0]) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div></div>';
    }

    // Bonus records
    const bonRecs = records.filter(function (r) { return r.type === 'Bonus'; });
    if (bonRecs.length > 0) {
      html += '<div class="card"><div class="card-title">Bonus Records</div><div class="table-wrap"><table>';
      html += '<thead><tr><th>Period</th><th>Amount</th><th>Mode</th><th>Remarks</th><th>Date Entered</th></tr></thead>';
      html += '<tbody>';
      bonRecs.forEach(function (r) {
        html += '<tr>' +
          '<td>' + escHtml(r.period || r.month) + '</td>' +
          '<td>' + formatCurrency(r.amount) + '</td>' +
          '<td>' + escHtml(r.paymentMode || '') + '</td>' +
          '<td>' + escHtml(r.remarks || '') + '</td>' +
          '<td>' + escHtml((r.enteredDate || '').split(' ')[0]) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div></div>';
    }

    if (records.length === 0) {
      html += '<div class="card"><div class="no-data">No records found for ' + escHtml(empCode) + ' in FY ' + escHtml(fyYear) + '</div></div>';
    }

    resultEl.innerHTML = html;

  } catch (e) {
    btn.innerHTML = 'Generate Report';
    btn.disabled = false;
    resultEl.innerHTML = '<div class="card"><div class="msg msg-error">Error: ' + e.message + '</div></div>';
  }
}

async function generateMonthlyReport() {
  const month = document.getElementById('rep_month').value;
  if (!month) { alert('Please select a month'); return; }

  const btn = document.getElementById('repMonBtn2');
  btn.innerHTML = '<span class="spinner-inline"></span>Generating...';
  btn.disabled = true;

  const resultEl = document.getElementById('repMonResult');
  resultEl.innerHTML = '';

  try {
    const res = await API.getMonthlySalaryReport(month);
    btn.innerHTML = 'Generate Report';
    btn.disabled = false;

    if (!res || !res.success) {
      const msg = (res && res.message) ? res.message : 'API call failed — please ensure the Apps Script is deployed with the latest code';
      resultEl.innerHTML = '<div class="card"><div class="msg msg-error">&#10060; ' + escHtml(msg) + '</div></div>';
      return;
    }

    const allRecords = res.records || [];

    // Department filter
    const deptFilter = document.getElementById('rep_dept') ? document.getElementById('rep_dept').value : '';
    let records = allRecords;
    if (deptFilter) {
      const deptEmpCodes = salaryEmployees.filter(function (e) { return e.dept === deptFilter; }).map(function (e) { return e.empCode; });
      records = allRecords.filter(function (r) { return deptEmpCodes.indexOf(r.empCode) !== -1; });
    }

    const bankRecs = records.filter(function (r) { return r.type === 'Salary-Bank'; });
    const cashRecs = records.filter(function (r) { return r.type === 'Salary-Cash'; });
    const incRecs = records.filter(function (r) { return r.type === 'Incentive'; });
    const bonRecs = records.filter(function (r) { return r.type === 'Bonus'; });

    const sumField = function (arr, field) { return arr.reduce(function (s, r) { return s + Number(r[field] || 0); }, 0); };
    const totalBank = sumField(bankRecs, 'netPay');
    const totalCash = sumField(cashRecs, 'netPay');
    const totalInc = sumField(incRecs, 'amount');
    const totalBon = sumField(bonRecs, 'amount');
    const grandTotal = totalBank + totalCash + totalInc + totalBon;

    let html = '<div class="card"><div class="summary-grid">';
    html += '<div class="summary-card"><div class="s-label">EPF Salary</div><div class="s-value">' + formatCurrency(totalBank) + '</div></div>';
    html += '<div class="summary-card"><div class="s-label">REF Salary</div><div class="s-value">' + formatCurrency(totalCash) + '</div></div>';
    html += '<div class="summary-card"><div class="s-label">Incentive</div><div class="s-value">' + formatCurrency(totalInc) + '</div></div>';
    html += '<div class="summary-card"><div class="s-label">Bonus</div><div class="s-value">' + formatCurrency(totalBon) + '</div></div>';
    html += '<div class="summary-card"><div class="s-label">Grand Total</div><div class="s-value">' + formatCurrency(grandTotal) + '</div></div>';
    html += '</div></div>';

    // Bank salary table
    if (bankRecs.length > 0) {
      html += '<div class="card"><div class="card-title">EPF Salary</div><div class="table-wrap"><table>';
      html += '<thead><tr><th>Emp Code</th><th>Name</th><th>Days</th><th>Gross</th><th>ESIC</th><th>EPF</th><th>PT</th><th>Net Pay</th></tr></thead>';
      html += '<tbody>';
      let tDays = 0, tGross = 0, tEsic = 0, tEpf = 0, tPt = 0, tNet = 0;
      bankRecs.forEach(function (r) {
        tDays += Number(r.presentDays || 0);
        tGross += Number(r.gross || 0);
        tEsic += Number(r.esic || 0);
        tEpf += Number(r.epf || 0);
        tPt += Number(r.pt || 0);
        tNet += Number(r.netPay || 0);
        html += '<tr>' +
          '<td>' + escHtml(r.empCode) + '</td>' +
          '<td>' + escHtml(r.name) + '</td>' +
          '<td>' + (r.presentDays || 0) + '</td>' +
          '<td>' + formatCurrency(r.gross) + '</td>' +
          '<td>' + formatCurrency(r.esic) + '</td>' +
          '<td>' + formatCurrency(r.epf) + '</td>' +
          '<td>' + formatCurrency(r.pt) + '</td>' +
          '<td>' + formatCurrency(r.netPay) + '</td>' +
          '</tr>';
      });
      html += '<tr class="totals-row"><td colspan="2"><strong>TOTAL (' + bankRecs.length + ')</strong></td>' +
        '<td>' + tDays + '</td>' +
        '<td>' + formatCurrency(tGross) + '</td>' +
        '<td>' + formatCurrency(tEsic) + '</td>' +
        '<td>' + formatCurrency(tEpf) + '</td>' +
        '<td>' + formatCurrency(tPt) + '</td>' +
        '<td>' + formatCurrency(tNet) + '</td></tr>';
      html += '</tbody></table></div></div>';
    }

    // Cash salary table
    if (cashRecs.length > 0) {
      html += '<div class="card"><div class="card-title">REF Salary</div><div class="table-wrap"><table>';
      html += '<thead><tr><th>Emp Code</th><th>Name</th><th>Days</th><th>Pay Rate</th><th>Net Pay</th></tr></thead>';
      html += '<tbody>';
      let tDays = 0, tGross = 0, tNet = 0;
      cashRecs.forEach(function (r) {
        tDays += Number(r.presentDays || 0);
        tGross += Number(r.gross || 0);
        tNet += Number(r.netPay || 0);
        html += '<tr>' +
          '<td>' + escHtml(r.empCode) + '</td>' +
          '<td>' + escHtml(r.name) + '</td>' +
          '<td>' + (r.presentDays || 0) + '</td>' +
          '<td>' + formatCurrency(r.gross) + '</td>' +
          '<td>' + formatCurrency(r.netPay) + '</td>' +
          '</tr>';
      });
      html += '<tr class="totals-row"><td colspan="2"><strong>TOTAL (' + cashRecs.length + ')</strong></td>' +
        '<td>' + tDays + '</td>' +
        '<td>' + formatCurrency(tGross) + '</td>' +
        '<td>' + formatCurrency(tNet) + '</td></tr>';
      html += '</tbody></table></div></div>';
    }

    // Incentive table
    if (incRecs.length > 0) {
      html += '<div class="card"><div class="card-title">Incentives</div><div class="table-wrap"><table>';
      html += '<thead><tr><th>Name</th><th>Amount</th><th>Mode</th><th>Remarks</th></tr></thead>';
      html += '<tbody>';
      let tAmt = 0;
      incRecs.forEach(function (r) {
        tAmt += Number(r.amount || 0);
        html += '<tr>' +
          '<td>' + escHtml(r.name) + '</td>' +
          '<td>' + formatCurrency(r.amount) + '</td>' +
          '<td>' + escHtml(r.paymentMode || '') + '</td>' +
          '<td>' + escHtml(r.remarks || '') + '</td>' +
          '</tr>';
      });
      html += '<tr class="totals-row"><td><strong>TOTAL (' + incRecs.length + ')</strong></td><td>' + formatCurrency(tAmt) + '</td><td></td><td></td></tr>';
      html += '</tbody></table></div></div>';
    }

    // Bonus table
    if (bonRecs.length > 0) {
      html += '<div class="card"><div class="card-title">Bonuses</div><div class="table-wrap"><table>';
      html += '<thead><tr><th>Name</th><th>Period</th><th>Amount</th><th>Mode</th><th>Remarks</th></tr></thead>';
      html += '<tbody>';
      let tAmt = 0;
      bonRecs.forEach(function (r) {
        tAmt += Number(r.amount || 0);
        html += '<tr>' +
          '<td>' + escHtml(r.name) + '</td>' +
          '<td>' + escHtml(r.period || r.month) + '</td>' +
          '<td>' + formatCurrency(r.amount) + '</td>' +
          '<td>' + escHtml(r.paymentMode || '') + '</td>' +
          '<td>' + escHtml(r.remarks || '') + '</td>' +
          '</tr>';
      });
      html += '<tr class="totals-row"><td><strong>TOTAL (' + bonRecs.length + ')</strong></td><td></td><td>' + formatCurrency(tAmt) + '</td><td></td><td></td></tr>';
      html += '</tbody></table></div></div>';
    }

    if (records.length === 0) {
      html += '<div class="card"><div class="no-data">No records found for ' + monthLabel(month) + '</div></div>';
    }

    resultEl.innerHTML = html;

  } catch (e) {
    btn.innerHTML = 'Generate Report';
    btn.disabled = false;
    resultEl.innerHTML = '<div class="card"><div class="msg msg-error">Error: ' + e.message + '</div></div>';
  }
}

// ==========================================
// NAVIGATION
// ==========================================

function goBack() {
  window.location.href = 'home.html';
}

// ==========================================
// HTML ESCAPE HELPER
// ==========================================

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

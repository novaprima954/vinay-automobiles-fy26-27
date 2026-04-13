// ==========================================
// HSRP UPDATE PAGE - FRONTEND (COMPLETE UPDATED VERSION)
// Two-step upload + Search + Admin-only Download + Order Date + Status Dropdown
// ==========================================

console.log('=== HSRP UPDATE PAGE ===');

let step1File = null;
let step2File = null;
let step1Completed = false;
let currentUserRole = null;
let hsrpAllData = [];
let activeDashCard = null;

// ==========================================
// AUTHENTICATION CHECK
// ==========================================

window.addEventListener('DOMContentLoaded', async () => {
  const session = SessionManager.getSession();
  
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  
  // Validate session
  const validation = await API.validateSession(session.sessionId);
  
  if (!validation.success) {
    SessionManager.clearSession();
    window.location.href = 'index.html';
    return;
  }
  
  // Check role - only admin and operator
  if (validation.user.role !== 'admin' && validation.user.role !== 'operator') {
    alert('Access denied. This page is only for Admin and Operator users.');
    window.location.href = 'dashboard.html';
    return;
  }
  
  currentUserRole = validation.user.role;
  console.log('✅ User:', validation.user.name, '| Role:', validation.user.role);
  
  // Show download button only for admin
  if (currentUserRole === 'admin') {
    document.getElementById('downloadBtn').style.display = 'inline-flex';
  }
  
  // Disable right-click context menu
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // Disable keyboard shortcuts for copy
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      return false;
    }
  });
  
  // Initialize upload areas
  initializeUploadArea('step1');
  initializeUploadArea('step2');

  // Initialize HSRP dashboard
  initDashboardFilters();
  loadHsrpDashboard();
});

// ==========================================
// HSRP DASHBOARD
// ==========================================

function initDashboardFilters() {
  const now = new Date();
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const monthSel = document.getElementById('dashMonth');
  months.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i + 1;
    opt.textContent = m;
    if (i === now.getMonth()) opt.selected = true;
    monthSel.appendChild(opt);
  });

  const yearSel = document.getElementById('dashYear');
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === now.getFullYear()) opt.selected = true;
    yearSel.appendChild(opt);
  }
}

// Parse "dd-MMM-yyyy" → Date object
function parseDMY(dateStr) {
  if (!dateStr) return null;
  const monthMap = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,
                    Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0]);
  const m = monthMap[parts[1]];
  const y = parseInt(parts[2]);
  if (isNaN(d) || m === undefined || isNaN(y)) return null;
  return new Date(y, m, d);
}

async function loadHsrpDashboard() {
  const dashCards = document.getElementById('hsrpDashCards');
  dashCards.innerHTML = '<div class="dash-loading">⏳ Loading...</div>';

  try {
    const response = await API.getHSRPData();
    if (!response.success) {
      dashCards.innerHTML = '<div class="dash-loading">Failed to load dashboard</div>';
      return;
    }

    hsrpAllData = response.data || [];
    renderDashboard();

  } catch (e) {
    dashCards.innerHTML = '<div class="dash-loading">Error loading dashboard</div>';
    console.error('Dashboard error:', e);
  }
}

function renderDashboard() {
  const month = parseInt(document.getElementById('dashMonth').value);
  const year  = parseInt(document.getElementById('dashYear').value);

  const filtered = hsrpAllData.filter(r => {
    const d = parseDMY(r.invoiceDate);
    return d && d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const total    = filtered.length;
  const ordered  = filtered.filter(r => r.status === 'Ordered').length;
  const received = filtered.filter(r => r.status === 'Received').length;
  const fitted   = filtered.filter(r => r.status === 'Fitted').length;

  const cards = [
    { key: 'total',    count: total,    label: 'Total',    cls: 'card-total',    icon: '📋' },
    { key: 'ordered',  count: ordered,  label: 'Ordered',  cls: 'card-ordered',  icon: '🔖' },
    { key: 'received', count: received, label: 'Received', cls: 'card-received', icon: '📦' },
    { key: 'fitted',   count: fitted,   label: 'Fitted',   cls: 'card-fitted',   icon: '✅' },
  ];

  document.getElementById('hsrpDashCards').innerHTML = cards.map(c => `
    <div class="hsrp-dash-card ${c.cls} ${activeDashCard === c.key ? 'active' : ''}"
         onclick="onDashCardClick('${c.key}', this)">
      <div class="dash-count">${c.count}</div>
      <div class="dash-label">${c.icon} ${c.label}</div>
    </div>
  `).join('');

  // If a card was already active, refresh the table with new month/year
  if (activeDashCard) showDashboardFilterData(activeDashCard);
}

function onDashCardClick(cardKey, el) {
  activeDashCard = cardKey;
  document.querySelectorAll('.hsrp-dash-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  showDashboardFilterData(cardKey);
  document.querySelector('.view-data-section').scrollIntoView({ behavior: 'smooth' });
}

function showDashboardFilterData(cardKey) {
  const month    = parseInt(document.getElementById('dashMonth').value);
  const year     = parseInt(document.getElementById('dashYear').value);
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun',
                      'Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLabel = monthNames[month - 1] + ' ' + year;

  let filtered = hsrpAllData.filter(r => {
    const d = parseDMY(r.invoiceDate);
    return d && d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const statusMap = { ordered: 'Ordered', received: 'Received', fitted: 'Fitted' };
  if (cardKey !== 'total') {
    filtered = filtered.filter(r => r.status === statusMap[cardKey]);
  }

  const labelEl = document.getElementById('dashFilterLabel');
  const cardLabels = { total: 'All', ordered: 'Ordered', received: 'Received', fitted: 'Fitted' };
  labelEl.textContent = `📌 Showing: ${cardLabels[cardKey]} HSRP records for ${monthLabel} (${filtered.length} records)`;
  labelEl.classList.add('show');

  displayDataTable(filtered);
}

// ==========================================
// SEARCH FUNCTIONALITY
// ==========================================

function handleSearchByChange() {
  const searchBy = document.getElementById('searchBy').value;
  const searchValueGroup = document.getElementById('searchValueGroup');
  const dateFilterGroup = document.getElementById('dateFilterGroup');
  const customDateGroup = document.getElementById('customDateGroup');
  
  // Reset
  searchValueGroup.style.display = 'none';
  dateFilterGroup.style.display = 'none';
  customDateGroup.style.display = 'none';
  
  // NEW: Added 'refCustomer' and 'orderDate' options
  if (searchBy === 'invoiceNo' || searchBy === 'customerName' || searchBy === 'registrationNo' || searchBy === 'refCustomer') {
    searchValueGroup.style.display = 'block';
  } else if (searchBy === 'invoiceDate' || searchBy === 'orderDate') {
    dateFilterGroup.style.display = 'block';
  }
}

function handleDateFilterChange() {
  const dateFilter = document.getElementById('dateFilter').value;
  const customDateGroup = document.getElementById('customDateGroup');
  
  if (dateFilter === 'customDate') {
    customDateGroup.style.display = 'block';
  } else {
    customDateGroup.style.display = 'none';
  }
}

async function searchData() {
  const searchBy = document.getElementById('searchBy').value;
  
  if (!searchBy) {
    alert('Please select a search criteria');
    return;
  }
  
  let searchValue = '';
  let dateFilter = '';
  let customDate = '';
  
  // NEW: Updated condition to include refCustomer
  if (searchBy === 'invoiceNo' || searchBy === 'customerName' || searchBy === 'registrationNo' || searchBy === 'refCustomer') {
    searchValue = document.getElementById('searchValue').value.trim();
    if (!searchValue) {
      alert('Please enter a search value');
      return;
    }
  // NEW: Updated condition to include orderDate
  } else if (searchBy === 'invoiceDate' || searchBy === 'orderDate') {
    dateFilter = document.getElementById('dateFilter').value;
    if (!dateFilter) {
      alert('Please select a date filter');
      return;
    }
    if (dateFilter === 'customDate') {
      customDate = document.getElementById('customDate').value;
      if (!customDate) {
        alert('Please select a date');
        return;
      }
    }
  }
  
  // Clear dashboard active card when doing a manual search
  activeDashCard = null;
  document.querySelectorAll('.hsrp-dash-card').forEach(c => c.classList.remove('active'));
  document.getElementById('dashFilterLabel').classList.remove('show');

  console.log('Searching:', { searchBy, searchValue, dateFilter, customDate });

  try {
    const response = await API.searchHSRPData(searchBy, searchValue, dateFilter, customDate);
    
    if (response.success) {
      displayDataTable(response.data);
      console.log('✅ Found ' + response.count + ' results');
    } else {
      alert('Error searching: ' + response.message);
    }
    
  } catch (error) {
    console.error('Error searching:', error);
    alert('Error searching: ' + error.message);
  }
}

function clearSearch() {
  document.getElementById('searchBy').value = '';
  document.getElementById('searchValue').value = '';
  document.getElementById('dateFilter').value = '';
  document.getElementById('customDate').value = '';

  document.getElementById('searchValueGroup').style.display = 'none';
  document.getElementById('dateFilterGroup').style.display = 'none';
  document.getElementById('customDateGroup').style.display = 'none';

  document.getElementById('dataTableContainer').style.display = 'none';

  // Clear dashboard active state
  activeDashCard = null;
  document.querySelectorAll('.hsrp-dash-card').forEach(c => c.classList.remove('active'));
  document.getElementById('dashFilterLabel').classList.remove('show');
}

async function viewAllData() {
  console.log('Loading all HSRP data...');
  
  try {
    const response = await API.getHSRPData();
    
    if (response.success) {
      displayDataTable(response.data);
    } else {
      alert('Error loading data: ' + response.message);
    }
    
  } catch (error) {
    console.error('Error viewing data:', error);
    alert('Error loading data: ' + error.message);
  }
}

// ==========================================
// FILE UPLOAD HANDLING
// ==========================================

function initializeUploadArea(step) {
  const uploadArea = document.getElementById(`${step}UploadArea`);
  const fileInput = document.getElementById(`${step}FileInput`);
  
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFile(step, file);
    }
  });
  
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(step, file);
    }
  });
}

function handleFile(step, file) {
  console.log(`File selected for ${step}:`, file.name);
  
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showMessage(step, 'Invalid file type. Please upload CSV file only.', 'error');
    return;
  }
  
  if (step === 'step1') {
    step1File = file;
  } else {
    step2File = file;
  }
  
  document.getElementById(`${step}FileName`).textContent = file.name;
  document.getElementById(`${step}FileSize`).textContent = formatFileSize(file.size);
  document.getElementById(`${step}FileInfo`).classList.add('show');
  document.getElementById(`${step}UploadBtn`).style.display = 'inline-flex';
  
  // NEW: Show order date section for step2
  if (step === 'step2') {
    document.getElementById('orderDateSection').classList.add('show');
  }
  
  document.getElementById(`${step}Results`).classList.remove('show');
  hideMessage(step);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ==========================================
// STEP 1: UPLOAD V301 FILE
// ==========================================

async function uploadStep1() {
  if (!step1File) {
    showMessage('step1', 'Please select a file first', 'error');
    return;
  }
  
  console.log('Processing Step 1:', step1File.name);
  
  document.getElementById('step1Spinner').classList.add('show');
  document.getElementById('step1UploadBtn').disabled = true;
  hideMessage('step1');
  
  try {
    const base64Data = await fileToBase64(step1File);
    console.log('File converted to base64, sending to backend...');
    
    const response = await API.uploadV301File(base64Data, step1File.name);
    
    console.log('Step 1 response:', response);
    
    document.getElementById('step1Spinner').classList.remove('show');
    document.getElementById('step1UploadBtn').disabled = false;
    
    if (response.success) {
      showMessage('step1', response.message, 'success');
      
      document.getElementById('step1Status').textContent = 'Completed';
      document.getElementById('step1Status').className = 'step-status completed';
      
      displayStep1Results(response.results);
      
      step1Completed = true;
      
      unlockStep2();
      
    } else {
      showMessage('step1', response.message, 'error');
    }
    
  } catch (error) {
    console.error('Error in uploadStep1:', error);
    document.getElementById('step1Spinner').classList.remove('show');
    document.getElementById('step1UploadBtn').disabled = false;
    showMessage('step1', 'Error uploading file: ' + error.message, 'error');
  }
}

function displayStep1Results(results) {
  const resultsCard = document.getElementById('step1Results');
  
  let html = '<div class="results-stats">';
  html += `<div class="stat-box"><div class="stat-number">${results.total}</div><div class="stat-label">Total Rows</div></div>`;
  html += `<div class="stat-box"><div class="stat-number">${results.imported}</div><div class="stat-label">Imported</div></div>`;
  html += `<div class="stat-box"><div class="stat-number">${results.skipped}</div><div class="stat-label">Skipped (Duplicates)</div></div>`;
  html += '</div>';
  
  if (results.skippedDetails && results.skippedDetails.length > 0) {
    html += '<div class="results-section">';
    html += '<h3>⚠️ Skipped Items (Invoice Already Exists)</h3>';
    html += '<div class="results-list">';
    results.skippedDetails.forEach(item => {
      html += `<div class="result-item">Invoice No: ${item.invoiceNo} - ${item.customerName}</div>`;
    });
    html += '</div></div>';
  }
  
  resultsCard.innerHTML = html;
  resultsCard.classList.add('show');
}

function unlockStep2() {
  const step2Card = document.getElementById('step2Card');
  step2Card.classList.remove('locked');
  document.getElementById('step2Status').textContent = 'Ready';
  document.getElementById('step2Status').className = 'step-status pending';
  console.log('✅ Step 2 unlocked');
}

// ==========================================
// STEP 2: UPLOAD REGISTRATION FILE
// ==========================================

async function uploadStep2() {
  if (!step1Completed) {
    showMessage('step2', 'Please complete Step 1 first', 'error');
    return;
  }
  
  if (!step2File) {
    showMessage('step2', 'Please select a file first', 'error');
    return;
  }
  
  console.log('Processing Step 2:', step2File.name);
  
  document.getElementById('step2Spinner').classList.add('show');
  document.getElementById('step2UploadBtn').disabled = true;
  hideMessage('step2');
  
  try {
    const base64Data = await fileToBase64(step2File);
    console.log('File converted to base64, sending to backend...');
    
    // NEW: Get order date from input (MANDATORY)
    const orderDateInput = document.getElementById('orderDateInput').value;
    
    if (!orderDateInput || orderDateInput.trim() === '') {
      showMessage('step2', 'Please select an Order Date', 'error');
      document.getElementById('step2Spinner').classList.remove('show');
      document.getElementById('step2UploadBtn').disabled = false;
      return;
    }
    
    console.log('Order Date selected:', orderDateInput);
    
    // Call API with order date parameter
    const response = await API.uploadRegistrationFile(base64Data, step2File.name, orderDateInput);
    
    console.log('Step 2 response:', response);
    
    document.getElementById('step2Spinner').classList.remove('show');
    document.getElementById('step2UploadBtn').disabled = false;
    
    if (response.success) {
      showMessage('step2', response.message, 'success');
      
      document.getElementById('step2Status').textContent = 'Completed';
      document.getElementById('step2Status').className = 'step-status completed';
      
      displayStep2Results(response.results);
      
    } else {
      showMessage('step2', response.message, 'error');
    }
    
  } catch (error) {
    console.error('Error in uploadStep2:', error);
    document.getElementById('step2Spinner').classList.remove('show');
    document.getElementById('step2UploadBtn').disabled = false;
    showMessage('step2', 'Error uploading file: ' + error.message, 'error');
  }
}

function displayStep2Results(results) {
  const resultsCard = document.getElementById('step2Results');
  
  let html = '<div class="results-stats">';
  html += `<div class="stat-box"><div class="stat-number">${results.total}</div><div class="stat-label">Total Rows</div></div>`;
  html += `<div class="stat-box"><div class="stat-number">${results.updated}</div><div class="stat-label">Updated</div></div>`;
  html += `<div class="stat-box"><div class="stat-number">${results.skipped}</div><div class="stat-label">Skipped</div></div>`;
  html += `<div class="stat-box"><div class="stat-number">${results.notFound}</div><div class="stat-label">Not Found</div></div>`;
  html += '</div>';
  
  if (results.notFoundDetails && results.notFoundDetails.length > 0) {
    html += '<div class="results-section">';
    html += '<h3>❌ Frame Numbers Not Found</h3>';
    html += '<div class="results-list">';
    results.notFoundDetails.forEach(item => {
      html += `<div class="result-item">Frame No: ${item.frameNo} - Registration: ${item.registrationNo}</div>`;
    });
    html += '</div></div>';
  }
  
  if (results.skippedDetails && results.skippedDetails.length > 0) {
    html += '<div class="results-section">';
    html += '<h3>⚠️ Skipped (Already Has Registration)</h3>';
    html += '<div class="results-list">';
    results.skippedDetails.forEach(item => {
      html += `<div class="result-item">Row ${item.row}: ${item.reason}</div>`;
    });
    html += '</div></div>';
  }
  
  resultsCard.innerHTML = html;
  resultsCard.classList.add('show');
}

// ==========================================
// VIEW & DOWNLOAD DATA
// ==========================================

function displayDataTable(data) {
  const tableBody = document.getElementById('dataTableBody');
  const tableContainer = document.getElementById('dataTableContainer');
  
  if (!data || data.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 40px;">No data found</td></tr>';
    tableContainer.style.display = 'block';
    return;
  }
  
  let html = '';
  data.forEach(row => {
    html += '<tr>';
    html += `<td>${row.srNo}</td>`;
    html += `<td>${row.invoiceNo}</td>`;
    html += `<td>${row.invoiceDate}</td>`;
    
    // NEW: Status as dropdown
    html += '<td>';
    const isFitted = row.status === 'Fitted';
    html += `<select class="status-dropdown" data-sr-no="${row.srNo}" data-original="${row.status || ''}" onchange="updateStatus(this)" ${isFitted ? 'disabled' : ''}>`;
    html += `<option value="" ${!row.status ? 'selected' : ''}>-- Select --</option>`;
    html += `<option value="Ordered" ${row.status === 'Ordered' ? 'selected' : ''}>Ordered</option>`;
    html += `<option value="Received" ${row.status === 'Received' ? 'selected' : ''}>Received</option>`;
    html += `<option value="Fitted" ${row.status === 'Fitted' ? 'selected' : ''}>Fitted</option>`;
    html += '</select>';
    html += '</td>';
    
    html += `<td>${row.mobileNo}</td>`;
    html += `<td>${row.customerName}</td>`;
    html += `<td>${row.frameNo}</td>`;
    html += `<td>${row.registrationNo}</td>`;
    html += `<td>${row.refCustomer}</td>`;
    html += `<td>${row.modelName}</td>`;
    html += `<td>${row.orderDate}</td>`;
    html += `<td>${row.fitmentDate}</td>`;
    html += '</tr>';
  });
  
  tableBody.innerHTML = html;
  tableContainer.style.display = 'block';
  
  console.log('✅ Data displayed:', data.length, 'rows');
}

/**
 * NEW: Update status for a record (inline editing)
 */
async function updateStatus(selectElement) {
  const srNo = selectElement.getAttribute('data-sr-no');
  const newStatus = selectElement.value;
  const originalStatus = selectElement.getAttribute('data-original');
  
  if (!newStatus) {
    return; // User selected "-- Select --", do nothing
  }
  
  console.log('Updating status for Sr No:', srNo, '→', newStatus);
  
  // Disable dropdown during save
  selectElement.disabled = true;
  
  try {
    const response = await API.updateHSRPStatus(srNo, newStatus);
    
    if (response.success) {
      console.log('✅ Status updated successfully');
      
      // Update original value
      selectElement.setAttribute('data-original', newStatus);
      
      // If status is "Fitted", refresh the table to show updated fitment date
      if (newStatus === 'Fitted') {
        console.log('Status set to Fitted, refreshing table...');
        // Refresh current view
        const searchBy = document.getElementById('searchBy').value;
        if (searchBy) {
          await searchData();
        } else {
          await viewAllData();
        }
      }
      
      selectElement.disabled = false;
      
    } else {
      alert('Error updating status: ' + response.message);
      // Revert dropdown
      selectElement.value = originalStatus || '';
      selectElement.disabled = false;
    }
  } catch (error) {
    console.error('Error updating status:', error);
    alert('Error updating status: ' + error.message);
    // Revert dropdown
    selectElement.value = originalStatus || '';
    selectElement.disabled = false;
  }
}

async function downloadData() {
  if (currentUserRole !== 'admin') {
    alert('Access denied. Only Admin can download CSV.');
    return;
  }
  
  console.log('Downloading HSRP data...');
  
  try {
    const response = await API.downloadHSRPData();
    
    if (response.success && response.csv) {
      const blob = new Blob([response.csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'HSRP_Data_' + new Date().toISOString().split('T')[0] + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ Download started');
    } else {
      alert('Error downloading data: ' + response.message);
    }
    
  } catch (error) {
    console.error('Error downloading data:', error);
    alert('Error downloading data: ' + error.message);
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showMessage(step, text, type) {
  const messageEl = document.getElementById(`${step}Message`);
  messageEl.textContent = text;
  messageEl.className = `message ${type} show`;
}

function hideMessage(step) {
  const messageEl = document.getElementById(`${step}Message`);
  messageEl.classList.remove('show');
}
// ==========================================
// PDF EXPORT FUNCTIONS
// ==========================================

/**
 * Show PDF export modal
 */
function showPdfExportModal() {
  document.getElementById('pdfExportModal').style.display = 'flex';
  
  // Set default dates (this month)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  document.getElementById('pdfFromDate').value = formatDateForInput(firstDay);
  document.getElementById('pdfToDate').value = formatDateForInput(lastDay);
}

/**
 * Close PDF export modal
 */
function closePdfExportModal() {
  document.getElementById('pdfExportModal').style.display = 'none';
  document.getElementById('pdfExportMessage').style.display = 'none';
}

/**
 * Format date for input field (YYYY-MM-DD)
 */
function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

/**
 * Export HSRP data to PDF
 */
async function exportToPdf() {
  const fromDate = document.getElementById('pdfFromDate').value;
  const toDate = document.getElementById('pdfToDate').value;
  
  if (!fromDate || !toDate) {
    showPdfMessage('Please select both from and to dates', 'error');
    return;
  }
  
  if (new Date(fromDate) > new Date(toDate)) {
    showPdfMessage('From date cannot be after To date', 'error');
    return;
  }
  
  console.log('Exporting HSRP to PDF:', fromDate, 'to', toDate);
  
  document.getElementById('pdfExportSpinner').classList.add('show');
  document.getElementById('pdfExportConfirmBtn').disabled = true;
  hidePdfMessage();
  
  try {
    const response = await API.exportHSRPToPdf(fromDate, toDate);
    
    document.getElementById('pdfExportSpinner').classList.remove('show');
    document.getElementById('pdfExportConfirmBtn').disabled = false;
    
    if (response.success && response.records) {
      showPdfMessage('Generating PDF...', 'success');
      
      // Generate and download PDF
      setTimeout(() => {
        generatePdfDownload(response.records, response.fromDate, response.toDate);
        closePdfExportModal();
      }, 500);
      
    } else {
      showPdfMessage('Error: ' + (response.message || 'Failed to generate PDF'), 'error');
    }
    
  } catch (error) {
    console.error('Error exporting PDF:', error);
    document.getElementById('pdfExportSpinner').classList.remove('show');
    document.getElementById('pdfExportConfirmBtn').disabled = false;
    showPdfMessage('Error: ' + error.message, 'error');
  }
}

/**
 * Generate PDF and trigger download using jsPDF
 */
function generatePdfDownload(records, fromDate, toDate) {
  try {
    // Use jsPDF library (loaded via CDN)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    // NO TITLE OR DATE RANGE - Start table immediately
    
    // Prepare table data (WITHOUT Sr No, WITH Model Name and Mobile)
    const tableData = records.map(function(record) {
      return [
        record.invoiceNo || '',
        record.invoiceDate || '',
        record.customerName || '',
        record.mobileNo || '',           // NEW: Mobile Number
        record.modelName || '',           // NEW: Model Name
        record.frameNo || '',
        record.plateNo || '',
        '', // Remark - blank
        ''  // Sign & Date - blank
      ];
    });
    
    // Generate table (9 columns now: removed Sr No, added Mobile & Model)
    doc.autoTable({
      startY: 10,                        // Start from top (was 30)
      head: [['Invoice No', 'Invoice Date', 'Customer Name', 'Mobile No', 'Model Name', 'Frame No', 'Plate No', 'Remark', 'Sign & Date']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [102, 126, 234],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 11,
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 4,
        minCellHeight: 12
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      columnStyles: {
        0: { cellWidth: 24 },      // Invoice No - decreased by 4 (was 28)
        1: { cellWidth: 28 },      // Invoice Date
        2: { cellWidth: 50 },      // Customer Name
        3: { cellWidth: 28 },      // Mobile No
        4: { cellWidth: 35 },      // Model Name
        5: { cellWidth: 38 },      // Frame No
        6: { cellWidth: 30, fontStyle: 'bold' }, // Plate No - increased by 2 (was 28)
        7: { cellWidth: 28 },      // Remark
        8: { cellWidth: 28 }       // Sign & Date
      },
      margin: { top: 10, right: 8, bottom: 10, left: 8 }  // Reduced margins
      // NO didDrawPage function - removes page numbers and total
    });
    
    // Save PDF
    const fileName = 'HSRP_Export_' + fromDate + '_to_' + toDate + '.pdf';
    doc.save(fileName);
    
    console.log('✅ PDF downloaded:', fileName);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF: ' + error.message);
  }
}

/**
 * Show message in PDF modal
 */
function showPdfMessage(text, type) {
  const messageEl = document.getElementById('pdfExportMessage');
  messageEl.textContent = text;
  messageEl.className = 'message ' + type + ' show';
  messageEl.style.display = 'block';
}

/**
 * Hide message in PDF modal
 */
function hidePdfMessage() {
  const messageEl = document.getElementById('pdfExportMessage');
  messageEl.style.display = 'none';
}

// ==========================================
// HSRP UPDATE PAGE - FRONTEND (COMPLETE UPDATED VERSION)
// Two-step upload + Search + Admin-only Download + Order Date + Status Dropdown
// ==========================================

console.log('=== HSRP UPDATE PAGE ===');

let step1File = null;
let step2File = null;
let step1Completed = false;
let currentUserRole = null;

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
});

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
    
    // NEW: Get order date from input (optional)
    const orderDateInput = document.getElementById('orderDateInput').value;
    console.log('Order Date selected:', orderDateInput || 'None');
    
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
    html += `<select class="status-dropdown" data-sr-no="${row.srNo}" data-original="${row.status || ''}" onchange="updateStatus(this)">`;
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
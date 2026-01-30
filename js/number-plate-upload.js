// ==========================================
// NUMBER PLATE BULK UPLOAD LOGIC
// ==========================================

let currentFile = null;
let parsedData = [];
let conflictRecords = [];
let processCallback = null;

document.addEventListener('DOMContentLoaded', async function() {
  console.log('=== NUMBER PLATE UPLOAD PAGE ===');
  
  // Check authentication
  const session = SessionManager.getSession();
  
  if (!session) {
    console.log('❌ No session - redirecting to login');
    window.location.href = 'index.html';
    return;
  }
  
  const user = session.user;
  console.log('✅ User:', user.name, '| Role:', user.role);
  
  // Only operator and admin can access
  if (user.role !== 'operator' && user.role !== 'admin') {
    showMessage('Access denied. Only operators and admins can upload.', 'error');
    setTimeout(() => {
      window.location.href = 'home.html';
    }, 2000);
    return;
  }
  
  // Setup drag and drop
  setupDragAndDrop();
});

/**
 * Setup drag and drop
 */
function setupDragAndDrop() {
  const uploadArea = document.getElementById('uploadArea');
  
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });
}

/**
 * Handle file select
 */
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    handleFile(file);
  }
}

/**
 * Handle file
 */
function handleFile(file) {
  console.log('File selected:', file.name);
  
  // Validate file type
  const validTypes = [
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
  ];
  
  const fileName = file.name.toLowerCase();
  const isValidExtension = fileName.endsWith('.xls') || fileName.endsWith('.xlsx');
  
  if (!validTypes.includes(file.type) && !isValidExtension) {
    showMessage('Invalid file type. Please upload .xls or .xlsx file only.', 'error');
    return;
  }
  
  // Store file
  currentFile = file;
  
  // Show file info
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = formatFileSize(file.size);
  document.getElementById('fileInfo').classList.add('show');
  document.getElementById('btnUpload').classList.add('show');
  
  // Hide results
  document.getElementById('resultsCard').classList.remove('show');
  document.getElementById('statusMessage').style.display = 'none';
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Process file
 */
async function processFile() {
  if (!currentFile) {
    showMessage('Please select a file first', 'error');
    return;
  }
  
  console.log('Processing file:', currentFile.name);
  
  // Show loading
  document.getElementById('loadingState').classList.add('show');
  document.getElementById('btnUpload').disabled = true;
  
  try {
    // Read file
    const data = await readExcelFile(currentFile);
    
    console.log('Excel data parsed:', data.length, 'rows');
    
    if (data.length === 0) {
      throw new Error('Excel file is empty or has no data rows');
    }
    
    // Parse and validate data
    const result = parseExcelData(data);
    
    console.log('Parse result:', result);
    
    if (result.valid.length === 0) {
      document.getElementById('loadingState').classList.remove('show');
      showMessage('No valid records found in Excel file', 'error');
      document.getElementById('btnUpload').disabled = false;
      return;
    }
    
    // Store parsed data
    parsedData = result.valid;
    
    // Show skipped/error summary if any
    if (result.skipped.length > 0 || result.errors.length > 0) {
      const msg = [];
      if (result.skipped.length > 0) {
        msg.push(`${result.skipped.length} rows skipped (blank data)`);
      }
      if (result.errors.length > 0) {
        msg.push(`${result.errors.length} rows have errors`);
      }
      console.log('Validation warnings:', msg.join(', '));
    }
    
    // Check for matches and conflicts in backend
    const response = await API.checkNumberPlateConflicts(parsedData);
    
    document.getElementById('loadingState').classList.remove('show');
    
    if (!response.success) {
      showMessage(response.message, 'error');
      document.getElementById('btnUpload').disabled = false;
      return;
    }
    
    console.log('Conflict check result:', response);
    
    // If there are conflicts, show confirmation modal
    if (response.conflicts && response.conflicts.length > 0) {
      conflictRecords = response.conflicts;
      showConfirmationModal(response.conflicts);
      processCallback = () => submitUpdate(false);
    } else {
      // No conflicts, proceed directly
      await submitUpdate(true);
    }
    
  } catch (error) {
    console.error('Process error:', error);
    document.getElementById('loadingState').classList.remove('show');
    showMessage('Error processing file: ' + error.message, 'error');
    document.getElementById('btnUpload').disabled = false;
  }
}

/**
 * Read Excel file
 */
function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Convert to JSON (header row = row 1)
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
          header: 'A',
          defval: ''
        });
        
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse Excel data
 */
function parseExcelData(data) {
  const valid = [];
  const skipped = [];
  const errors = [];
  
  // Skip header row (index 0)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 1; // Excel row number (1-based)
    
    // Column F = Registration Number (index 'F')
    // Column G = Chassis Number (index 'G')
    const registrationNumber = (row.F || '').toString().trim();
    const chassisNumber = (row.G || '').toString().trim();
    
    // Skip if both are blank
    if (!registrationNumber && !chassisNumber) {
      continue; // Completely blank row, don't count as skipped
    }
    
    // Skip if either is blank
    if (!chassisNumber) {
      skipped.push({
        row: rowNumber,
        reason: 'Chassis number is blank',
        data: { registrationNumber, chassisNumber }
      });
      continue;
    }
    
    if (!registrationNumber) {
      skipped.push({
        row: rowNumber,
        reason: 'Registration number is blank',
        data: { registrationNumber, chassisNumber }
      });
      continue;
    }
    
    // Valid record
    valid.push({
      chassisNumber: chassisNumber, // EXACT case sensitive
      registrationNumber: registrationNumber,
      rowNumber: rowNumber
    });
  }
  
  return {
    valid,
    skipped,
    errors
  };
}

/**
 * Show confirmation modal
 */
function showConfirmationModal(conflicts) {
  const modal = document.getElementById('confirmModal');
  const conflictList = document.getElementById('conflictList');
  
  conflictList.innerHTML = conflicts.map(c => `
    <div class="conflict-item">
      <strong>Chassis:</strong> ${c.chassisNumber}<br>
      <strong>Current:</strong> ${c.currentPlate || 'None'} → <strong>New:</strong> ${c.newPlate}
    </div>
  `).join('');
  
  modal.classList.add('show');
}

/**
 * Confirm overwrite
 */
function confirmOverwrite(confirmed) {
  const modal = document.getElementById('confirmModal');
  modal.classList.remove('show');
  
  if (confirmed && processCallback) {
    processCallback();
  } else {
    document.getElementById('btnUpload').disabled = false;
    showMessage('Upload cancelled', 'warning');
  }
}

/**
 * Submit update to backend
 */
async function submitUpdate(skipConflictCheck) {
  console.log('Submitting update...');
  
  document.getElementById('loadingState').classList.add('show');
  
  try {
    const response = await API.bulkUpdateNumberPlates(parsedData, !skipConflictCheck);
    
    document.getElementById('loadingState').classList.remove('show');
    
    if (response.success) {
      displayResults(response.results);
      showMessage(`✅ Upload completed! ${response.results.updated} records updated.`, 'success');
    } else {
      showMessage(response.message, 'error');
      document.getElementById('btnUpload').disabled = false;
    }
    
  } catch (error) {
    console.error('Submit error:', error);
    document.getElementById('loadingState').classList.remove('show');
    showMessage('Error submitting data: ' + error.message, 'error');
    document.getElementById('btnUpload').disabled = false;
  }
}

/**
 * Display results
 */
function displayResults(results) {
  console.log('Displaying results:', results);
  
  // Update counts
  document.getElementById('totalCount').textContent = results.total || 0;
  document.getElementById('successCount').textContent = results.updated || 0;
  document.getElementById('skippedCount').textContent = results.skipped || 0;
  document.getElementById('errorCount').textContent = results.notFound || 0;
  
  // Show success details
  if (results.details && results.details.length > 0) {
    const successList = document.getElementById('successList');
    successList.innerHTML = results.details.map(item => `
      <div class="detail-item">
        <div class="detail-icon">✅</div>
        <div class="detail-content">
          <div class="detail-chassis">Chassis: ${item.chassisNumber}</div>
          <div class="detail-plate">Number Plate: ${item.registrationNumber}</div>
          <div class="detail-receipt">Receipt: ${item.receiptNo || 'N/A'}</div>
        </div>
      </div>
    `).join('');
    document.getElementById('successSection').style.display = 'block';
  }
  
  // Show skipped details (from parsing)
  const parseResult = parseExcelData(await readExcelFile(currentFile));
  if (parseResult.skipped.length > 0) {
    const skippedList = document.getElementById('skippedList');
    skippedList.innerHTML = parseResult.skipped.map(item => `
      <div class="detail-item">
        <div class="detail-icon">⚠️</div>
        <div class="detail-content">
          <div class="detail-chassis">Row ${item.row}</div>
          <div class="detail-plate">${item.reason}</div>
        </div>
      </div>
    `).join('');
    document.getElementById('skippedSection').style.display = 'block';
  }
  
  // Show error details (not found)
  if (results.notFoundDetails && results.notFoundDetails.length > 0) {
    const errorList = document.getElementById('errorList');
    errorList.innerHTML = results.notFoundDetails.map(item => `
      <div class="detail-item">
        <div class="detail-icon">❌</div>
        <div class="detail-content">
          <div class="detail-chassis">Chassis: ${item.chassisNumber}</div>
          <div class="detail-plate">Registration: ${item.registrationNumber}</div>
          <div class="detail-receipt">Reason: Chassis number not found in system</div>
        </div>
      </div>
    `).join('');
    document.getElementById('errorSection').style.display = 'block';
  }
  
  // Show results card
  document.getElementById('resultsCard').classList.add('show');
  
  // Scroll to results
  document.getElementById('resultsCard').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Reset upload
 */
function resetUpload() {
  currentFile = null;
  parsedData = [];
  conflictRecords = [];
  processCallback = null;
  
  document.getElementById('fileInput').value = '';
  document.getElementById('fileInfo').classList.remove('show');
  document.getElementById('btnUpload').classList.remove('show');
  document.getElementById('btnUpload').disabled = false;
  document.getElementById('resultsCard').classList.remove('show');
  document.getElementById('statusMessage').style.display = 'none';
  
  // Hide detail sections
  document.getElementById('successSection').style.display = 'none';
  document.getElementById('skippedSection').style.display = 'none';
  document.getElementById('errorSection').style.display = 'none';
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Show message
 */
function showMessage(text, type) {
  const msgDiv = document.getElementById('statusMessage');
  msgDiv.textContent = text;
  msgDiv.className = 'message ' + type;
  msgDiv.style.display = 'block';
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  if (type === 'success') {
    setTimeout(() => {
      msgDiv.style.display = 'none';
    }, 5000);
  }
}

/**
 * Go back to home
 */
function goBack() {
  window.location.href = 'home.html';
}

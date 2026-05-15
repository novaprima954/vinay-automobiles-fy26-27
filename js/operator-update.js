// ==========================================
// OPERATOR UPDATE PAGE LOGIC - OPTIMIZED
// Fixed: Month filter, Number plate lock, No logging
// ==========================================

let currentUser = null;
let currentRecord = null;
let currentMonth = '';

document.addEventListener('DOMContentLoaded', async function() {
  const session = SessionManager.getSession();
  
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  
  currentUser = session.user;
  
  populateMonthSelector();
  await loadPendingCounts();
  
  // FIXED: Remove dashes from number plate
  document.getElementById('numberPlateDetails').addEventListener('input', formatNumberPlate);
  document.getElementById('engineNumber').addEventListener('input', formatVehicleNumber);
  document.getElementById('frameNumber').addEventListener('input', formatVehicleNumber);
  
  document.getElementById('updateForm').addEventListener('submit', handleUpdate);
  
  const urlParams = new URLSearchParams(window.location.search);
  const receiptNo = urlParams.get('receiptNo');
  if (receiptNo) {
    await loadRecordDetails(receiptNo);
  }
});

function populateMonthSelector() {
  const select = document.getElementById('monthFilter');
  const currentDate = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const option = document.createElement('option');
    option.value = `${year}-${month}`;
    option.textContent = monthName;
    select.appendChild(option);
  }
  
  currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  select.value = currentMonth;
}

async function loadPendingCounts() {
  currentMonth = document.getElementById('monthFilter').value;
  
  try {
    const response = await API.getOperatorPendingCounts(currentMonth);
    
    if (response.success) {
      document.getElementById('dmsPendingCount').textContent = response.counts.dmsPending;
      document.getElementById('insurancePendingCount').textContent = response.counts.insurancePending;
      document.getElementById('vahanPendingCount').textContent = response.counts.vahanPending;
    }
  } catch (error) {
    // Silent
  }
}

// FIXED: Pass month filter to API
async function showPendingList(type) {
  showLoading(true);
  
  try {
    const response = await API.getOperatorPendingList(type, currentMonth);
    
    showLoading(false);
    
    if (response.success && response.results.length > 0) {
      displayResults(response.results);
    } else {
      showMessage('No pending records found for selected month', 'error');
    }
  } catch (error) {
    showLoading(false);
    showMessage('Error loading list', 'error');
  }
}

async function searchRecords() {
  const searchBy = document.getElementById('searchBy').value;
  const searchValue = document.getElementById('searchValue').value.trim();
  
  if (!searchValue) {
    showMessage('Please enter search term', 'error');
    return;
  }
  
  showLoading(true);
  
  try {
    const response = await API.searchOperatorRecords(searchBy, searchValue);
    
    showLoading(false);
    
    if (response.success) {
      if (response.results.length > 0) {
        displayResults(response.results);
      } else {
        showMessage('No records found', 'error');
      }
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showLoading(false);
    showMessage('Error searching records', 'error');
  }
}

function displayResults(results) {
  const resultsList = document.getElementById('resultsList');
  const resultsSection = document.getElementById('resultsSection');
  
  document.getElementById('resultCount').textContent = results.length;
  
  resultsList.innerHTML = results.map(record => `
    <div class="result-item" onclick="loadRecordDetails('${record.receiptNo}')">
      <div class="result-name">${record.customerName}</div>
      <div class="result-details">
        Receipt: ${record.receiptNo} • ${record.variant || record.model}<br>
        📱 ${record.mobileNo} • Executive: ${record.executiveName}
      </div>
      <div class="result-vehicle-info">
        🔧 Engine: ${record.engineNumber || 'Not Set'} | 🔩 Chassis: ${record.frameNumber || 'Not Set'}
      </div>
    </div>
  `).join('');
  
  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

async function loadRecordDetails(receiptNo) {
  showLoading(true);
  
  try {
    const response = await API.getOperatorRecordDetails(receiptNo);
    
    showLoading(false);
    
    if (response.success) {
      currentRecord = response.record;
      displayUpdateForm(response.record);
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showLoading(false);
    showMessage('Error loading record', 'error');
  }
}

function displayUpdateForm(record) {
  document.getElementById('customerDetails').innerHTML = `
    <div class="detail-row">
      <span class="detail-label">Receipt No:</span>
      <span class="detail-value">${record.receiptNo}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Customer Name:</span>
      <span class="detail-value">${record.customerName}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Variant:</span>
      <span class="detail-value">${record.variant || record.model}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Mobile No:</span>
      <span class="detail-value">${record.mobileNo}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Executive:</span>
      <span class="detail-value">${record.executiveName}</span>
    </div>
  `;
  
  const allComplete = record.dmsStatus === 'Yes' && 
                      record.insuranceStatus === 'Yes' && 
                      record.vahanStatus === 'Yes';
  
  setupVehicleNumbers(record.engineNumber, record.frameNumber, allComplete);
  
  setupStatusSection('dms', record.dmsStatus, record.dmsDate, record.dmsOperator, allComplete);
  setupStatusSection('insurance', record.insuranceStatus, record.insuranceDate, record.insuranceOperator, allComplete);
  setupStatusSection('vahan', record.vahanStatus, record.vahanDate, record.vahanOperator, allComplete);
  
  // FIXED: Lock number plate when fitted=Yes
  document.getElementById('numberPlateDetails').value = record.numberPlateDetails || '';
  const numberPlateLocked = record.numberPlateFitted === 'Yes';
  setupStatusSection('numberPlate', record.numberPlateFitted, record.numberPlateDate, record.numberPlateOperator, numberPlateLocked);
  
  document.getElementById('updateSection').style.display = 'block';
  document.getElementById('updateSection').scrollIntoView({ behavior: 'smooth' });
}

function setupVehicleNumbers(engineNumber, frameNumber, locked) {
  const engineInput = document.getElementById('engineNumber');
  const frameInput = document.getElementById('frameNumber');
  const lockedBadge = document.getElementById('vehicleLockedBadge');
  
  engineInput.value = engineNumber || '';
  frameInput.value = frameNumber || '';
  
  if (locked) {
    engineInput.disabled = true;
    frameInput.disabled = true;
    lockedBadge.style.display = 'inline-block';
  } else {
    engineInput.disabled = false;
    frameInput.disabled = false;
    lockedBadge.style.display = 'none';
  }
}

function setupStatusSection(type, status, date, operator, forceLocked) {
  const section   = document.getElementById(type + 'Section');
  const badge     = document.getElementById(type + 'Badge');
  const info      = document.getElementById(type + 'Info');
  const yesRadio  = document.getElementById(type + 'Yes');
  const noRadio   = document.getElementById(type + 'No');
  const dateRow   = document.getElementById(type + 'DateRow');  // may be null for numberPlate
  const dateInput = document.getElementById(type + 'Date');

  const isLocked = (status === 'Yes') || forceLocked;

  if (isLocked) {
    section.classList.add('locked');
    badge.textContent = 'COMPLETED ✅';
    badge.className = 'status-badge badge-locked';

    if (date && operator) {
      info.textContent = `Completed on ${date} by ${operator}`;
    } else if (forceLocked) {
      info.textContent = 'All steps completed - Status locked';
    }

    yesRadio.checked = (status === 'Yes');
    yesRadio.disabled = true;
    noRadio.disabled = true;

    if (dateRow) dateRow.style.display = 'none';

    if (type === 'numberPlate') {
      document.getElementById('numberPlateDetails').disabled = true;
    }
  } else {
    section.classList.remove('locked');
    badge.textContent = 'PENDING';
    badge.className = 'status-badge badge-pending';
    info.textContent = '';

    yesRadio.disabled = false;
    noRadio.disabled = false;

    if (status === 'Yes') {
      yesRadio.checked = true;
      if (dateRow) { dateRow.style.display = 'block'; }
    } else if (status === 'No') {
      noRadio.checked = true;
      if (dateRow) dateRow.style.display = 'none';
    } else {
      yesRadio.checked = false;
      noRadio.checked = false;
      if (dateRow) dateRow.style.display = 'none';
    }

    // Set default date to today on the date input
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Wire up show/hide on radio change
    if (dateRow) {
      yesRadio.onchange = function() {
        if (this.checked) {
          dateRow.style.display = 'block';
          if (!dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
        }
      };
      noRadio.onchange = function() {
        if (this.checked) dateRow.style.display = 'none';
      };
    }

    if (type === 'numberPlate') {
      document.getElementById('numberPlateDetails').disabled = false;
    }
  }
}

function formatVehicleNumber(e) {
  e.target.value = e.target.value.toUpperCase();
}

// FIXED: No dashes in number plate
function formatNumberPlate(e) {
  let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  if (value.length > 10) {
    value = value.substring(0, 10);
  }
  
  e.target.value = value;
}

async function handleUpdate(e) {
  e.preventDefault();
  
  const dmsStatus       = document.querySelector('input[name="dmsStatus"]:checked')?.value || '';
  const insuranceStatus = document.querySelector('input[name="insuranceStatus"]:checked')?.value || '';
  const vahanStatus     = document.querySelector('input[name="vahanStatus"]:checked')?.value || '';

  const data = {
    dmsStatus,
    insuranceStatus,
    vahanStatus,
    dmsDate:       (dmsStatus === 'Yes')       ? (document.getElementById('dmsDate')?.value || '')       : '',
    insuranceDate: (insuranceStatus === 'Yes') ? (document.getElementById('insuranceDate')?.value || '') : '',
    vahanDate:     (vahanStatus === 'Yes')     ? (document.getElementById('vahanDate')?.value || '')     : '',
    numberPlateDetails: document.getElementById('numberPlateDetails').value.trim(),
    numberPlateFitted: document.querySelector('input[name="numberPlateFitted"]:checked')?.value || '',
    engineNumber: document.getElementById('engineNumber').value.trim(),
    frameNumber: document.getElementById('frameNumber').value.trim()
  };
  
  if (!data.dmsStatus && !data.insuranceStatus && !data.vahanStatus && 
      !data.numberPlateDetails && !data.numberPlateFitted && 
      !data.engineNumber && !data.frameNumber) {
    showMessage('Please fill at least one field', 'error');
    return;
  }
  
  // FIXED: No dashes in validation
  if (data.numberPlateDetails) {
    const plateRegex = /^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/;
    if (!plateRegex.test(data.numberPlateDetails)) {
      showMessage('Invalid number plate format. Use: XX00XX0000 (no dashes)', 'error');
      return;
    }
  }
  
  const currentDMS = currentRecord.dmsStatus || '';
  const currentInsurance = currentRecord.insuranceStatus || '';
  const currentVahan = currentRecord.vahanStatus || '';
  
  const newDMS = data.dmsStatus || currentDMS;
  const newInsurance = data.insuranceStatus || currentInsurance;
  const newVahan = data.vahanStatus || currentVahan;
  
  if (newInsurance === 'Yes' && newDMS !== 'Yes') {
    showMessage('❌ Workflow Error: Insurance requires DMS first', 'error');
    return;
  }
  
  if (newVahan === 'Yes' && newInsurance !== 'Yes') {
    showMessage('❌ Workflow Error: Vahan requires Insurance first', 'error');
    return;
  }
  
  showLoading(true);
  
  try {
    const response = await API.updateOperatorStatus(currentRecord.receiptNo, data);
    
    showLoading(false);
    
    if (response.success) {
      showMessage('✅ Status updated successfully!', 'success');
      
      await loadPendingCounts();
      
      setTimeout(async () => {
        await loadRecordDetails(currentRecord.receiptNo);
      }, 1500);
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showLoading(false);
    showMessage('Error updating status', 'error');
  }
}

function cancelUpdate() {
  document.getElementById('updateSection').style.display = 'none';
  document.getElementById('resultsSection').style.display = 'none';
  currentRecord = null;
}

function showLoading(show) {
  const loader = document.getElementById('loadingState');
  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
}

function showMessage(text, type) {
  const msg = document.getElementById('statusMessage');
  msg.textContent = text;
  msg.className = 'message ' + type;
  msg.classList.remove('hidden');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  if (type === 'success') {
    setTimeout(() => {
      msg.classList.add('hidden');
    }, 3000);
  }
}

function goBack() {
  window.location.href = 'home.html';
}

// ==========================================
// VIEW RECORDS PAGE LOGIC
// ==========================================

let currentSearchParams = {};

document.addEventListener('DOMContentLoaded', async function() {
  console.log('=== VIEW RECORDS PAGE ===');
  
  // Check authentication
  const session = SessionManager.getSession();
  
  if (!session) {
    console.log('❌ No session - redirecting to login');
    window.location.href = 'index.html';
    return;
  }
  
  const user = session.user;
  console.log('✅ User:', user.name, '| Role:', user.role);
  
  // Display current user
  document.getElementById('currentUser').textContent = user.name;
  
  // Setup event listeners
  setupEventListeners();
  
  // Populate month selector
  populateMonthSelector();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  const searchBySelect = document.getElementById('searchBy');
  const dateFilterSelect = document.getElementById('dateFilter');
  
  searchBySelect.addEventListener('change', handleSearchByChange);
  dateFilterSelect.addEventListener('change', handleDateFilterChange);
}

/**
 * Handle search by change
 */
function handleSearchByChange() {
  const searchBy = document.getElementById('searchBy').value;
  const searchValueSection = document.getElementById('searchValueSection');
  const dateFilterSection = document.getElementById('dateFilterSection');
  
  if (searchBy === 'Booking Date') {
    searchValueSection.style.display = 'none';
    dateFilterSection.style.display = 'block';
  } else {
    searchValueSection.style.display = 'block';
    dateFilterSection.style.display = 'none';
    hideAllDateSections();
  }
}

/**
 * Handle date filter change
 */
function handleDateFilterChange() {
  const dateFilter = document.getElementById('dateFilter').value;
  
  hideAllDateSections();
  
  if (dateFilter === 'date') {
    document.getElementById('specificDateSection').style.display = 'block';
  } else if (dateFilter === 'range') {
    document.getElementById('fromDateSection').style.display = 'block';
    document.getElementById('toDateSection').style.display = 'block';
  } else if (dateFilter === 'month') {
    document.getElementById('monthSection').style.display = 'block';
  }
}

/**
 * Hide all date sections
 */
function hideAllDateSections() {
  document.getElementById('specificDateSection').style.display = 'none';
  document.getElementById('fromDateSection').style.display = 'none';
  document.getElementById('toDateSection').style.display = 'none';
  document.getElementById('monthSection').style.display = 'none';
}

/**
 * Populate month selector
 */
function populateMonthSelector() {
  const select = document.getElementById('monthSelector');
  const currentDate = new Date();
  
  // Generate last 12 months
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
  
  // Set current month as default
  select.value = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Search records
 */
async function searchRecords() {
  console.log('Searching records...');
  
  const searchBy = document.getElementById('searchBy').value;
  
  if (!searchBy) {
    showMessage('Please select a search type', 'error');
    return;
  }
  
  let searchValue = '';
  let dateFilter = '';
  let month = '';
  let fromDate = '';
  let toDate = '';
  
  if (searchBy === 'Booking Date') {
    dateFilter = document.getElementById('dateFilter').value;
    
    if (!dateFilter) {
      showMessage('Please select a date filter type', 'error');
      return;
    }
    
    if (dateFilter === 'date') {
      searchValue = document.getElementById('specificDate').value;
      if (!searchValue) {
        showMessage('Please select a date', 'error');
        return;
      }
    } else if (dateFilter === 'range') {
      fromDate = document.getElementById('fromDate').value;
      toDate = document.getElementById('toDate').value;
      if (!fromDate || !toDate) {
        showMessage('Please select both from and to dates', 'error');
        return;
      }
    } else if (dateFilter === 'month') {
      month = document.getElementById('monthSelector').value;
      if (!month) {
        showMessage('Please select a month', 'error');
        return;
      }
    }
  } else {
    searchValue = document.getElementById('searchValue').value.trim();
    if (!searchValue) {
      showMessage('Please enter a search value', 'error');
      return;
    }
  }
  
  // Store search params for export
  currentSearchParams = {
    searchBy,
    searchValue,
    dateFilter,
    month,
    fromDate,
    toDate
  };
  
  // Show loading state
  const statusDiv = document.getElementById('statusMessage');
  statusDiv.textContent = '🔍 Searching...';
  statusDiv.className = 'message';
  statusDiv.classList.remove('hidden');
  
  try {
    const response = await API.searchViewRecords(searchBy, searchValue, dateFilter, month, fromDate, toDate);
    
    if (response.success) {
      displayResults(response.results);
      showMessage(`✅ Found ${response.results.length} record(s)`, 'success');
      
      // Show export button if results exist
      if (response.results.length > 0) {
        document.getElementById('exportBtn').style.display = 'block';
      }
    } else {
      showMessage(response.message, 'error');
      hideResults();
    }
  } catch (error) {
    console.error('Search error:', error);
    showMessage('❌ Error searching records', 'error');
    hideResults();
  }
}

/**
 * Display search results
 */
function displayResults(results) {
  const tbody = document.getElementById('resultsBody');
  tbody.innerHTML = '';
  
  if (results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No records found</td></tr>';
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('exportBtn').style.display = 'none';
    return;
  }
  
  results.forEach(record => {
    const tr = document.createElement('tr');
    tr.onclick = () => viewRecordDetails(record.row);
    
    tr.innerHTML = `
      <td>${record.receiptNo || ''}</td>
      <td>${record.date || ''}</td>
      <td>${record.customerName || ''}</td>
      <td>${record.mobileNo || ''}</td>
      <td>${record.model || ''}</td>
      <td>${record.variant || ''}</td>
    `;
    
    tbody.appendChild(tr);
  });
  
  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('resultsTitle').textContent = `Search Results (${results.length})`;
}

/**
 * Hide results
 */
function hideResults() {
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('detailsSection').style.display = 'none';
  document.getElementById('exportBtn').style.display = 'none';
}

/**
 * View record details
 */
async function viewRecordDetails(row) {
  console.log('Loading details for row:', row);
  
  showMessage('📄 Loading record details...', 'success');
  
  try {
    const response = await API.getViewRecordByRow(row);
    
    if (response.success) {
      displayRecordDetails(response.record);
      document.getElementById('detailsSection').style.display = 'block';
      
      // Scroll to details
      document.getElementById('detailsSection').scrollIntoView({ behavior: 'smooth' });
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Error loading details:', error);
    showMessage('❌ Error loading record details', 'error');
  }
}

/**
 * Update status indicator
 */
function updateStatusIndicator(elementId, status) {
  const iconElement = document.getElementById(elementId + 'Icon');
  const valueElement = document.getElementById(elementId + 'Value');
  
  // Normalize status value
  const normalizedStatus = (status || '').toString().trim();
  
  // Check if complete (Yes or Done)
  const isComplete = normalizedStatus === 'Yes' || normalizedStatus === 'Done';
  const isPending = !normalizedStatus || normalizedStatus === '' || normalizedStatus === 'No' || normalizedStatus === 'Pending';
  
  if (isComplete) {
    // Green tick for complete
    iconElement.textContent = '✓';
    iconElement.className = 'status-icon complete';
    valueElement.textContent = 'Complete';
    valueElement.style.color = '#28a745';
  } else if (isPending) {
    // Red cross for pending/blank
    iconElement.textContent = '✗';
    iconElement.className = 'status-icon pending';
    valueElement.textContent = normalizedStatus || 'Pending';
    valueElement.style.color = '#dc3545';
  } else {
    // Yellow for partial/other
    iconElement.textContent = '◐';
    iconElement.className = 'status-icon partial';
    valueElement.textContent = normalizedStatus;
    valueElement.style.color = '#ffc107';
  }
}

/**
 * Display complete record details
 */
function displayRecordDetails(record) {
  console.log('Displaying record:', record);
  
  // Update Status Indicators
  updateStatusIndicator('statusAccounts', record.accountCheck);
  updateStatusIndicator('statusDMS', record.dmsStatus);
  updateStatusIndicator('statusInsurance', record.insuranceStatus);
  updateStatusIndicator('statusRTO', record.vahanStatus || record.rtoStatus);

  // Show completion dates under DMS / Insurance / RTO
  const dmsDateEl = document.getElementById('statusDMSDate');
  if (dmsDateEl) dmsDateEl.textContent = (record.dmsStatus === 'Yes' && record.dmsDate) ? record.dmsDate : '';
  const insDteEl = document.getElementById('statusInsuranceDate');
  if (insDteEl) insDteEl.textContent = (record.insuranceStatus === 'Yes' && record.insuranceDate) ? record.insuranceDate : '';
  const rtoDteEl = document.getElementById('statusRTODate');
  if (rtoDteEl) rtoDteEl.textContent = ((record.vahanStatus === 'Yes' || record.rtoStatus === 'Yes') && record.vahanDate) ? record.vahanDate : '';
  updateStatusIndicator('statusAccessories', record.accessoryFitted);
  
  // Update Vehicle Details
  document.getElementById('vehicleEngineNumber').textContent = record.engineNumber || '-';
  document.getElementById('vehicleFrameNumber').textContent = record.frameNumber || '-';
  document.getElementById('vehicleNumber').textContent = record.numberPlateDetails || record.vehicleNumber || '-';
  
  // Sales Information
  document.getElementById('detailReceiptNo').textContent = record.receiptNo || '';
  document.getElementById('detailExecName').textContent = record.executiveName || '';
  document.getElementById('detailDate').textContent = record.bookingDate || '';
  document.getElementById('detailCustomerName').textContent = record.customerName || '';
  document.getElementById('detailMobileNo').textContent = record.mobileNo || '';
  document.getElementById('detailModel').textContent = record.model || '';
  document.getElementById('detailVariant').textContent = record.variant || '';
  document.getElementById('detailColour').textContent = record.colour || '';
  document.getElementById('detailDiscount').textContent = record.discount || '';
  document.getElementById('detailFinalPrice').textContent = record.finalPrice || '';
  document.getElementById('detailFinancier').textContent = record.financierName || '';
  document.getElementById('detailDeliveryDate').textContent = record.deliveryDate || '';
  document.getElementById('detailSalesRemark').textContent = record.salesRemark || '';
  
  // Accessories
  const accessoriesGrid = document.getElementById('accessoriesGrid');
  accessoriesGrid.innerHTML = '';
  
  const accessories = [
    { label: 'Guard', value: record.guard },
    { label: 'Grip Cover', value: record.gripCover },
    { label: 'Seat Cover', value: record.seatCover },
    { label: 'Matin', value: record.matin },
    { label: 'Tank Cover', value: record.tankCover },
    { label: 'Handle Hook', value: record.handleHook },
    { label: 'Helmet', value: record.helmet },
    { label: 'Rain Cover', value: record.rainCover },
    { label: 'Buzzer', value: record.buzzer },
    { label: 'Back Rest', value: record.backRest }
  ];
  
  accessories.forEach(acc => {
    if (acc.value) {
      const div = document.createElement('div');
      div.className = 'detail-item';
      div.innerHTML = `
        <span class="detail-label">${acc.label}:</span>
        <span class="detail-value">${acc.value}</span>
      `;
      accessoriesGrid.appendChild(div);
    }
  });
  
  if (accessoriesGrid.children.length === 0) {
    accessoriesGrid.innerHTML = '<div style="grid-column: 1 / -1; color: #999;">No accessories selected</div>';
  }
  
  // Payment Information
  document.getElementById('detailReceiptNo1').textContent = record.receiptNo1 || '';
  document.getElementById('detailReceipt1Amount').textContent = record.receipt1Amount ? `₹${record.receipt1Amount}` : '';
  document.getElementById('detailReceiptNo2').textContent = record.receiptNo2 || '';
  document.getElementById('detailReceipt2Amount').textContent = record.receipt2Amount ? `₹${record.receipt2Amount}` : '';
  document.getElementById('detailReceiptNo3').textContent = record.receiptNo3 || '';
  document.getElementById('detailReceipt3Amount').textContent = record.receipt3Amount ? `₹${record.receipt3Amount}` : '';
  document.getElementById('detailReceiptNo4').textContent = record.receiptNo4 || '';
  document.getElementById('detailReceipt4Amount').textContent = record.receipt4Amount ? `₹${record.receipt4Amount}` : '';
  document.getElementById('detailDONumber').textContent = record.doNumber || '';
  document.getElementById('detailDisbursed').textContent = record.disbursedAmount ? `₹${record.disbursedAmount}` : '';
  document.getElementById('detailCashTotal').textContent = record.cashTotal ? `₹${record.cashTotal}` : '';
  document.getElementById('detailGrandTotal').textContent = record.grandTotal ? `₹${record.grandTotal}` : '';
  
  // Accounts Information
  document.getElementById('detailAccountantName').textContent = record.accountantName || '';
  document.getElementById('detailAccountCheck').textContent = record.accountCheck || '';
  document.getElementById('detailAccountRemark').textContent = record.accountRemark || '';
  
  // Accessory Information
  document.getElementById('detailAccessoryChecker').textContent = record.accessoryCheckerName || '';
  document.getElementById('detailAccessoryFitted').textContent = record.accessoryFitted || '';
  document.getElementById('detailAccessoryReceipt1').textContent = record.accessoryReceipt1 || '';
  document.getElementById('detailAccessoryExtra').textContent = record.accessoryExtra || '';
  document.getElementById('detailPending').textContent = record.pending || '';
  document.getElementById('detailAccessoryRemark').textContent = record.accessoryRemark || '';
}

/**
 * Close details view
 */
function closeDetails() {
  document.getElementById('detailsSection').style.display = 'none';
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Export to CSV
 */
async function exportToCSV() {
  console.log('Exporting to CSV...');
  
  showMessage('📥 Preparing CSV export...', 'success');
  
  try {
    const response = await API.exportViewRecordsToCSV(
      currentSearchParams.searchBy,
      currentSearchParams.searchValue,
      currentSearchParams.dateFilter,
      currentSearchParams.month,
      currentSearchParams.fromDate,
      currentSearchParams.toDate
    );
    
    if (response.success) {
      // Create blob and download
      const blob = new Blob([response.csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const filename = `view_records_${new Date().toISOString().split('T')[0]}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showMessage('✅ CSV exported successfully', 'success');
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Export error:', error);
    showMessage('❌ Error exporting CSV', 'error');
  }
}

/**
 * Show message
 */
function showMessage(text, type) {
  const msgDiv = document.getElementById('statusMessage');
  msgDiv.textContent = text;
  msgDiv.className = 'message ' + type;
  msgDiv.classList.remove('hidden');
  
  if (type === 'success') {
    setTimeout(() => {
      msgDiv.classList.add('hidden');
    }, 3000);
  }
}

/**
 * Go back to home
 */
function goBack() {
  window.location.href = 'home.html';
}

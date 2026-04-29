// ==========================================
// ACCOUNTS PAGE LOGIC - WITH PRICEMASTER
// ==========================================

// Global variable for current receipt (for price calculation)
let currentReceiptNo = null;
let currentReceipt1Amount = 0;  // Store receipt 1 amount (read-only)
let currentStatus = '';

// Cache for variants to avoid repeated API calls
const variantCache = {};
const priceMasterCache = {};

// Debounce timer for search
let searchDebounceTimer = null;

// ==========================================
// PAGE INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('=== ACCOUNTS PAGE ===');
  
  // Check authentication
  const session = SessionManager.getSession();
  
  if (!session) {
    console.log('❌ No session - redirecting to login');
    alert('Please login first');
    window.location.href = 'index.html';
    return;
  }
  
  const user = session.user;
  
  // Check role access (only accounts and admin)
  if (user.role !== 'admin' && user.role !== 'accounts') {
    console.log('❌ Access denied for role:', user.role);
    alert('Access denied. Only admin and accounts can access this page.');
    window.location.href = 'home.html';
    return;
  }
  
  console.log('✅ Access granted:', user.name, '/', user.role);
  
  // Initialize page
  initializeAccountsPage(user);
  
  // Setup event listeners
  setupEventListeners();
  
  // Load dashboard
  populateMonthOptions();
  loadDashboard();
});

/**
 * Initialize accounts page
 */
function initializeAccountsPage(user) {
  document.getElementById('currentUser').textContent = user.name + ' (' + user.role + ')';
  console.log('✅ Accounts page initialized for:', user.name);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Month filter change
  const monthFilter = document.getElementById('monthFilter');
  if (monthFilter) {
    monthFilter.addEventListener('change', loadDashboard);
  }
  
  // Search by change
  const searchBy = document.getElementById('searchBy');
  if (searchBy) {
    searchBy.addEventListener('change', handleSearchByChange);
  }
  
  // Date filter change
  const dateFilter = document.getElementById('dateFilter');
  if (dateFilter) {
    dateFilter.addEventListener('change', handleDateFilterChange);
  }
  
  // Financier change
  const financierName = document.getElementById('financierName');
  if (financierName) {
    financierName.addEventListener('change', handleFinancierChange);
  }
  
  // Calculate totals on amount changes
  ['receipt2Amount', 'receipt3Amount', 'receipt4Amount', 'disbursedAmount', 'finalPrice', 'financeComm'].forEach(function(id) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('input', calculateTotals);
    }
  });
  
  // Form submission
  const accountsForm = document.getElementById('accountsForm');
  if (accountsForm) {
    accountsForm.addEventListener('submit', handleUpdate);
  }
  
  // Enter key in search
  const searchValue = document.getElementById('searchValue');
  if (searchValue) {
    searchValue.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') searchRecords();
    });
  }
}

/**
 * Populate month dropdown options
 */
function populateMonthOptions() {
  const select = document.getElementById('monthFilter');
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  select.innerHTML = '';
  
  // Add "All Months" option
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'All Months';
  select.appendChild(allOption);
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentYear, currentMonth - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const value = year + '-' + month;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    if (i === 0) option.selected = true;
    select.appendChild(option);
  }
}

/**
 * Load dashboard data
 */
async function loadDashboard() {
  const monthFilter = document.getElementById('monthFilter');
  const month = monthFilter ? monthFilter.value : '';
  const sessionId = SessionManager.getSessionId();
  
  console.log('🔍 Loading dashboard...');
  console.log('  Month filter value:', month);
  console.log('  Session ID:', sessionId);
  
  try {
    const response = await API.getAccountsDashboard(sessionId, month);
    
    console.log('📊 Dashboard response:', JSON.stringify(response, null, 2));
    console.log('  Response keys:', Object.keys(response));
    console.log('  Response.success:', response.success);
    
    if (response.success) {
      // Backend returns: dashboard.accountCheckYes, dashboard.accountCheckNo, dashboard.accountCheckBlank
      const yesCount = response.dashboard.accountCheckYes || 0;
      const noCount = response.dashboard.accountCheckNo || 0;
      const blankCount = response.dashboard.accountCheckBlank || 0;
      
      console.log('  ✅ Yes Count:', yesCount);
      console.log('  ⚠️ No Count:', noCount);
      console.log('  ⭕ Blank Count:', blankCount);
      
      document.getElementById('countYes').textContent = yesCount;
      document.getElementById('countNo').textContent = noCount;
      document.getElementById('countBlank').textContent = blankCount;
    } else {
      console.error('❌ Dashboard error:', response.message);
      showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('❌ Dashboard exception:', error);
    showMessage('Failed to load dashboard', 'error');
  }
}

/**
 * Filter by status (when clicking dashboard cards)
 */
async function filterByStatus(status) {
  currentStatus = status;
  const month = document.getElementById('monthFilter').value;
  const sessionId = SessionManager.getSessionId();
  
  // Update active card
  document.querySelectorAll('.stat-card').forEach(function(card) {
    card.classList.remove('active');
  });
  event.currentTarget.classList.add('active');
  
  console.log('Filtering by status:', status, 'for month:', month);
  
  try {
    const response = await API.getAccountsByStatus(sessionId, month, status);
    
    if (response.success) {
      displayResults(response.results);
      const statusLabel = status === '' ? 'BLANK' : status.toUpperCase();
      showMessage(response.results.length + ' records found with Account Check = ' + statusLabel, 'success');
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Filter error:', error);
    showMessage('Failed to filter records', 'error');
  }
}

/**
 * Handle search by dropdown change
 */
function handleSearchByChange() {
  const searchBy = document.getElementById('searchBy').value;
  const searchValueSection = document.getElementById('searchValueSection');
  const executiveDropdownSection = document.getElementById('executiveDropdownSection');
  const dateFilterSection = document.getElementById('dateFilterSection');
  
  // Hide all special sections first
  if (searchValueSection) searchValueSection.style.display = 'none';
  if (executiveDropdownSection) executiveDropdownSection.style.display = 'none';
  if (dateFilterSection) dateFilterSection.style.display = 'none';
  
  // Show appropriate section
  if (searchBy === 'Executive Name') {
    if (executiveDropdownSection) executiveDropdownSection.style.display = 'block';
  } else if (searchBy === 'Booking Date') {
    if (dateFilterSection) dateFilterSection.style.display = 'block';
  } else {
    if (searchValueSection) searchValueSection.style.display = 'block';
  }
}

/**
 * Handle date filter change
 */
function handleDateFilterChange() {
  const dateFilter = document.getElementById('dateFilter').value;
  const singleDateSection = document.getElementById('singleDateSection');
  const dateRangeSection = document.getElementById('dateRangeSection');
  
  if (dateFilter === 'single') {
    if (singleDateSection) singleDateSection.style.display = 'block';
    if (dateRangeSection) dateRangeSection.style.display = 'none';
  } else if (dateFilter === 'range') {
    if (singleDateSection) singleDateSection.style.display = 'none';
    if (dateRangeSection) dateRangeSection.style.display = 'block';
  } else {
    if (singleDateSection) singleDateSection.style.display = 'none';
    if (dateRangeSection) dateRangeSection.style.display = 'none';
  }
}

/**
 * Search records with date filter support
 */
async function searchRecords() {
  const searchBy = document.getElementById('searchBy').value;
  const sessionId = SessionManager.getSessionId();
  
  let searchValue = '';
  let dateFilter = null;
  let singleDate = null;
  let fromDate = null;
  let toDate = null;
  
  if (searchBy === 'Executive Name') {
    searchValue = document.getElementById('executiveDropdown').value;
    if (!searchValue) {
      showMessage('Please select an executive', 'error');
      return;
    }
  } else if (searchBy === 'Booking Date') {
    dateFilter = document.getElementById('dateFilter').value;
    
    if (dateFilter === 'single') {
      singleDate = document.getElementById('singleDate').value;
      if (!singleDate) {
        showMessage('Please select a date', 'error');
        return;
      }
      searchValue = singleDate;
    } else if (dateFilter === 'range') {
      fromDate = document.getElementById('fromDate').value;
      toDate = document.getElementById('toDate').value;
      if (!fromDate || !toDate) {
        showMessage('Please select both from and to dates', 'error');
        return;
      }
      searchValue = 'range';
    } else {
      searchValue = 'preset';
    }
  } else {
    searchValue = document.getElementById('searchValue').value.trim();
    if (!searchValue) {
      showMessage('Please enter a search value', 'error');
      return;
    }
  }
  
  console.log('Searching:', searchBy, '=', searchValue);
  
  // Store search params for export
  window.lastSearchParams = {searchBy, searchValue, dateFilter, singleDate, fromDate, toDate};
  
  try {
    const response = await API.searchAccountsRecords(sessionId, searchBy, searchValue, dateFilter, singleDate, fromDate, toDate);
    
    if (response.success) {
      window.lastSearchResults = response.results;
      displayResults(response.results);
      showMessage(response.results.length + ' record(s) found', 'success');
      
      // Show export button
      const exportBtn = document.getElementById('exportBtn');
      if (exportBtn) exportBtn.style.display = 'inline-block';
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Search error:', error);
    showMessage('Failed to search records', 'error');
  }
}

/**
 * Display search/filter results
 */
function displayResults(results) {
  const container = document.getElementById('resultsContainer');
  const tbody = document.getElementById('resultsBody');
  
  if (!container || !tbody) return;
  
  tbody.innerHTML = '';
  
  if (results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #999;">No records found</td></tr>';
    container.style.display = 'block';
    return;
  }
  
  results.forEach(function(record) {
    const tr = document.createElement('tr');
    tr.onclick = function() { loadRecordDetails(record.receiptNo); };
    
    const statusClass = record.accountCheck === 'Yes' ? 'status-yes' : 
                       record.accountCheck === 'No' ? 'status-no' : 'status-blank';
    const statusText = record.accountCheck || 'BLANK';
    
    tr.innerHTML = `
      <td>${record.receiptNo || '-'}</td>
      <td>${record.customerName || '-'}</td>
      <td>${record.model || '-'}</td>
      <td>${record.bookingDate || '-'}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td><button class="btn-view" onclick="event.stopPropagation(); loadRecordDetails('${record.receiptNo}');">View</button></td>
    `;
    
    tbody.appendChild(tr);
  });
  
  container.style.display = 'block';
}

/**
 * Load record details
 */
async function loadRecordDetails(receiptNo) {
  console.log('Loading record:', receiptNo);
  
  try {
    const sessionId = SessionManager.getSessionId();
    const response = await API.getRecordByReceiptNo(sessionId, receiptNo);
    
    if (response.success) {
      await populateDetails(response.record);
      document.getElementById('detailsSection').style.display = 'block';
      document.getElementById('detailsSection').scrollIntoView({ behavior: 'smooth' });
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Load record error:', error);
    showMessage('Failed to load record details', 'error');
  }
}

/**
 * Populate record details - WITH PRICEMASTER INTEGRATION
 */
async function populateDetails(record) {
  const user = SessionManager.getCurrentUser();
  
  // SET CURRENT RECEIPT NO FOR PRICE CALCULATION
  currentReceiptNo = record.receiptNo;
  currentReceipt1Amount = parseFloat(record.receipt1Amount) || 0;
  
  // STORE ENGINE AND FRAME NUMBERS for validation
  window.currentEngineNumber = record.engineNumber || '';
  window.currentFrameNumber = record.frameNumber || '';
  
  console.log('Populating details for receipt:', currentReceiptNo);
  console.log('Engine Number:', window.currentEngineNumber);
  console.log('Frame Number:', window.currentFrameNumber);
  
  // Protected fields
  document.getElementById('receiptNoDisplay').textContent = record.receiptNo || '-';
  document.getElementById('protectedExecutiveName').textContent = record.executiveName || '-';
  document.getElementById('protectedBookingDate').textContent = record.bookingDate || '-';
  document.getElementById('protectedCustomerName').textContent = record.customerName || '-';
  document.getElementById('protectedMobileNo').textContent = record.mobileNo || '-';
  document.getElementById('protectedModel').textContent = record.model || '-';
  document.getElementById('protectedVariant').textContent = record.variant || '-';
  document.getElementById('protectedColour').textContent = record.colour || '-';
  document.getElementById('protectedDeliveryDate').textContent = record.deliveryDate || '-';
  document.getElementById('protectedSalesRemark').textContent = record.salesRemark || 'N/A';

  // Editable engine/frame inputs (accounts can approve/correct these)
  document.getElementById('editEngineNumber').value = record.engineNumber || '';
  document.getElementById('editFrameNumber').value  = record.frameNumber  || '';
  
  // Editable sales fields
  document.getElementById('discount').value = record.discount || '';
  document.getElementById('finalPrice').value = record.finalPrice || '';
  
  // Financier
  const standardFinanciers = ['Cash', 'TVS Credit', 'Shriram Finance', 'Hinduja Finance', 
                              'Janan SFB', 'TATA Capital', 'Indusind Bank', 'Berar Finance', 'IDFC'];
  
  if (standardFinanciers.includes(record.financierName)) {
    document.getElementById('financierName').value = record.financierName;
  } else if (record.financierName) {
    document.getElementById('financierName').value = 'Other';
    const otherSection = document.getElementById('otherFinancierSection');
    const otherInput = document.getElementById('otherFinancierInput');
    if (otherSection) otherSection.style.display = 'block';
    if (otherInput) {
      otherInput.value = record.financierName;
      otherInput.required = true;
    }
  }
  
  // Accessories - render based on PriceMaster data
  await renderAccessoriesFromPriceMaster(record.model, record.variant, record);
  
  // Accounts fields
  document.getElementById('accountCheck').value = record.accountCheck || '';
  document.getElementById('accountRemark').value = record.accountRemark || '';
  
  // Receipt 1 fields (read-only display above Receipt 2)
  document.getElementById('receiptNo1Display').value = record.receiptNo1 || '';
  document.getElementById('receipt1AmountDisplay').value = record.receipt1Amount || '';
  
  // Receipt 2-4 fields
  document.getElementById('receiptNo2').value = record.receiptNo2 || '';
  document.getElementById('receipt2Amount').value = record.receipt2Amount || '';
  document.getElementById('receiptNo3').value = record.receiptNo3 || '';
  document.getElementById('receipt3Amount').value = record.receipt3Amount || '';
  document.getElementById('receiptNo4').value = record.receiptNo4 || '';
  document.getElementById('receipt4Amount').value = record.receipt4Amount || '';
  document.getElementById('doNumber').value = record.doNumber || '';
  document.getElementById('disbursedAmount').value = record.disbursedAmount || '';
  
  // Finance Commission
  const financeComm = document.getElementById('financeComm');
  if (financeComm) {
    financeComm.value = record.financeComm || '';
  }
  
  // Check if view-only mode (Account Check = Yes)
  const isViewOnly = record.accountCheck === 'Yes';
  
  const viewOnlyBanner = document.getElementById('viewOnlyBanner');
  if (viewOnlyBanner) {
    viewOnlyBanner.style.display = isViewOnly ? 'block' : 'none';
  }
  
  disableFormFields(isViewOnly);
  calculateTotals();
}

/**
 * Load variants from PriceMaster based on model (with caching)
 */
async function loadVariantsFromPriceMaster(model) {
  const variantSelect = document.getElementById('variant');
  
  if (!model || !variantSelect) {
    if (variantSelect) {
      variantSelect.innerHTML = '<option value="">-- Select Model First --</option>';
    }
    return;
  }
  
  // Check cache first
  if (variantCache[model]) {
    console.log('⚡ Using cached variants for', model);
    variantSelect.innerHTML = '<option value="">-- Select --</option>';
    variantCache[model].forEach(function(variant) {
      const option = document.createElement('option');
      option.value = variant;
      option.textContent = variant;
      variantSelect.appendChild(option);
    });
    return;
  }
  
  variantSelect.innerHTML = '<option value="">-- Loading variants... --</option>';
  
  try {
    const response = await API.getPriceMasterVariants(model);
    
    if (response.success) {
      // Cache the variants
      variantCache[model] = response.variants;
      
      variantSelect.innerHTML = '<option value="">-- Select --</option>';
      
      response.variants.forEach(function(variant) {
        const option = document.createElement('option');
        option.value = variant;
        option.textContent = variant;
        variantSelect.appendChild(option);
      });
      
      console.log('✅ Loaded', response.variants.length, 'variants for', model);
    } else {
      console.error('❌ Error loading variants:', response.message);
      variantSelect.innerHTML = '<option value="">-- Error loading variants --</option>';
    }
  } catch (error) {
    console.error('❌ Load variants error:', error);
    variantSelect.innerHTML = '<option value="">-- Error loading variants --</option>';
  }
}

/**
 * Render accessories from PriceMaster
 */
async function renderAccessoriesFromPriceMaster(model, variant, record) {
  const accessoryContainer = document.getElementById('accessoryFields');
  
  if (!accessoryContainer) return;
  
  accessoryContainer.innerHTML = '';
  
  if (!model || !variant) return;
  
  try {
    const response = await API.getPriceMasterDetails(model, variant);
    
    if (response.success) {
      const details = response.details;
      
      // Create a wrapper div for 2-column grid layout
      const gridWrapper = document.createElement('div');
      gridWrapper.style.display = 'grid';
      gridWrapper.style.gridTemplateColumns = 'repeat(2, 1fr)';
      gridWrapper.style.gap = '15px';
      gridWrapper.style.gridColumn = '1 / -1'; // Span full width in parent form-grid
      
      // Render accessories that have prices
      const accessories = [
        { key: 'guardPrice', name: 'Guard', id: 'guard' },
        { key: 'gripPrice', name: 'Grip Cover', id: 'gripcover' },
        { key: 'seatCoverPrice', name: 'Seat Cover', id: 'seatcover' },
        { key: 'matinPrice', name: 'Matin', id: 'matin' },
        { key: 'tankCoverPrice', name: 'Tank Cover', id: 'tankcover' },
        { key: 'handleHookPrice', name: 'Handle Hook', id: 'handlehook' },
        { key: 'rainCoverPrice', name: 'Rain Cover', id: 'raincover' },
        { key: 'buzzerPrice', name: 'Buzzer', id: 'buzzer' },
        { key: 'backRestPrice', name: 'Back Rest', id: 'backrest' }
      ];
      
      accessories.forEach(function(acc) {
        if (details[acc.key]) {
          const formGroup = document.createElement('div');
          formGroup.className = 'form-group';
          
          const label = document.createElement('label');
          label.textContent = acc.name;
          
          const select = document.createElement('select');
          select.id = acc.id;
          select.className = 'editable-highlight';
          select.innerHTML = '<option value="">-- Select --</option><option>Yes</option><option>No</option>';
          select.value = record[acc.id] || '';
          
          formGroup.appendChild(label);
          formGroup.appendChild(select);
          gridWrapper.appendChild(formGroup);
        }
      });
      
      // Helmet with quantity
      if (details.helmetPrice) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = 'Helmet';
        
        const select = document.createElement('select');
        select.id = 'helmet';
        select.className = 'editable-highlight';
        select.innerHTML = '<option value="">-- Select --</option><option>1</option><option>2</option><option>No</option>';
        select.value = record.helmet || '';
        
        formGroup.appendChild(label);
        formGroup.appendChild(select);
        gridWrapper.appendChild(formGroup);
      }
      
      accessoryContainer.appendChild(gridWrapper);
      
      console.log('✅ Rendered accessories for', model, variant);
    }
  } catch (error) {
    console.error('❌ Error loading accessories:', error);
  }
}

/**
 * Handle financier change
 */
function handleFinancierChange() {
  const financierSelect = document.getElementById('financierName');
  const otherSection = document.getElementById('otherFinancierSection');
  const otherInput = document.getElementById('otherFinancierInput');
  
  if (!financierSelect) return;
  
  if (financierSelect.value === 'Other') {
    if (otherSection) otherSection.style.display = 'block';
    if (otherInput) otherInput.required = true;
  } else {
    if (otherSection) otherSection.style.display = 'none';
    if (otherInput) {
      otherInput.value = '';
      otherInput.required = false;
    }
  }
}

/**
 * Calculate totals
 */
function calculateTotals() {
  const r1 = currentReceipt1Amount;  // Read-only from loaded record
  const r2 = parseFloat(document.getElementById('receipt2Amount').value) || 0;
  const r3 = parseFloat(document.getElementById('receipt3Amount').value) || 0;
  const r4 = parseFloat(document.getElementById('receipt4Amount').value) || 0;
  const disbursed = parseFloat(document.getElementById('disbursedAmount').value) || 0;
  const finalPrice = parseFloat(document.getElementById('finalPrice').value) || 0;
  
  const cashTotal = r1 + r2 + r3 + r4;
  const grandTotal = cashTotal + disbursed;  // No Finance Commission in Grand Total
  
  const finalPriceDisplay = document.getElementById('finalPriceDisplay');
  const cashTotalDisplay = document.getElementById('cashTotalDisplay');
  const disbursedDisplay = document.getElementById('disbursedDisplay');
  const totalDisplay = document.getElementById('totalDisplay');
  
  if (finalPriceDisplay) finalPriceDisplay.textContent = '₹' + finalPrice.toFixed(2);
  if (cashTotalDisplay) cashTotalDisplay.textContent = '₹' + cashTotal.toFixed(2);
  if (disbursedDisplay) disbursedDisplay.textContent = '₹' + disbursed.toFixed(2);
  if (totalDisplay) totalDisplay.textContent = '₹' + grandTotal.toFixed(2);
}

/**
 * Disable/enable form fields
 */
function disableFormFields(disable) {
  const editableFields = document.querySelectorAll('.editable-highlight');
  const updateBtn = document.getElementById('updateBtn');
  
  editableFields.forEach(function(field) {
    field.disabled = disable;
  });
  
  if (updateBtn) {
    updateBtn.disabled = disable;
  }
}

/**
 * Handle update form submission
 */
async function handleUpdate(e) {
  e.preventDefault();
  
  if (!currentReceiptNo) {
    showMessage('No record loaded', 'error');
    return;
  }
  
  // VALIDATION: Require price verification to be saved before updating
  if (!window.lastPriceVerification) {
    alert('❌ Price Verification Required!\n\nPlease click "Calculate from PriceMaster" and save the price verification before updating the record.');
    return;
  }
  
  // VALIDATION: Check Engine and Frame numbers are filled (before Account Check = Yes)
  const accountCheck = document.getElementById('accountCheck').value;
  if (accountCheck === 'Yes') {
    // Read from the editable input fields (accounts can fill/correct these)
    const engineNumber = (document.getElementById('editEngineNumber').value || '').trim();
    const frameNumber  = (document.getElementById('editFrameNumber').value  || '').trim();

    if (!engineNumber || !frameNumber) {
      alert('❌ Engine and Frame Numbers Required!\n\nCannot mark Account Check as "Yes" because Engine Number and/or Frame Number are missing.\n\nPlease enter the Engine/Chassis Number and Frame Number in the fields above.');
      return;
    }
  }
  
  const sessionId = SessionManager.getSessionId();
  
  // Get financier value
  let financierValue = document.getElementById('financierName').value;
  if (financierValue === 'Other') {
    const otherInput = document.getElementById('otherFinancierInput');
    if (otherInput && otherInput.value.trim()) {
      financierValue = otherInput.value.trim();
    } else {
      showMessage('Please enter financier name', 'error');
      return;
    }
  }
  
  // Collect accessory values
  const accessories = {};
  ['guard', 'gripcover', 'seatcover', 'matin', 'tankcover', 'handlehook', 'helmet'].forEach(function(id) {
    const element = document.getElementById(id);
    if (element) {
      accessories[id] = element.value;
    }
  });
  
  // VALIDATION: Block Account Check = "Yes" if calculation is SHORT (less than Final Price)
  // Allow "Yes" if: calculatedTotal equals OR is greater than (EXCESS) Final Price
  // (accountCheck already declared above in Engine/Frame validation)
  if (accountCheck === 'Yes') {
    const r1 = currentReceipt1Amount;
    const r2 = parseFloat(document.getElementById('receipt2Amount').value) || 0;
    const r3 = parseFloat(document.getElementById('receipt3Amount').value) || 0;
    const r4 = parseFloat(document.getElementById('receipt4Amount').value) || 0;
    const disbursed = parseFloat(document.getElementById('disbursedAmount').value) || 0;
    const financeCommission = parseFloat(document.getElementById('financeComm').value) || 0;
    const calculatedTotal = r1 + r2 + r3 + r4 + disbursed - financeCommission;
    const finalPrice = parseFloat(document.getElementById('finalPrice').value) || 0;
    
    // Only block if SHORT (calculatedTotal < finalPrice)
    // Allow if MATCHED or EXCESS (calculatedTotal >= finalPrice)
    if (calculatedTotal < finalPrice) {
      alert(
        `❌ Cannot mark Account Check as "Yes" - Amount is SHORT.\n\n` +
        `Formula: Receipt1 + Receipt2 + Receipt3 + Receipt4 + Disbursed - Finance Commission = Final Price\n\n` +
        `Receipt 1: ₹${r1.toFixed(2)}\n` +
        `Receipt 2: ₹${r2.toFixed(2)}\n` +
        `Receipt 3: ₹${r3.toFixed(2)}\n` +
        `Receipt 4: ₹${r4.toFixed(2)}\n` +
        `Disbursed: ₹${disbursed.toFixed(2)}\n` +
        `Finance Commission: ₹${financeCommission.toFixed(2)}\n\n` +
        `Calculated Total: ₹${calculatedTotal.toFixed(2)}\n` +
        `Final Price: ₹${finalPrice.toFixed(2)}\n\n` +
        `SHORT by: ₹${(finalPrice - calculatedTotal).toFixed(2)}\n\n` +
        `Collected amount must be equal to or greater than Final Price!`
      );
      return;
    }
  }
  
  const data = {
    receiptNo: currentReceiptNo,
    // Preserve variant and colour (read-only but must be sent to prevent deletion)
    variant: document.getElementById('protectedVariant')?.textContent || '',
    colour: document.getElementById('protectedColour')?.textContent || '',
    discount: document.getElementById('discount').value,
    finalPrice: document.getElementById('finalPrice').value,
    financierName: financierValue,
    ...accessories,
    accountantName: SessionManager.getCurrentUser()?.name || '',  // Add accountant name from session
    accountCheck: document.getElementById('accountCheck').value,
    accountRemark: document.getElementById('accountRemark').value,
    // Preserve receipt1 fields (read-only from sales)
    receiptNo1: document.getElementById('receiptNo1Display')?.value || '',
    receipt1Amount: currentReceipt1Amount || '',
    receiptNo2: document.getElementById('receiptNo2').value,
    receipt2Amount: document.getElementById('receipt2Amount').value,
    receiptNo3: document.getElementById('receiptNo3').value,
    receipt3Amount: document.getElementById('receipt3Amount').value,
    receiptNo4: document.getElementById('receiptNo4').value,
    receipt4Amount: document.getElementById('receipt4Amount').value,
    doNumber: document.getElementById('doNumber').value,
    disbursedAmount: document.getElementById('disbursedAmount').value
  };
  
  // Add finance commission (Column BD)
  const financeComm = document.getElementById('financeComm');
  if (financeComm) {
    data.financeComm = financeComm.value || '';
  }
  
  // Add price verification fields if they exist
  // These are set by the "Calculate from PriceMaster" button
  if (window.lastPriceVerification) {
    data.priceMaster = window.lastPriceVerification.calculatedTotal || '';  // Column BE
    const _pvMatched = window.lastPriceVerification.matched;
    const _pvNote = window.lastPriceVerification.note || '';
    data.priceMatched = _pvMatched ? 'Yes' : (_pvNote ? 'No \u2014 ' + _pvNote : 'No');  // Column BF
  }
  
  // Attach engine/frame from the editable inputs
  data.engineNumber = (document.getElementById('editEngineNumber').value || '').trim();
  data.frameNumber  = (document.getElementById('editFrameNumber').value  || '').trim();

  console.log('💾 Preparing account record update:');
  console.log('   Receipt No:', data.receiptNo);
  console.log('   Engine Number:', data.engineNumber);
  console.log('   Frame Number:', data.frameNumber);
  console.log('   Accountant Name:', data.accountantName);
  console.log('   Full data:', data);

  // Show approval modal so accountant can confirm engine/frame before saving
  window._pendingSaveData = data;
  showApprovalModal();
}

/**
 * Show the Frame & Chassis approval modal
 */
function showApprovalModal() {
  const data = window._pendingSaveData || {};
  document.getElementById('modalEngineNumber').value = data.engineNumber || '';
  document.getElementById('modalFrameNumber').value  = data.frameNumber  || '';
  const modal = document.getElementById('approvalModal');
  modal.style.display = 'flex';
}

/**
 * Close the approval modal without saving
 */
function closeApprovalModal() {
  document.getElementById('approvalModal').style.display = 'none';
  window._pendingSaveData = null;
}

/**
 * Confirm the approved engine/frame numbers and proceed with saving
 */
async function confirmApprovalAndSave() {
  const data = window._pendingSaveData;
  if (!data) return;

  // Read the (possibly edited) values from the modal
  const approvedEngine = (document.getElementById('modalEngineNumber').value || '').trim();
  const approvedFrame  = (document.getElementById('modalFrameNumber').value  || '').trim();

  // Write approved values back to the form inputs and to data
  document.getElementById('editEngineNumber').value = approvedEngine;
  document.getElementById('editFrameNumber').value  = approvedFrame;
  data.engineNumber = approvedEngine;
  data.frameNumber  = approvedFrame;

  // Close modal
  document.getElementById('approvalModal').style.display = 'none';
  window._pendingSaveData = null;

  // Now save
  try {
    const updateBtn = document.getElementById('updateBtn');
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.textContent = '💾 Updating...';
    }

    const sessionId = SessionManager.getSessionId();
    const response = await API.updateAccountsRecord(sessionId, data);

    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.textContent = '💾 Update Record';
    }

    if (response.success) {
      showMessage('✅ Record updated successfully!', 'success');

      // Reload dashboard
      loadDashboard();

      // If Account Check was set to Yes, enable view-only mode
      if (data.accountCheck === 'Yes') {
        const viewOnlyBanner = document.getElementById('viewOnlyBanner');
        if (viewOnlyBanner) viewOnlyBanner.style.display = 'block';
        disableFormFields(true);
      }
    } else {
      showMessage(response.message || 'Error updating record', 'error');
    }
  } catch (error) {
    const updateBtn = document.getElementById('updateBtn');
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.textContent = '💾 Update Record';
    }
    console.error('Update error:', error);
    showMessage('Error updating record', 'error');
  }
}

/**
 * Close details section
 */
function closeDetails() {
  document.getElementById('detailsSection').style.display = 'none';
  currentReceiptNo = null;
}

/**
 * Go back to home
 */
function goBack() {
  window.location.href = 'home.html';
}

/**
 * Show message
 */
function showMessage(text, type) {
  const msgDiv = document.getElementById('statusMessage');
  if (!msgDiv) return;
  
  msgDiv.textContent = text;
  msgDiv.className = 'message ' + type;
  msgDiv.classList.remove('hidden');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  if (type === 'success') {
    setTimeout(function() {
      msgDiv.classList.add('hidden');
    }, 3000);
  }
}

// ==========================================
// PRICE CALCULATION FROM PRICEMASTER
// ==========================================

/**
 * Calculate price from PriceMaster - Uses CURRENT form values
 */
async function calculatePrice() {
  if (!currentReceiptNo) {
    alert('Please search and load a record first');
    return;
  }
  
  const breakdown = document.getElementById('priceBreakdown');
  if (!breakdown) return;
  
  breakdown.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">⏳ Calculating...</div>';
  breakdown.style.display = 'block';
  
  try {
    // Get model and variant from PROTECTED fields (not editable)
    const model = document.getElementById('protectedModel').textContent.trim();
    const variant = document.getElementById('protectedVariant').textContent.trim();
    
    console.log('🔍 Calculating price for:', model, variant);
    
    if (!model || model === '-' || !variant || variant === '-') {
      breakdown.innerHTML = '<div style="text-align: center; padding: 20px; color: #e74c3c;">❌ Model/Variant not found. Please load a record first.</div>';
      return;
    }
    
    // Get PriceMaster details (sessionId handled by API wrapper)
    const pmResponse = await API.getPriceMasterDetails(model, variant);
    
    console.log('  📋 PriceMaster API response:', pmResponse);
    
    if (!pmResponse.success) {
      breakdown.innerHTML = `<div style="text-align: center; padding: 20px; color: #e74c3c;">❌ ${pmResponse.message}</div>`;
      return;
    }
    
    const pm = pmResponse.details;
    
    // Calculate base total
    let total = 0;
    total += parseFloat(pm.exShowroom) || 0;
    total += parseFloat(pm.rto) || 0;
    total += parseFloat(pm.insurance) || 0;
    total += parseFloat(pm.serviceCharge) || 0;
    total += parseFloat(pm.mandAccessories) || 0;
    
    const breakdownData = {
      exShowroom: pm.exShowroom || 0,
      rto: pm.rto || 0,
      insurance: pm.insurance || 0,
      serviceCharge: pm.serviceCharge || 0,
      mandAccessories: pm.mandAccessories || 0,
      accessories: [],
      financeComm: 0
    };
    
    // Add ONLY "Yes" accessories from CURRENT form values
    const accessoryMappings = [
      { id: 'guard', name: 'Guard', priceKey: 'guardPrice' },
      { id: 'gripcover', name: 'Grip Cover', priceKey: 'gripPrice' },
      { id: 'seatcover', name: 'Seat Cover', priceKey: 'seatCoverPrice' },
      { id: 'matin', name: 'Matin', priceKey: 'matinPrice' },
      { id: 'tankcover', name: 'Tank Cover', priceKey: 'tankCoverPrice' },
      { id: 'handlehook', name: 'Handle Hook', priceKey: 'handleHookPrice' },
      { id: 'raincover', name: 'Rain Cover', priceKey: 'rainCoverPrice' },
      { id: 'buzzer', name: 'Buzzer', priceKey: 'buzzerPrice' },
      { id: 'backrest', name: 'Back Rest', priceKey: 'backRestPrice' }
    ];
    
    accessoryMappings.forEach(acc => {
      const element = document.getElementById(acc.id);
      if (element && element.value === 'Yes' && pm[acc.priceKey]) {
        const price = parseFloat(pm[acc.priceKey]);
        total += price;
        breakdownData.accessories.push({ name: acc.name, price: price });
      }
    });
    
    // Helmet - check if "Yes" or has quantity
    const helmetEl = document.getElementById('helmet');
    if (helmetEl && pm.helmetPrice) {
      const helmetValue = helmetEl.value;
      if (helmetValue && helmetValue !== 'No' && helmetValue !== '') {
        const qty = helmetValue === 'Yes' ? 1 : parseInt(helmetValue) || 1;
        const price = parseFloat(pm.helmetPrice) * qty;
        total += price;
        breakdownData.accessories.push({ name: `Helmet (x${qty})`, price: price });
      }
    }
    
    // Add Finance Commission from form
    const financeCommEl = document.getElementById('financeComm');
    if (financeCommEl && financeCommEl.value) {
      const financeComm = parseFloat(financeCommEl.value) || 0;
      if (financeComm > 0) {
        total += financeComm;
        breakdownData.financeComm = financeComm;
      }
    }
    
    // Add Hypothecation Rs 500 if financier is not Cash
    const financierEl = document.getElementById('financierName');
    let hypothecation = 0;
    if (financierEl && financierEl.value && financierEl.value !== 'Cash') {
      hypothecation = 500;
      total += hypothecation;
    }
    breakdownData.hypothecation = hypothecation;
    
    // Get entered values
    const finalPrice = parseFloat(document.getElementById('finalPrice').value) || 0;
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    
    // Add finance commission to Final Price for comparison
    const finalPriceWithFinanceComm = finalPrice + breakdownData.financeComm;
    
    // Calculate: (PriceMaster Total - Discount) should equal (Final Price + Finance Commission)
    const afterDiscount = total - discount;
    
    // Calculate Amount Collected (Receipt 1-4 + Disbursed Amount)
    const r1 = currentReceipt1Amount || 0;
    const r2 = parseFloat(document.getElementById('receipt2Amount').value) || 0;
    const r3 = parseFloat(document.getElementById('receipt3Amount').value) || 0;
    const r4 = parseFloat(document.getElementById('receipt4Amount').value) || 0;
    const disbursed = parseFloat(document.getElementById('disbursedAmount').value) || 0;
    const amountCollected = r1 + r2 + r3 + r4 + disbursed;
    
    console.log('💰 Price Comparison:');
    console.log('   Calculated Total (PriceMaster):', total);
    console.log('   Discount:', discount);
    console.log('   After Discount:', afterDiscount);
    console.log('   Final Price (Entered):', finalPrice);
    console.log('   Finance Commission:', breakdownData.financeComm);
    console.log('   Final Price + Finance Comm:', finalPriceWithFinanceComm);
    console.log('   Amount Collected (R1-4 + Disbursed):', amountCollected);
    
    // Display breakdown
    displayPriceBreakdown({
      breakdown: breakdownData,
      calculatedTotal: Math.round(total),
      discount: discount,
      afterDiscount: Math.round(afterDiscount),
      finalPrice: finalPrice,
      finalPriceWithFinanceComm: Math.round(finalPriceWithFinanceComm),
      amountCollected: Math.round(amountCollected)
    });
    
  } catch (error) {
    console.error('Calculate price error:', error);
    breakdown.innerHTML = '<div style="text-align: center; padding: 20px; color: #e74c3c;">❌ Error calculating price</div>';
  }
}

/**
 * Display price breakdown
 */
function displayPriceBreakdown(calculation) {
  const breakdown = calculation.breakdown;
  const calculatedTotal = calculation.calculatedTotal;
  const discount = calculation.discount || 0;
  const afterDiscount = calculation.afterDiscount || 0;
  const finalPrice = calculation.finalPrice || 0;
  const finalPriceWithFinanceComm = calculation.finalPriceWithFinanceComm || 0;
  const amountCollected = calculation.amountCollected || 0;
  
  // All three amounts must match
  const matched = Math.abs(afterDiscount - finalPriceWithFinanceComm) < 1 && 
                  Math.abs(afterDiscount - amountCollected) < 1 &&
                  Math.abs(finalPriceWithFinanceComm - amountCollected) < 1;
  
  let html = '<div style="background: white; padding: 15px; border-radius: 8px;">';
  
  // Base amounts
  html += '<div style="font-size: 14px; line-height: 2;">';
  html += `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f0f0f0; padding: 5px 0;">`;
  html += `<span style="color: #666;">Ex-Showroom:</span><span style="font-weight: 600;">₹${breakdown.exShowroom.toLocaleString()}</span></div>`;
  html += `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f0f0f0; padding: 5px 0;">`;
  html += `<span style="color: #666;">RTO:</span><span style="font-weight: 600;">₹${breakdown.rto.toLocaleString()}</span></div>`;
  html += `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f0f0f0; padding: 5px 0;">`;
  html += `<span style="color: #666;">Insurance:</span><span style="font-weight: 600;">₹${breakdown.insurance.toLocaleString()}</span></div>`;
  html += `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f0f0f0; padding: 5px 0;">`;
  html += `<span style="color: #666;">Service Charge:</span><span style="font-weight: 600;">₹${breakdown.serviceCharge.toLocaleString()}</span></div>`;
  html += `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f0f0f0; padding: 5px 0;">`;
  html += `<span style="color: #666;">Mand Accessories:</span><span style="font-weight: 600;">₹${breakdown.mandAccessories.toLocaleString()}</span></div>`;
  
  // Selected accessories
  if (breakdown.accessories.length > 0) {
    html += '<div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid #667eea20;">';
    html += '<div style="font-weight: 600; color: #667eea; margin-bottom: 5px;">Selected Accessories:</div>';
    breakdown.accessories.forEach(function(acc) {
      html += `<div style="display: flex; justify-content: space-between; padding: 3px 0 3px 15px; color: #666;">`;
      html += `<span>• ${acc.name}</span><span style="font-weight: 600;">₹${acc.price.toLocaleString()}</span></div>`;
    });
    html += '</div>';
  }
  
  // Finance commission
  if (breakdown.financeComm > 0) {
    html += `<div style="display: flex; justify-content: space-between; border-top: 1px solid #f0f0f0; padding: 8px 0; margin-top: 5px;">`;
    html += `<span style="color: #666;">Finance Comm:</span><span style="font-weight: 600;">₹${breakdown.financeComm.toLocaleString()}</span></div>`;
  }
  
  // Hypothecation
  if (breakdown.hypothecation > 0) {
    html += `<div style="display: flex; justify-content: space-between; border-top: 1px solid #f0f0f0; padding: 8px 0; margin-top: 5px;">`;
    html += `<span style="color: #666;">Hypothecation:</span><span style="font-weight: 600;">₹${breakdown.hypothecation.toLocaleString()}</span></div>`;
  }
  
  html += '</div>';
  
  // Totals comparison - Q3 Option B & Q4 Display Format
  html += '<div style="margin-top: 15px; padding: 15px; background: ' + (matched ? '#d4edda' : '#fff3cd') + '; border-radius: 8px; border: 2px solid ' + (matched ? '#28a745' : '#ffc107') + ';">';
  
  // Calculated Total
  html += '<div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 8px;">';
  html += `<span>CALCULATED TOTAL:</span><span style="color: #667eea;">₹${calculatedTotal.toLocaleString()}</span></div>`;
  
  // Discount
  html += '<div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 8px;">';
  html += `<span>DISCOUNT:</span><span style="color: #e74c3c;">- ₹${discount.toLocaleString()}</span></div>`;
  
  // After Discount (Calculated - Discount)
  html += '<div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid ' + (matched ? '#28a74550' : '#ffc10750') + ';">';
  html += `<span>AFTER DISCOUNT:</span><span style="color: #667eea;">₹${afterDiscount.toLocaleString()}</span></div>`;
  
  // Final Price (Entered) + Finance Commission
  html += '<div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 8px;">';
  html += `<span>FINAL PRICE (Entered):</span><span>₹${finalPrice.toLocaleString()}</span></div>`;
  
  html += '<div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 8px;">';
  html += `<span>+ FINANCE COMMISSION:</span><span style="color: #667eea;">₹${breakdown.financeComm.toLocaleString()}</span></div>`;
  
  html += '<div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid ' + (matched ? '#28a74550' : '#ffc10750') + ';">';
  html += `<span>TOTAL TO MATCH:</span><span style="color: #333;">₹${finalPriceWithFinanceComm.toLocaleString()}</span></div>`;
  
  // Section 3: Amount Collected (Receipt 1-4 + Disbursed Amount)
  html += '<div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px; color: #666;">';
  html += `<span>Receipt 1-4 + Disbursed Amount:</span><span style="font-weight: 600;">-</span></div>`;
  
  html += '<div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; margin-bottom: 8px;">';
  html += `<span>AMOUNT COLLECTED:</span><span style="color: #333;">₹${amountCollected.toLocaleString()}</span></div>`;
  
  // Result - Compare all three amounts
  html += '<div style="text-align: center; font-size: 18px; font-weight: 700; margin-top: 10px; padding-top: 10px; border-top: 2px solid ' + (matched ? '#28a74550' : '#ffc10750') + ';">';
  
  if (matched) {
    html += '<span style="color: #28a745;">✅ MATCHED</span>';
  } else {
    const diff = afterDiscount - amountCollected;
    const excessOrShort = diff > 0 ? 'SHORT' : 'EXCESS';
    const color = diff > 0 ? '#f44336' : '#ff9800';
    html += `<span style="color: ${color};">⚠️ ${excessOrShort}</span>`;
    html += `<div style="font-size: 13px; margin-top: 5px; color: #666;">After Discount vs Amount Collected: ₹${Math.abs(diff).toLocaleString()}</div>`;
  }

  html += '</div></div>';

  // Note field when not matched
  if (!matched) {
    html += '<div style="margin-top: 14px;">';
    html += '<label style="display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;">📝 Reason for mismatch <span style="color:#dc3545;">*</span></label>';
    html += '<textarea id="priceMatchedNote" rows="2" style="width:100%;padding:10px;border:2px solid #ffc107;border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;" placeholder="e.g. Customer discount given, error in receipt..."></textarea>';
    html += '</div>';
  }

  // Save button - save afterDiscount value
  html += '<button type="button" onclick="savePriceVerification(' + afterDiscount + ', ' + matched + ')" class="btn-primary" style="width: 100%; margin-top: 15px; padding: 12px; font-size: 15px;">';
  html += '💾 Save Verification';
  html += '</button>';
  
  html += '</div>';
  
  document.getElementById('priceBreakdown').innerHTML = html;
}

/**
 * Save price verification
 */
async function savePriceVerification(calculatedTotal, matched) {
  if (!currentReceiptNo) {
    alert('Receipt number not found');
    return;
  }

  // Read note — mandatory when not matched
  const noteEl = document.getElementById('priceMatchedNote');
  const note = noteEl ? noteEl.value.trim() : '';
  if (!matched && !note) {
    alert('Please enter a reason for mismatch before saving.');
    if (noteEl) { noteEl.focus(); noteEl.style.borderColor = '#dc3545'; }
    return;
  }
  if (noteEl) noteEl.style.borderColor = '#ffc107';

  // Store verification data for use in handleUpdate
  window.lastPriceVerification = {
    calculatedTotal: calculatedTotal,
    matched: matched,
    note: note
  };

  console.log('💾 Stored price verification:', window.lastPriceVerification);

  try {
    const response = await API.savePriceVerification(currentReceiptNo, calculatedTotal, matched, note);
    
    if (response.success) {
      alert('✅ Price verification saved successfully!\n\nRemember to click "Update Record" to save all changes.');
    } else {
      alert('❌ ' + response.message);
    }
  } catch (error) {
    console.error('Save verification error:', error);
    alert('❌ Error saving verification');
  }
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

/**
 * Export search results to Excel
 */
async function exportToExcel() {
  if (!window.lastSearchResults || window.lastSearchResults.length === 0) {
    showMessage('No results to export', 'error');
    return;
  }
  
  const params = window.lastSearchParams || {};
  const month = document.getElementById('monthFilter').value;
  const sessionId = SessionManager.getSessionId();
  
  let filename = 'Accounts_Export_';
  if (params.searchBy === 'Booking Date' && params.dateFilter === 'range') {
    filename += params.fromDate + '_to_' + params.toDate;
  } else {
    filename += month;
  }
  filename += '.csv';
  
  console.log('Exporting', window.lastSearchResults.length, 'search results');
  
  // Fetch full records for each result
  const fullRecords = [];
  for (let i = 0; i < window.lastSearchResults.length; i++) {
    const receiptNo = window.lastSearchResults[i].receiptNo;
    try {
      const fullRecord = await API.getRecordByReceiptNo(sessionId, receiptNo);
      if (fullRecord.success && fullRecord.record) {
        fullRecords.push(fullRecord.record);
      }
    } catch (err) {
      console.log('Could not get full record for:', receiptNo);
    }
  }
  
  if (fullRecords.length > 0) {
    exportResultsToCSV(fullRecords, filename);
  } else {
    showMessage('No complete data to export', 'error');
  }
}

/**
 * Export card data (from dashboard cards)
 */
async function exportCardData(status) {
  const month = document.getElementById('monthFilter').value;
  const sessionId = SessionManager.getSessionId();
  
  console.log('Exporting card data for status:', status, 'month:', month);
  
  try {
    // Use getAccountsByStatus to get the records (same as card click)
    const response = await API.getAccountsByStatus(sessionId, month, status);
    
    if (response.success && response.results) {
      // Get full record data for each receipt
      const fullRecords = [];
      for (let i = 0; i < response.results.length; i++) {
        const receiptNo = response.results[i].receiptNo;
        try {
          const fullRecord = await API.getRecordByReceiptNo(sessionId, receiptNo);
          if (fullRecord.success && fullRecord.record) {
            fullRecords.push(fullRecord.record);
          }
        } catch (err) {
          console.log('Could not get full record for:', receiptNo);
        }
      }
      
      if (fullRecords.length > 0) {
        const filename = 'Accounts_' + status.toUpperCase() + '_' + month + '.csv';
        exportResultsToCSV(fullRecords, filename);
      } else {
        showMessage('No data to export', 'error');
      }
    } else {
      showMessage('Export failed: ' + (response.message || 'No records found'), 'error');
    }
  } catch (error) {
    console.error('Export error:', error);
    showMessage('Export failed', 'error');
  }
}

/**
 * Export results to CSV
 */
function exportResultsToCSV(results, filename) {
  if (!results || results.length === 0) {
    showMessage('No data to export', 'error');
    return;
  }
  
  // CSV header
  let csv = 'Receipt No,Executive Name,Booking Date,Customer Name,Mobile No,Model,Variant,Colour,Discount,Final Price,Financier Name,Delivery Date,Guard,Grip Cover,Seat Cover,Matin,Tank Cover,Handle Hook,Helmet,Rain Cover,Buzzer,Back Rest,Sales Remark,Accountant Name,Account Check,Account Remark,Receipt No 1,Receipt 1 Amount,Receipt No 2,Receipt 2 Amount,Receipt No 3,Receipt 3 Amount,Receipt No 4,Receipt 4 Amount,DO Number,Disbursed Amount\n';
  
  // CSV rows
  results.forEach(function(r) {
    csv += [
      r.receiptNo || '',
      r.executiveName || '',
      r.bookingDate || '',
      r.customerName || '',
      r.mobileNo || '',
      r.model || '',
      r.variant || '',
      r.colour || '',
      r.discount || '',
      r.finalPrice || '',
      r.financierName || '',
      r.deliveryDate || '',
      r.guard || '',
      r.gripcover || '',
      r.seatcover || '',
      r.matin || '',
      r.tankcover || '',
      r.handlehook || '',
      r.helmet || '',
      r.raincover || '',
      r.buzzer || '',
      r.backrest || '',
      r.salesRemark || '',
      r.accountantName || '',
      r.accountCheck || '',
      r.accountRemark || '',
      r.receiptNo1 || '',
      r.receipt1Amount || '',
      r.receiptNo2 || '',
      r.receipt2Amount || '',
      r.receiptNo3 || '',
      r.receipt3Amount || '',
      r.receiptNo4 || '',
      r.receipt4Amount || '',
      r.doNumber || '',
      r.disbursedAmount || ''
    ].map(function(field) {
      return '"' + String(field).replace(/"/g, '""') + '"';
    }).join(',') + '\n';
  });
  
  downloadCSV(csv, filename);
}

/**
 * Download CSV file
 */
function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showMessage('Downloaded: ' + filename, 'success');
}

// ==========================================
// ACCESSORIES PAGE LOGIC - COMPLETE
// ==========================================

// Model-Variant-Accessory Configuration
const MODEL_VARIANTS = {
  'Jupiter 110': {
    accessories: ['Guard', 'Grip Cover', 'Seat Cover', 'Matin', 'Helmet']
  },
  'Jupiter 125': {
    accessories: ['Guard', 'Grip Cover', 'Seat Cover', 'Matin', 'Helmet']
  },
  'Ntorq': {
    accessories: ['Guard', 'Grip Cover', 'Seat Cover', 'Matin', 'Helmet']
  },
  'Radeon': {
    accessories: ['Helmet']
  },
  'Raider': {
    accessories: ['Helmet']
  },
  'Ronin': {
    accessories: ['Helmet']
  },
  'Sport': {
    accessories: ['Helmet']
  },
  'Star': {
    accessories: ['Helmet']
  },
  'XL 100': {
    accessories: ['Grip Cover', 'Seat Cover', 'Tank Cover', 'Handle Hook', 'Helmet']
  },
  'Zest': {
    accessories: ['Guard', 'Grip Cover', 'Seat Cover', 'Matin', 'Helmet']
  },
  'iQube': {
    accessories: ['Guard', 'Grip Cover', 'Seat Cover', 'Matin', 'Helmet']
  },
  'Orbiter': {
    accessories: ['Guard', 'Grip Cover', 'Seat Cover', 'Matin', 'Helmet']
  },
  'Apache': {
    accessories: ['Helmet']
  }
};

// Additional pending items to add to all models (generic dealer-added items not tracked per-sale)
const ADDITIONAL_PENDING_ITEMS = ['Mirror', 'Side Stand', 'Center Stand'];

/**
 * Get model config - case insensitive lookup
 */
function getModelConfig(modelName) {
  if (!modelName) return null;
  
  // Try exact match first
  if (MODEL_VARIANTS[modelName]) {
    return MODEL_VARIANTS[modelName];
  }
  
  // Try case-insensitive match
  const modelLower = modelName.toLowerCase();
  for (const key in MODEL_VARIANTS) {
    if (key.toLowerCase() === modelLower) {
      return MODEL_VARIANTS[key];
    }
  }
  
  return null;
}

let currentDashboardData = null;
let currentFilterStatus = null;

// Inventory SKUs and locations (loaded at init for inline deduction)
let accInvSkus = [];
let accInvLocations = [];

// ==========================================
// PAGE INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
  
  // Check authentication
  const session = SessionManager.getSession();
  
  if (!session) {
    alert('Please login first');
    window.location.href = 'index.html';
    return;
  }
  
  const user = session.user;
  
  // Check role access (admin and accessories)
  if (user.role !== 'admin' && user.role !== 'accessories') {
    alert('Access denied. Only admin and accessories can access this page.');
    window.location.href = 'home.html';
    return;
  }
  
  
  // Initialize page
  initializeAccessoriesPage(user);

  // Setup event listeners
  setupEventListeners();

  // Load dashboard and inventory data in parallel
  populateMonthOptions();
  loadDashboard();
  loadInvData();
});

/**
 * Initialize accessories page
 */
function initializeAccessoriesPage(user) {
  document.getElementById('currentUser').textContent = user.name + ' (' + user.role + ')';
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Month selector change
  document.getElementById('monthSelector').addEventListener('change', loadDashboard);
  
  // Search by change
  document.getElementById('searchBy').addEventListener('change', handleSearchByChange);
  
  // Date filter change
  document.getElementById('dateFilter').addEventListener('change', handleDateFilterChange);
  
  // Enter key in search
  document.getElementById('searchValue').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') searchRecords();
  });
}

/**
 * Populate month dropdown options
 */
function populateMonthOptions() {
  const select = document.getElementById('monthSelector');
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  select.innerHTML = '';
  
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
  const month = document.getElementById('monthSelector').value;
  const sessionId = SessionManager.getSessionId();
  
  
  try {
    const response = await API.call('getAccessoryDashboardData', {
      sessionId: sessionId,
      month: month
    });
    
    if (response.success) {
      currentDashboardData = response.data;
      updateDashboardCards(response.data);
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showMessage('Failed to load dashboard', 'error');
  }
  
  // Load today's delivery count
  loadTodayDeliveryCount();
}

/**
 * Load Today's Delivery count
 */
async function loadTodayDeliveryCount() {
  const sessionId = SessionManager.getSessionId();
  const today = new Date();
  const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  try {
    const response = await API.call('searchAccessoryRecords', {
      sessionId: sessionId,
      searchBy: 'Delivery Date',
      searchValue: '',
      dateFilter: 'single',
      singleDate: todayString,
      fromDate: '',
      toDate: ''
    });
    
    if (response.success) {
      const count = response.results ? response.results.length : 0;
      document.getElementById('todayDeliveryCount').textContent = count;
      
      // Format date display
      const dateOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
      const dateString = today.toLocaleDateString('en-US', dateOptions);
      document.getElementById('todayDeliveryDate').textContent = dateString;
    }
  } catch (error) {
    console.error('Failed to load today\'s delivery count:', error);
    document.getElementById('todayDeliveryCount').textContent = '0';
  }
}

/**
 * Update dashboard cards
 */
function updateDashboardCards(data) {
  document.getElementById('yesCount').textContent = data.yes || 0;
  document.getElementById('accountsYesAccessoryBlankCount').textContent = data.accountsYesAccessoryBlank || 0;
  document.getElementById('blankCount').textContent = data.blank || 0;
  document.getElementById('partialCount').textContent = data.partial || 0;
  document.getElementById('totalCount').textContent = data.total || 0;
  
  // Clear active state from all cards including today delivery card
  document.querySelectorAll('.stat-card').forEach(function(card) {
    card.classList.remove('active');
  });
  const todayCard = document.getElementById('todayDeliveryCard');
  if (todayCard) {
    todayCard.classList.remove('active');
  }
  document.getElementById('exportBtn').style.display = 'none';
  currentFilterStatus = null;
}

/**
 * Filter by status (when clicking dashboard cards)
 */
async function filterByStatus(status) {
  currentFilterStatus = status;
  const month = document.getElementById('monthSelector').value;
  const sessionId = SessionManager.getSessionId();
  
  console.log('filterByStatus called - SessionId:', sessionId);
  
  if (!sessionId) {
    console.error('No session ID found!');
    showMessage('Session expired. Please refresh the page.', 'error');
    return;
  }
  
  // Update active card
  document.querySelectorAll('.stat-card').forEach(function(card) {
    card.classList.remove('active');
  });
  document.getElementById('todayDeliveryCard').classList.remove('active');
  
  if (status === 'yes') {
    document.querySelector('.complete-card').classList.add('active');
  } else if (status === 'accountsyes_accessoryblank') {
    document.querySelector('.accounts-verified-card').classList.add('active');
  } else if (status === 'blank') {
    document.querySelector('.not-started-card').classList.add('active');
  } else if (status === 'partial') {
    document.querySelector('.partial-card').classList.add('active');
  }
  
  
  try {
    const response = await API.call('getAccessoryFilteredData', {
      sessionId: sessionId,
      month: month,
      status: status
    });
    
    if (response.success) {
      displayResults(response.results);
      const statusText = status === 'yes' ? 'Complete' : 
                        status === 'accountsyes_accessoryblank' ? 'Account Check = Yes & Accessories = Blank' :
                        status === 'blank' ? 'Not Started' : 'Partially Complete';
      const title = statusText + ' (' + response.results.length + ' records)';
      showResultsSection(title);
      document.getElementById('exportBtn').style.display = 'inline-block';
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showMessage('Failed to filter records', 'error');
  }
}

/**
 * Filter by Today's Delivery
 */
async function filterByTodayDelivery() {
  const sessionId = SessionManager.getSessionId();
  const today = new Date();
  const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Update active card
  document.querySelectorAll('.stat-card').forEach(function(card) {
    card.classList.remove('active');
  });
  document.getElementById('todayDeliveryCard').classList.add('active');
  
  try {
    const response = await API.call('searchAccessoryRecords', {
      sessionId: sessionId,
      searchBy: 'Delivery Date',
      searchValue: '',
      dateFilter: 'single',
      singleDate: todayString,
      fromDate: '',
      toDate: ''
    });
    
    if (response.success) {
      displayResults(response.results);
      const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const dateString = today.toLocaleDateString('en-US', dateOptions);
      const title = `🛵 Today's Delivery - ${dateString} (${response.results.length} records)`;
      showResultsSection(title);
      document.getElementById('exportBtn').style.display = 'none';
      currentFilterStatus = 'today';
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showMessage('Failed to load today\'s deliveries', 'error');
  }
}

/**
 * Handle search by dropdown change
 */
function handleSearchByChange() {
  const searchBy = document.getElementById('searchBy').value;
  const valueSection = document.getElementById('searchValueSection');
  const dateFilterSection = document.getElementById('dateFilterSection');
  const singleDateSection = document.getElementById('singleDateSection');
  const dateRangeFromSection = document.getElementById('dateRangeFromSection');
  const dateRangeToSection = document.getElementById('dateRangeToSection');
  
  if (searchBy === 'Delivery Date') {
    valueSection.style.display = 'none';
    dateFilterSection.style.display = 'block';
  } else {
    valueSection.style.display = 'block';
    dateFilterSection.style.display = 'none';
    singleDateSection.style.display = 'none';
    dateRangeFromSection.style.display = 'none';
    dateRangeToSection.style.display = 'none';
  }
}

/**
 * Handle date filter change
 */
function handleDateFilterChange() {
  const dateFilter = document.getElementById('dateFilter').value;
  const singleDateSection = document.getElementById('singleDateSection');
  const dateRangeFromSection = document.getElementById('dateRangeFromSection');
  const dateRangeToSection = document.getElementById('dateRangeToSection');
  
  singleDateSection.style.display = dateFilter === 'single' ? 'block' : 'none';
  dateRangeFromSection.style.display = dateFilter === 'range' ? 'block' : 'none';
  dateRangeToSection.style.display = dateFilter === 'range' ? 'block' : 'none';
}

/**
 * Search records
 */
async function searchRecords() {
  const searchBy = document.getElementById('searchBy').value;
  
  if (!searchBy) {
    showMessage('Please select a search criteria', 'error');
    return;
  }
  
  const searchValue = document.getElementById('searchValue').value.trim();
  const dateFilter = document.getElementById('dateFilter').value;
  const singleDate = document.getElementById('singleDate').value;
  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;
  
  if (searchBy === 'Delivery Date' && !dateFilter) {
    showMessage('Please select a date filter', 'error');
    return;
  }
  
  if (searchBy !== 'Delivery Date' && !searchValue) {
    showMessage('Please enter a search value', 'error');
    return;
  }
  
  const sessionId = SessionManager.getSessionId();
  
  
  // Clear dashboard filter
  document.querySelectorAll('.stat-card').forEach(function(card) {
    card.classList.remove('active');
  });
  document.getElementById('exportBtn').style.display = 'none';
  currentFilterStatus = null;
  
  try {
    const response = await API.call('searchAccessoryRecords', {
      sessionId: sessionId,
      searchBy: searchBy,
      searchValue: searchValue,
      dateFilter: dateFilter,
      singleDate: singleDate,
      fromDate: fromDate,
      toDate: toDate
    });
    
    if (response.success) {
      displayResults(response.results);
      showResultsSection('Manual Search Results (' + response.results.length + ' records)');
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showMessage('Search failed. Please try again.', 'error');
  }
}

/**
 * Display search results
 */
function displayResults(results) {
  const tbody = document.getElementById('resultsBody');
  tbody.innerHTML = '';
  
  if (results.length > 0) {
  }
  
  if (results.length === 0) {
    const row = tbody.insertRow();
    const cell = row.insertCell(0);
    cell.colSpan = 6;
    cell.textContent = 'No records found';
    cell.style.textAlign = 'center';
    cell.style.padding = '20px';
    cell.style.color = '#999';
    return;
  }
  
  results.forEach(function(record) {
    const row = tbody.insertRow();
    row.style.cursor = 'pointer';
    row.onclick = function() { loadRecordDetails(record.row); };
    
    const accessoryStatus = record.accessoryFitted === 'Yes' ? 'Complete' :
                           record.accessoryFitted === 'No' ? 'Partially Complete' : 'Not Started';
    
    row.insertCell(0).textContent = record.receiptNo || '';
    row.insertCell(1).textContent = record.customerName || '';
    row.insertCell(2).textContent = record.mobileNo || '';
    row.insertCell(3).textContent = record.variant || record.variantName || record.model || '';  
    row.insertCell(4).textContent = record.deliveryDate || '';
    row.insertCell(5).textContent = accessoryStatus;
  });
}

/**
 * Show results section
 */
function showResultsSection(title) {
  document.getElementById('resultsTitle').textContent = title;
  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Load record details
 */
async function loadRecordDetails(row) {
  const sessionId = SessionManager.getSessionId();
  const user = SessionManager.getCurrentUser();
  
  
  try {
    const response = await API.call('getAccessoryRecordByRow', {
      sessionId: sessionId,
      row: row
    });
    
    if (response.success) {
      populateDetails(response.record, user);
      document.getElementById('detailsSection').style.display = 'block';
      document.getElementById('detailsSection').scrollIntoView({ behavior: 'smooth' });
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showMessage('Failed to load record details', 'error');
  }
}

/**
 * Populate record details
 */
function populateDetails(record, user) {
  
  // Store values
  document.getElementById('selectedRow').value = record.row;
  document.getElementById('currentModel').value = record.model || '';
  document.getElementById('accountCheckValue').value = record.accountCheck || '';
  document.getElementById('accessoryFittedValue').value = record.accessoryFitted || '';
  
  // View-only fields
  document.getElementById('detailReceiptNo').textContent = record.receiptNo || '-';
  document.getElementById('detailExecName').textContent = record.execName || record.executiveName || '-';
  document.getElementById('detailDate').textContent = record.date || record.bookingDate || '-';
  document.getElementById('detailCustomerName').textContent = record.customerName || '-';
  document.getElementById('detailMobileNo').textContent = record.mobileNo || '-';
  document.getElementById('detailModel').textContent = record.model || '-';
  document.getElementById('detailVariant').textContent = record.variant || '-';
  document.getElementById('detailColour').textContent = record.colour || '-';
  document.getElementById('detailEngineNo').textContent = record.engineNumber || '-';
  document.getElementById('detailFrameNo').textContent = record.frameNumber || '-';
  document.getElementById('detailDeliveryDate').textContent = record.deliveryDate || '-';
  document.getElementById('detailSalesRemark').textContent = record.salesRemark || '-';
  document.getElementById('detailAccountantName').textContent = record.accountantName || '-';
  document.getElementById('detailAccountCheck').textContent = record.accountCheck || '-';
  document.getElementById('detailAccountRemark').textContent = record.accountRemark || '-';
  
  // Accessories ordered
  const accessoriesContainer = document.getElementById('accessoriesOrdered');
  accessoriesContainer.innerHTML = '';
  
  
  const modelConfig = getModelConfig(record.model);
  
  if (modelConfig) {
    const accessories = modelConfig.accessories;
    
    accessories.forEach(function(accessory) {
      const detailItem = document.createElement('div');
      detailItem.className = 'detail-item';
      
      const label = document.createElement('span');
      label.className = 'detail-label';
      label.textContent = accessory + ':';
      
      const value = document.createElement('span');
      value.className = 'detail-value';
      
      // Check both camelCase and lowercase variants of field names
      if (accessory === 'Guard') {
        value.textContent = record.guard || '-';
      } else if (accessory === 'Grip Cover') {
        value.textContent = record.gripCover || record.gripcover || '-';
      } else if (accessory === 'Seat Cover') {
        value.textContent = record.seatCover || record.seatcover || '-';
      } else if (accessory === 'Matin') {
        value.textContent = record.matin || '-';
      } else if (accessory === 'Tank Cover') {
        value.textContent = record.tankCover || record.tankcover || '-';
      } else if (accessory === 'Handle Hook') {
        value.textContent = record.handleHook || record.handlehook || '-';
      } else if (accessory === 'Helmet') {
        value.textContent = record.helmet || '-';
      } else if (accessory === 'Rain Cover') {
        value.textContent = record.raincover || '-';
      } else if (accessory === 'Buzzer') {
        value.textContent = record.buzzer || '-';
      } else if (accessory === 'Back Rest') {
        value.textContent = record.backrest || '-';
      }
      
      
      detailItem.appendChild(label);
      detailItem.appendChild(value);
      accessoriesContainer.appendChild(detailItem);
    });
  } else {
    // If no model match, show a message
    accessoriesContainer.innerHTML = '<div style="color: #999; padding: 10px;">No accessories defined for this model: ' + (record.model || 'Unknown') + '</div>';
  }
  
  // Editable fields
  document.getElementById('accessoryCheckerName').value = record.accessoryCheckerName || user.name;
  document.getElementById('accessoryRemark').value = record.accessoryRemark || '';
  document.getElementById('accessoryReceipt1').value = record.accessoryReceipt1 || '';
  document.getElementById('accessoryExtra').value = record.accessoryExtra || '';
  
  // Pending items
  populatePendingItems(record);
  
  // Check edit mode - only based on Account Check
  const accountCheck = record.accountCheck || '';
  
  if (accountCheck !== 'Yes') {
    // BLOCKED - Account Check not Yes
    document.getElementById('viewOnlyBanner').style.display = 'none';
    document.getElementById('accountWarning').style.display = 'block';
    document.getElementById('limitedEditNote').style.display = 'none';
    setFieldsMode('blocked');
  } else {
    // FULL EDIT - Account Check = Yes
    // Allow editing regardless of Accessory Fitted status
    document.getElementById('viewOnlyBanner').style.display = 'none';
    document.getElementById('accountWarning').style.display = 'none';
    document.getElementById('limitedEditNote').style.display = 'none';
    setFieldsMode('full');
  }
}

// ==========================================
// INVENTORY HELPERS (for inline deduction)
// ==========================================

async function loadInvData() {
  try {
    const sessionId = SessionManager.getSessionId();
    const [skuRes, locRes] = await Promise.all([
      API.inventoryCall('getInvSkus',      { sessionId }),
      API.inventoryCall('getInvLocations', { sessionId })
    ]);
    if (skuRes.success)  accInvSkus       = skuRes.skus       || [];
    if (locRes.success)  accInvLocations  = locRes.locations  || [];
  } catch(e) { /* silently skip — inventory just won't populate */ }
}

function accSkuDisplayName(sku) {
  if (!sku) return '';
  return [sku.category, sku.type, sku.brand, sku.color].filter(Boolean).join(' / ');
}

// value format: "SKUID — Category / Type / Brand / Color"  (searchable by SKU ID or name)
function accSkuDatalistValue(s) {
  return s.skuId + ' — ' + accSkuDisplayName(s);
}

function buildAccSkuDatalistOptions(filterLabel) {
  const filtered = filterLabel
    ? accInvSkus.filter(s =>
        (s.category || '').toLowerCase() === filterLabel.toLowerCase() ||
        (s.type     || '').toLowerCase() === filterLabel.toLowerCase()
      )
    : accInvSkus;
  // Fall back to all SKUs if no match for the filter
  const source = (filtered.length === 0 && filterLabel) ? accInvSkus : filtered;
  return source.map(s =>
    `<option value="${accSkuDatalistValue(s)}" data-sku-id="${s.skuId}"></option>`
  ).join('');
}

function resolveAccSkuFromSearch(inputEl, datalistId, hiddenId) {
  const val = inputEl.value;
  let foundId = '';
  document.querySelectorAll('#' + datalistId + ' option').forEach(function(opt) {
    if (opt.value === val) foundId = opt.dataset.skuId;
  });
  document.getElementById(hiddenId).value = foundId;
}

function onPendingItemChange(safeName) {
  const radioName = 'pending_' + safeName;
  const selected = document.querySelector('input[name="' + radioName + '"]:checked');
  const itemDiv  = document.getElementById('pi-' + safeName);
  const invRow   = document.getElementById('pi-inv-' + safeName);
  if (!itemDiv) return;
  itemDiv.classList.remove('status-pending', 'status-refused', 'status-issued');
  if (selected) {
    if (selected.value === 'pending') {
      itemDiv.classList.add('status-pending');
    } else if (selected.value === 'refused') {
      itemDiv.classList.add('status-refused');
    } else if (selected.value === 'issued') {
      itemDiv.classList.add('status-issued');
    }
    if (invRow) {
      invRow.classList.toggle('show', selected.value === 'issued');
    }
  }
}

/**
 * Populate pending items with radio buttons for Pending/Customer Refused
 * ONLY show accessories that were ordered (marked as "Yes")
 */
function populatePendingItems(record) {
  const pendingContainer = document.getElementById('pendingCheckboxes');
  pendingContainer.innerHTML = '';
  
  
  const pendingItemsStr = record.pending || '';
  const refusedItemsStr = record.customerRefused || ''; 
  
  const modelConfig = getModelConfig(record.model);
  
  if (modelConfig) {
    const accessories = modelConfig.accessories;
    const allPendingOptions = accessories.concat(ADDITIONAL_PENDING_ITEMS);
    
    
    // Filter to only show accessories that were ordered (value = "Yes")
    const orderedAccessories = [];
    
    allPendingOptions.forEach(function(accessory) {
      let isOrdered = false;
      
      // Check if this accessory was ordered (value = "Yes")
      if (accessory === 'Guard') {
        isOrdered = record.guard === 'Yes';
      } else if (accessory === 'Grip Cover') {
        isOrdered = (record.gripCover === 'Yes' || record.gripcover === 'Yes');
      } else if (accessory === 'Seat Cover') {
        isOrdered = (record.seatCover === 'Yes' || record.seatcover === 'Yes');
      } else if (accessory === 'Matin') {
        isOrdered = record.matin === 'Yes';
      } else if (accessory === 'Tank Cover') {
        isOrdered = (record.tankCover === 'Yes' || record.tankcover === 'Yes');
      } else if (accessory === 'Handle Hook') {
        isOrdered = (record.handleHook === 'Yes' || record.handlehook === 'Yes');
      } else if (accessory === 'Helmet') {
        isOrdered = record.helmet === 'Yes';
      } else if (accessory === 'Rain Cover') {
        isOrdered = record.raincover === 'Yes';
      } else if (accessory === 'Buzzer') {
        isOrdered = record.buzzer === 'Yes';
      } else if (accessory === 'Back Rest') {
        isOrdered = record.backrest === 'Yes';
      } else {
        // For any other ADDITIONAL_PENDING_ITEMS
        isOrdered = true;
      }
      
      if (isOrdered) {
        orderedAccessories.push(accessory);
      }
    });
    
    
    if (orderedAccessories.length === 0) {
      pendingContainer.innerHTML = '<div style="color: #999; padding: 10px; text-align: center;">No accessories were ordered for this sale</div>';
      return;
    }
    
    orderedAccessories.forEach(function(accessory) {
      const safeName  = accessory.toLowerCase().replace(/ /g, '');
      const radioName = 'pending_' + safeName;
      const isPending = pendingItemsStr.indexOf(accessory) !== -1;
      const isRefused = refusedItemsStr.indexOf(accessory) !== -1;

      // Pre-build inventory row elements
      const dlId   = 'acc-sku-dl-'  + safeName;
      const valId  = 'acc-sku-val-' + safeName;
      const locId  = 'acc-loc-'     + safeName;
      const qtyId  = 'acc-qty-'     + safeName;
      const invRowId = 'pi-inv-'    + safeName;

      const storeLocation = accInvLocations.find(function(l) { return l.name.toLowerCase() === 'store'; });
      const locOptions = accInvLocations.map(function(l) {
        const sel = (storeLocation && l.locationId === storeLocation.locationId) ? ' selected' : '';
        return '<option value="' + l.locationId + '"' + sel + '>' + l.name + '</option>';
      }).join('');
      const dlOptions = buildAccSkuDatalistOptions(accessory);

      // Status class
      let statusClass = isPending ? 'status-pending' : (isRefused ? 'status-refused' : '');

      const itemDiv = document.createElement('div');
      itemDiv.className = 'pending-item ' + statusClass;
      itemDiv.id = 'pi-' + safeName;
      itemDiv.innerHTML = `
        <div class="pending-item-top">
          <span class="pending-item-name">${accessory}</span>
          <div class="pending-item-options">
            <label><input type="radio" name="${radioName}" value="none" ${!isPending && !isRefused ? 'checked' : ''}
              onchange="onPendingItemChange('${safeName}')"> None</label>
            <label><input type="radio" name="${radioName}" value="pending" ${isPending ? 'checked' : ''}
              onchange="onPendingItemChange('${safeName}')"> 🔔 Pending</label>
            <label><input type="radio" name="${radioName}" value="refused" ${isRefused ? 'checked' : ''}
              onchange="onPendingItemChange('${safeName}')"> ❌ Refused</label>
            <label><input type="radio" name="${radioName}" value="issued"
              onchange="onPendingItemChange('${safeName}')"> 📦 Issue from Stock</label>
          </div>
        </div>
        <div class="pending-inv-row" id="${invRowId}">
          <div style="flex:2; min-width:180px;">
            <label style="font-size:11px; font-weight:600; color:#555; display:block; margin-bottom:3px;">${accessory} SKU</label>
            <input type="text" list="${dlId}" placeholder="Type to search SKU…"
              style="width:100%; padding:7px; border:2px solid #17a2b8; border-radius:6px; font-size:13px; box-sizing:border-box;"
              oninput="resolveAccSkuFromSearch(this,'${dlId}','${valId}')">
            <datalist id="${dlId}">${dlOptions}</datalist>
            <input type="hidden" id="${valId}" data-role="acc-sku">
          </div>
          <div style="flex:1; min-width:120px;">
            <label style="font-size:11px; font-weight:600; color:#555; display:block; margin-bottom:3px;">From Location</label>
            <select id="${locId}"
              style="width:100%; padding:7px; border:2px solid #17a2b8; border-radius:6px; font-size:13px;">
              <option value="">-- Location --</option>${locOptions}
            </select>
          </div>
          <div style="flex:0; min-width:80px;">
            <label style="font-size:11px; font-weight:600; color:#555; display:block; margin-bottom:3px;">Qty</label>
            <input type="number" id="${qtyId}" min="1" value="1"
              style="width:100%; padding:7px; border:2px solid #17a2b8; border-radius:6px; font-size:13px;">
          </div>
        </div>
      `;
      pendingContainer.appendChild(itemDiv);
    });
  } else {
    pendingContainer.innerHTML = '<div style="color: #999; padding: 10px;">Model not found in configuration</div>';
  }
}

/**
 * Set fields mode (blocked, full)
 */
function setFieldsMode(mode) {
  const fields = ['accessoryRemark'];
  const alwaysEditableFields = ['accessoryReceipt1', 'accessoryExtra'];
  const updateBtn = document.getElementById('updateBtn');
  
  if (mode === 'blocked') {
    // BLOCKED MODE: Account Check ≠ Yes
    fields.forEach(function(id) {
      document.getElementById(id).disabled = true;
    });
    alwaysEditableFields.forEach(function(id) {
      document.getElementById(id).disabled = true;
    });
    
    // Disable all pending radio buttons
    document.querySelectorAll('#pendingCheckboxes input[type="radio"]').forEach(function(radio) {
      radio.disabled = true;
    });
    
    updateBtn.disabled = true;
    updateBtn.textContent = '🚫 Blocked - Account Check Required';
    updateBtn.style.background = '#dc3545';
    
  } else {
    // FULL EDIT MODE: Account Check = Yes
    // Allow editing regardless of Accessory Fitted status
    fields.forEach(function(id) {
      document.getElementById(id).disabled = false;
    });
    alwaysEditableFields.forEach(function(id) {
      document.getElementById(id).disabled = false;
    });
    
    // Enable all pending radio buttons
    document.querySelectorAll('#pendingCheckboxes input[type="radio"]').forEach(function(radio) {
      radio.disabled = false;
    });
    
    updateBtn.disabled = false;
    updateBtn.textContent = '💾 Update';
    updateBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }
}

/**
 * Update record
 */
async function updateRecord() {
  const row = document.getElementById('selectedRow').value;
  const accountCheck = document.getElementById('accountCheckValue').value;
  
  if (!row) {
    showMessage('Please select a record first', 'error');
    return;
  }
  
  // Check Account Check
  if (accountCheck !== 'Yes') {
    showMessage('🚫 BLOCKED: Account Check must be "Yes" to update accessory information!', 'error');
    return;
  }
  
  // Validate mandatory fields
  const checkerName = document.getElementById('accessoryCheckerName').value.trim();
  
  if (!checkerName) {
    showMessage('⚠️ Accessory Checker Name is mandatory!', 'error');
    document.getElementById('accessoryCheckerName').focus();
    return;
  }
  
  // Get pending and customer refused items
  const model = document.getElementById('currentModel').value;
  const pendingItems = [];
  const refusedItems = [];
  
  const modelConfig = getModelConfig(model);
  
  // Collect inventory items to issue (accessory = 'issued' radio)
  const issuedItems = []; // { skuId, qty, locationId, accessoryName }

  if (modelConfig) {
    const accessories = modelConfig.accessories;
    const allPendingOptions = accessories.concat(ADDITIONAL_PENDING_ITEMS);

    allPendingOptions.forEach(function(accessory) {
      const safeName  = accessory.toLowerCase().replace(/ /g, '');
      const radioName = 'pending_' + safeName;
      const selectedRadio = document.querySelector('input[name="' + radioName + '"]:checked');

      if (selectedRadio) {
        if (selectedRadio.value === 'pending') {
          pendingItems.push(accessory);
        } else if (selectedRadio.value === 'refused') {
          refusedItems.push(accessory);
        } else if (selectedRadio.value === 'issued') {
          // Collect inventory deduction data
          const skuId     = (document.getElementById('acc-sku-val-' + safeName) || {}).value || '';
          const locId     = (document.getElementById('acc-loc-'     + safeName) || {}).value || '';
          const qty       = parseInt((document.getElementById('acc-qty-' + safeName) || {}).value) || 1;
          if (!skuId) {
            showMessage('Select a SKU for ' + accessory + ' (Issue from Stock)', 'error');
            throw new Error('missing_sku');
          }
          if (!locId) {
            showMessage('Select a location for ' + accessory + ' (Issue from Stock)', 'error');
            throw new Error('missing_location');
          }
          issuedItems.push({ skuId, qty, locationId: locId, accessoryName: accessory });
          // "Issued" counts as done — not pending, not refused
        }
      }
    });
  }

  const pendingString = pendingItems.join(', ');
  const refusedString = refusedItems.join(', ');

  // AUTO-DETERMINE FITTED STATUS based on pending/refused items
  // PRIORITY: Pending > Refused > None/Issued
  let fittedStatus;
  if (pendingItems.length > 0) {
    fittedStatus = 'No';
  } else if (refusedItems.length > 0 || issuedItems.length > 0) {
    fittedStatus = 'Yes';
  } else {
    fittedStatus = 'Yes';
  }

  const sessionId = SessionManager.getSessionId();
  const updateBtn = document.getElementById('updateBtn');
  updateBtn.disabled = true;
  updateBtn.textContent = '⏳ Updating...';

  try {
    const response = await API.call('updateAccessoryData', {
      sessionId: sessionId,
      row: row,
      checkerName: checkerName,
      fitted: fittedStatus,
      remark: document.getElementById('accessoryRemark').value,
      pending: pendingString,
      customerRefused: refusedString,
      receipt1: document.getElementById('accessoryReceipt1').value,
      extra: document.getElementById('accessoryExtra').value
    });

    if (!response.success) {
      showMessage('❌ ' + response.message, 'error');
      return;
    }

    // Deduct inventory for "issued" items (if any)
    if (issuedItems.length > 0) {
      const receiptNo    = document.getElementById('detailReceiptNo').textContent.trim();
      const customerName = document.getElementById('detailCustomerName').textContent.trim();
      const executiveName = document.getElementById('detailExecName').textContent.trim();
      const deliveryDate = document.getElementById('detailDeliveryDate').textContent.trim();

      const invRes = await API.inventoryCall('invIssueToBooking', {
        sessionId: sessionId,
        receiptNo,
        customerName,
        executiveName,
        deliveryDate,
        items: JSON.stringify(issuedItems),
        remarks: 'Issued via Accessories page'
      });

      if (!invRes.success) {
        showMessage('✅ Record saved, but inventory deduction failed: ' + (invRes.message || 'Unknown error'), 'error');
        loadDashboard();
        return;
      }
      showMessage('✅ Record saved & inventory deducted for: ' + issuedItems.map(function(i) { return i.accessoryName; }).join(', '), 'success');
    } else {
      showMessage('✅ ' + response.message, 'success');
    }

    loadDashboard();
    setTimeout(closeDetails, 2000);
  } catch (error) {
    if (error.message !== 'missing_sku' && error.message !== 'missing_location') {
      showMessage('❌ Update failed. Please try again.', 'error');
    }
  } finally {
    updateBtn.disabled = false;
    updateBtn.textContent = '💾 Update';
  }
}

/**
 * Export to Excel
 */
async function exportToExcel() {
  if (!currentFilterStatus) {
    showMessage('Please filter by a status first', 'error');
    return;
  }
  
  const month = document.getElementById('monthSelector').value;
  const sessionId = SessionManager.getSessionId();
  
  showMessage('Generating Excel file...', 'success');
  
  try {
    const response = await API.call('exportAccessoryToExcel', {
      sessionId: sessionId,
      month: month,
      status: currentFilterStatus
    });
    
    if (response.success) {
      showMessage('✅ Excel file created! Opening download...', 'success');
      window.open(response.fileUrl, '_blank');
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showMessage('Export failed', 'error');
  }
}

/**
 * Close details section
 */
function closeDetails() {
  document.getElementById('detailsSection').style.display = 'none';
  document.getElementById('viewOnlyBanner').style.display = 'none';
  document.getElementById('accountWarning').style.display = 'none';
  document.getElementById('limitedEditNote').style.display = 'none';
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
  const msg = document.getElementById('statusMessage');
  msg.textContent = text;
  msg.className = 'message ' + type;
  msg.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  setTimeout(function() {
    msg.classList.add('hidden');
  }, 5000);
}

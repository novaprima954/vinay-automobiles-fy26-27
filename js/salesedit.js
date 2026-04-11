// ==========================================
// SALES EDIT - COMPLETE CLEAN VERSION
// ==========================================

// PriceMaster cache
let cachedModels = null;
let variantCache = {};
let priceMasterCache = {};

// ==========================================
// PAGE INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async function() {
  console.log('=== SALES EDIT PAGE ===');
  
  // Check authentication
  const session = SessionManager.getSession();
  if (!session) {
    alert('Please login first');
    window.location.href = 'index.html';
    return;
  }
  
  const user = session.user;
  console.log('✅ Logged in as:', user.username, '(' + user.role + ')');
  
  // Check access (sales + admin only)
  if (user.role !== 'admin' && user.role !== 'sales') {
    alert('Access denied. Only admin and sales can access this page.');
    window.location.href = 'home.html';
    return;
  }
  
  // Display current user
  const currentUserDisplay = document.getElementById('currentUser');
  if (currentUserDisplay) {
    currentUserDisplay.textContent = user.username + ' (' + user.role + ')';
  }
  
  // Setup event listeners
  setupEventListeners();

  // Populate month options and load dashboard
  populateAcctMonthOptions();
  loadAccountCheckDashboard();
  loadExecutiveNames();

  // Load models from PriceMaster (non-blocking)
  loadModelsForEdit().catch(function(err) {
    console.error('Model loading error:', err);
  });
});

// ==========================================
// EVENT LISTENERS SETUP
// ==========================================

function setupEventListeners() {
  // Search by dropdown change
  const searchBySelect = document.getElementById('searchBy');
  if (searchBySelect) {
    searchBySelect.addEventListener('change', handleSearchByChange);
  }
  
  // Search button
  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', searchRecords);
  }
  
  // Enter key in search
  const searchValue = document.getElementById('searchValue');
  if (searchValue) {
    searchValue.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') searchRecords();
    });
  }
  
  // Model change
  const modelSelect = document.getElementById('model');
  if (modelSelect) {
    modelSelect.addEventListener('change', handleModelChange);
  }
  
  // Variant change
  const variantSelect = document.getElementById('variant');
  if (variantSelect) {
    variantSelect.addEventListener('change', handleVariantChange);
  }
  
  // Financier change
  const financierSelect = document.getElementById('financierName');
  if (financierSelect) {
    financierSelect.addEventListener('change', handleFinancierChange);
  }
  
  // Calculate totals
  ['receipt2Amount', 'receipt3Amount', 'receipt4Amount', 'disbursedAmount', 'finalPrice'].forEach(function(id) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('input', calculateTotals);
    }
  });
  
  // Form submit
  const editForm = document.getElementById('editForm');
  if (editForm) {
    editForm.addEventListener('submit', handleUpdate);
  }
  
  // Cancel button
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      const detailsSection = document.getElementById('detailsSection');
      if (detailsSection) {
        detailsSection.style.display = 'none';
      }
    });
  }
}

// ==========================================
// PRICEMASTER FUNCTIONS
// ==========================================

async function loadModelsForEdit() {
  const modelSelect = document.getElementById('model');
  if (!modelSelect) return;
  
  try {
    const response = await API.getPriceMasterModels();
    
    if (response.success && response.models) {
      cachedModels = response.models;
      
      modelSelect.innerHTML = '<option value="">-- Select Model --</option>';
      response.models.forEach(function(model) {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
      });
      
      console.log('✅ Loaded', response.models.length, 'models from PriceMaster');
    }
  } catch (error) {
    console.error('❌ Load models error:', error);
  }
}

async function loadVariantsForModel(model) {
  if (!model) return [];
  
  if (variantCache[model]) {
    return variantCache[model];
  }
  
  try {
    const response = await API.getPriceMasterVariants(model);
    
    if (response.success && response.variants) {
      variantCache[model] = response.variants;
      return response.variants;
    }
  } catch (error) {
    console.error('❌ Load variants error:', error);
  }
  
  return [];
}

async function getPriceMasterDetails(model, variant) {
  if (!model || !variant) return null;
  
  const cacheKey = model + '|' + variant;
  
  if (priceMasterCache[cacheKey]) {
    return priceMasterCache[cacheKey];
  }
  
  try {
    const response = await API.getPriceMasterDetails(model, variant);
    
    if (response.success && response.details) {
      priceMasterCache[cacheKey] = response.details;
      return response.details;
    }
  } catch (error) {
    console.error('❌ Load PriceMaster error:', error);
  }
  
  return null;
}

// ==========================================
// SEARCH FUNCTIONALITY
// ==========================================

function handleSearchByChange() {
  const searchBy = document.getElementById('searchBy').value;
  const searchValueInput = document.getElementById('searchValue');
  const executiveDropdown = document.getElementById('executiveDropdown');
  
  if (searchBy === 'Executive Name') {
    if (searchValueInput) searchValueInput.style.display = 'none';
    if (executiveDropdown) executiveDropdown.style.display = 'block';
  } else {
    if (searchValueInput) searchValueInput.style.display = 'block';
    if (executiveDropdown) executiveDropdown.style.display = 'none';
  }
}

async function searchRecords() {
  const searchBy = document.getElementById('searchBy').value;
  
  if (!searchBy) {
    showMessage('Please select a search field', 'error');
    return;
  }
  
  let searchValue;
  if (searchBy === 'Executive Name') {
    searchValue = document.getElementById('executiveDropdown').value;
  } else {
    searchValue = document.getElementById('searchValue').value.trim();
  }
  
  if (!searchValue) {
    showMessage('Please enter a search value', 'error');
    return;
  }
  
  const session = SessionManager.getSession();
  const user = session.user;
  
  console.log('🔍 Searching:', searchBy, '=', searchValue);
  
  try {
    // Use searchRecordsForEdit - returns ALL fields and is much faster
    const response = await API.call('searchRecordsForEdit', {
      sessionId: SessionManager.getSessionId(),
      searchBy: searchBy,
      searchValue: searchValue,
      userRole: user.role,
      userName: user.name
    });
    
    console.log('📊 Search results:', response.results ? response.results.length : 0);
    
    if (response.success && response.results) {
      // Already filtered by backend - no need to filter Account Check
      console.log('✅ Editable records:', response.results.length);
      
      if (response.results.length > 0) {
        displaySearchResults(response.results);
        showMessage('Found ' + response.results.length + ' editable record(s)', 'success');
      } else {
        showMessage('No editable records found', 'error');
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) resultsSection.style.display = 'none';
      }
    } else {
      showMessage('No records found', 'error');
      const resultsSection = document.getElementById('resultsSection');
      if (resultsSection) resultsSection.style.display = 'none';
    }
  } catch (error) {
    console.error('❌ Search error:', error);
    showMessage('Error searching records', 'error');
  }
}

function displaySearchResults(results) {
  window._lastSearchResults = results;
  const tbody = document.getElementById('resultsBody');
  const resultsSection = document.getElementById('resultsSection');

  if (!tbody) return;

  tbody.innerHTML = '';
  
  results.forEach(function(record) {
    const row = tbody.insertRow();
    row.style.cursor = 'pointer';
    row.onclick = function() { loadRecord(record); };
    
    row.innerHTML = 
      '<td>' + (record.receiptNo || '') + '</td>' +
      '<td>' + (record.customerName || '') + '</td>' +
      '<td>' + (record.mobileNo || '') + '</td>' +
      '<td>' + (record.model || '') + '</td>' +
      '<td>' + (record.bookingDate || record.date || '') + '</td>' +
      '<td>' + (record.accountCheck || 'Blank') + '</td>';
  });
  
  if (resultsSection) {
    resultsSection.style.display = 'block';
  }
}

// ==========================================
// LOAD RECORD
// ==========================================

async function loadRecord(record) {
  console.log('📝 Loading record:', record);
  
  // Store selected receipt number
  const selectedReceiptNoInput = document.getElementById('selectedReceiptNo');
  if (selectedReceiptNoInput) {
    selectedReceiptNoInput.value = record.receiptNo;
  }
  
  // Store original record
  window.currentRecord = record;
  window.currentFullRecord = record;
  
  // PROTECTED FIELDS
  setTextContent('protectedReceiptNo', record.receiptNo || '-');
  setTextContent('protectedExecutiveName', record.executiveName || record.executive || '-');
  
  // Format booking date properly
  let bookingDateDisplay = '-';
  if (record.bookingDate) {
    bookingDateDisplay = record.bookingDate;
  } else if (record.date) {
    bookingDateDisplay = record.date;
  }
  console.log('📅 Booking date:', {raw: record.bookingDate, date: record.date, display: bookingDateDisplay});
  setTextContent('protectedBookingDate', bookingDateDisplay);
  
  setTextContent('protectedReceiptNo1', record.receiptNo1 || '-');
  setTextContent('protectedReceipt1Amount', record.receipt1Amount ? '₹' + record.receipt1Amount : '-');
  
  // EDITABLE FIELDS - From record
  setValue('customerName', record.customerName || '');
  setValue('mobileNo', record.mobileNo || '');
  setValue('model', record.model || '');
  
  // Load variants for model
  if (record.model) {
    const variants = await loadVariantsForModel(record.model);
    updateVariantDropdown(variants);
    
    setValue('variant', record.variant || '');
    
    // Store the full record globally for accessory rendering
    window.currentFullRecord = record;
    
    // Render accessories with saved values
    if (record.variant) {
      const pmDetails = await getPriceMasterDetails(record.model, record.variant);
      if (pmDetails) {
        console.log('📦 Full record data:', {
          helmet: record.helmet,
          guard: record.guard,
          gripcover: record.gripcover,
          seatcover: record.seatcover
        });
        renderAccessoriesWithSavedValues(pmDetails, record);
      }
    }
  }
  
  // Other editable fields (may be blank from search results)
  setValue('colour', record.colour || '');
  setValue('discount', record.discount || '');
  setValue('finalPrice', record.finalPrice || '');
  setValue('deliveryDate', record.deliveryDate || '');
  setValue('salesRemark', record.salesRemark || '');
  setValue('receiptNo2', record.receiptNo2 || '');
  setValue('receipt2Amount', record.receipt2Amount || '');
  setValue('receiptNo3', record.receiptNo3 || '');
  setValue('receipt3Amount', record.receipt3Amount || '');
  setValue('receiptNo4', record.receiptNo4 || '');
  setValue('receipt4Amount', record.receipt4Amount || '');
  setValue('doNumber', record.doNumber || '');
  setValue('disbursedAmount', record.disbursedAmount || '');
  
  // Store helmet value temporarily (for accessory rendering)
  window.savedHelmetValue = record.helmet || '';
  
  // Financier
  const standardFinanciers = ['Cash', 'TVS Credit', 'Shriram Finance', 'Hinduja Finance', 
                              'Janan SFB', 'TATA Capital', 'Indusind Bank', 'Berar Finance', 'IDFC'];
  
  const financierSelect = document.getElementById('financierName');
  const otherFinancierInput = document.getElementById('otherFinancierInput');
  
  if (financierSelect && record.financierName) {
    if (standardFinanciers.includes(record.financierName)) {
      financierSelect.value = record.financierName;
      if (otherFinancierInput) otherFinancierInput.style.display = 'none';
    } else {
      financierSelect.value = 'Other';
      if (otherFinancierInput) {
        otherFinancierInput.style.display = 'block';
        otherFinancierInput.value = record.financierName;
      }
    }
  }
  
  // Calculate totals
  if (typeof calculateTotals === 'function') {
    calculateTotals();
  }
  
  // Show details section
  const detailsSection = document.getElementById('detailsSection');
  if (detailsSection) {
    detailsSection.style.display = 'block';
    detailsSection.scrollIntoView({ behavior: 'smooth' });
  }
  
  console.log('✅ Record loaded');
}

// ==========================================
// MODEL/VARIANT HANDLERS
// ==========================================

async function handleModelChange() {
  const model = document.getElementById('model').value;
  
  if (model) {
    const variants = await loadVariantsForModel(model);
    updateVariantDropdown(variants);
  } else {
    updateVariantDropdown([]);
  }
  
  // Clear variant and accessories
  setValue('variant', '');
  const accessoryFields = document.getElementById('accessoryFields');
  if (accessoryFields) accessoryFields.innerHTML = '';
}

async function handleVariantChange() {
  const model = document.getElementById('model').value;
  const variant = document.getElementById('variant').value;
  
  if (model && variant) {
    const pmDetails = await getPriceMasterDetails(model, variant);
    if (pmDetails) {
      renderAccessoriesBlank(pmDetails);
    }
  }
}

function updateVariantDropdown(variants) {
  const variantSelect = document.getElementById('variant');
  if (!variantSelect) return;
  
  variantSelect.innerHTML = '<option value="">-- Select Variant --</option>';
  variants.forEach(function(variant) {
    const option = document.createElement('option');
    option.value = variant;
    option.textContent = variant;
    variantSelect.appendChild(option);
  });
}

// ==========================================
// ACCESSORY RENDERING
// ==========================================

function renderAccessoriesWithSavedValues(pmDetails, savedRecord) {
  const container = document.getElementById('accessoryFields');
  if (!container || !pmDetails) return;
  
  console.log('🎨 Rendering accessories with saved values');
  console.log('   Saved record:', savedRecord);
  console.log('   Helmet from record:', savedRecord.helmet);
  console.log('   Helmet from window:', window.savedHelmetValue);
  
  container.innerHTML = '';
  
  const accessories = [
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
  
  accessories.forEach(function(acc) {
    if (pmDetails[acc.priceKey]) {
      const price = parseFloat(pmDetails[acc.priceKey]) || 0;
      const savedValue = savedRecord[acc.id] || '';
      
      const formGroup = document.createElement('div');
      formGroup.className = 'form-group';
      
      const label = document.createElement('label');
      label.innerHTML = acc.name + ' (₹' + price.toLocaleString() + ')';
      
      const select = document.createElement('select');
      select.id = acc.id;
      select.className = 'editable-highlight';
      select.innerHTML = 
        '<option value="">-- Select --</option>' +
        '<option value="Yes"' + (savedValue === 'Yes' ? ' selected' : '') + '>Yes</option>' +
        '<option value="No"' + (savedValue === 'No' ? ' selected' : '') + '>No</option>';
      
      formGroup.appendChild(label);
      formGroup.appendChild(select);
      container.appendChild(formGroup);
    }
  });
  
  // Helmet
  if (pmDetails.helmetPrice) {
    const price = parseFloat(pmDetails.helmetPrice) || 0;
    const savedHelmet = savedRecord.helmet || window.savedHelmetValue || '';
    
    // Convert to string for comparison
    const helmetValue = String(savedHelmet);
    
    console.log('🪖 Setting helmet dropdown:', {saved: savedHelmet, string: helmetValue});
    
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    
    const label = document.createElement('label');
    label.innerHTML = 'Helmet (₹' + price.toLocaleString() + ')';
    
    const select = document.createElement('select');
    select.id = 'helmet';
    select.className = 'editable-highlight';
    select.innerHTML = 
      '<option value="">-- Select --</option>' +
      '<option value="No"' + (helmetValue === 'No' ? ' selected' : '') + '>No</option>' +
      '<option value="1"' + (helmetValue === '1' || helmetValue === 1 ? ' selected' : '') + '>1</option>' +
      '<option value="2"' + (helmetValue === '2' || helmetValue === 2 ? ' selected' : '') + '>2</option>';
    
    formGroup.appendChild(label);
    formGroup.appendChild(select);
    container.appendChild(formGroup);
  }
}

function renderAccessoriesBlank(pmDetails) {
  renderAccessoriesWithSavedValues(pmDetails, {});
}

// ==========================================
// FINANCIER HANDLER
// ==========================================

function handleFinancierChange() {
  const financierSelect = document.getElementById('financierName');
  const otherFinancierInput = document.getElementById('otherFinancierInput');
  
  if (financierSelect && otherFinancierInput) {
    if (financierSelect.value === 'Other') {
      otherFinancierInput.style.display = 'block';
    } else {
      otherFinancierInput.style.display = 'none';
    }
  }
}

// ==========================================
// CALCULATE TOTALS
// ==========================================

function calculateTotals() {
  const r1Text = (document.getElementById('protectedReceipt1Amount') || {}).textContent || '₹0';
  const r1 = parseFloat(r1Text.replace('₹', '').replace(/,/g, '').trim()) || 0;
  const r2 = parseFloat((document.getElementById('receipt2Amount') || {}).value) || 0;
  const r3 = parseFloat((document.getElementById('receipt3Amount') || {}).value) || 0;
  const r4 = parseFloat((document.getElementById('receipt4Amount') || {}).value) || 0;
  const disbursed = parseFloat((document.getElementById('disbursedAmount') || {}).value) || 0;
  
  const cashTotal = r1 + r2 + r3 + r4;
  const grandTotal = cashTotal + disbursed;
  
  console.log('💰 Totals:', {r1, r2, r3, r4, disbursed, cashTotal, grandTotal});
  
  // Update display elements (correct IDs from HTML)
  setTextContent('cashTotalDisplay', '₹' + cashTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
  setTextContent('disbursedDisplay', '₹' + disbursed.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
  setTextContent('totalDisplay', '₹' + grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
  
  // Store in hidden fields for form submission
  if (!document.getElementById('hiddenCashTotal')) {
    const cashInput = document.createElement('input');
    cashInput.type = 'hidden';
    cashInput.id = 'hiddenCashTotal';
    document.getElementById('editForm').appendChild(cashInput);
  }
  if (!document.getElementById('hiddenGrandTotal')) {
    const grandInput = document.createElement('input');
    grandInput.type = 'hidden';
    grandInput.id = 'hiddenGrandTotal';
    document.getElementById('editForm').appendChild(grandInput);
  }
  
  document.getElementById('hiddenCashTotal').value = cashTotal.toFixed(2);
  document.getElementById('hiddenGrandTotal').value = grandTotal.toFixed(2);
  
  console.log('✅ Updated totals display');
}

// ==========================================
// UPDATE HANDLER
// ==========================================

async function handleUpdate(e) {
  e.preventDefault();
  
  const receiptNo = document.getElementById('selectedReceiptNo').value;
  if (!receiptNo) {
    alert('No record selected');
    return;
  }
  
  // Get financier
  let financierName = document.getElementById('financierName').value;
  if (financierName === 'Other') {
    financierName = document.getElementById('otherFinancierInput').value.trim();
    if (!financierName) {
      alert('Please enter financier name');
      return;
    }
  }
  
  // Collect form data
  const data = {
    receiptNo: receiptNo,
    bookingDate: window.currentFullRecord?.bookingDate || window.currentRecord?.bookingDate || '',  // Preserve booking date from loaded record
    customerName: getValue('customerName'),
    mobileNo: getValue('mobileNo'),
    model: getValue('model'),
    variant: getValue('variant'),
    colour: getValue('colour'),
    discount: getValue('discount'),
    finalPrice: getValue('finalPrice'),
    financierName: financierName,
    deliveryDate: getValue('deliveryDate'),
    salesRemark: getValue('salesRemark'),
    receiptNo2: getValue('receiptNo2'),
    receipt2Amount: getValue('receipt2Amount'),
    receiptNo3: getValue('receiptNo3'),
    receipt3Amount: getValue('receipt3Amount'),
    receiptNo4: getValue('receiptNo4'),
    receipt4Amount: getValue('receipt4Amount'),
    doNumber: getValue('doNumber'),
    disbursedAmount: getValue('disbursedAmount'),
    cashTotal: getValue('hiddenCashTotal') || '0',
    grandTotal: getValue('hiddenGrandTotal') || '0'
  };
  
  // Add accessories
  const accessoryIds = ['guard', 'gripcover', 'seatcover', 'matin', 'tankcover', 'handlehook', 'helmet', 'raincover', 'buzzer', 'backrest'];
  accessoryIds.forEach(function(id) {
    const element = document.getElementById(id);
    if (element) {
      data[id] = element.value || '';
    }
  });
  
  console.log('💾 Updating:', data);
  console.log('📅 Booking Date being sent:', data.bookingDate);
  console.log('📦 Current record booking date:', window.currentFullRecord?.bookingDate || window.currentRecord?.bookingDate);
  
  const updateBtn = document.getElementById('updateBtn');
  if (updateBtn) {
    updateBtn.disabled = true;
    updateBtn.textContent = '⏳ Updating...';
  }
  
  try {
    const sessionId = SessionManager.getSessionId();
    const response = await API.call('updateSalesRecord', {
      sessionId: sessionId,
      data: JSON.stringify(data)
    });
    
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.textContent = '💾 Update Record';
    }
    
    if (response.success) {
      showMessage('✅ Updated successfully!', 'success');
      
      // Show WhatsApp message modal
      showWhatsAppModal(data);
    } else {
      showMessage('❌ ' + (response.message || 'Update failed'), 'error');
    }
  } catch (error) {
    console.error('❌ Update error:', error);
    showMessage('❌ Update failed', 'error');
    
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.textContent = '💾 Update Record';
    }
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function setTextContent(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value : '';
}

function showMessage(message, type) {
  // Use existing message display or alert
  console.log(type.toUpperCase() + ':', message);
  // You can implement a toast notification here
}

function logout() {
  if (confirm('Logout?')) {
    SessionManager.clearSession();
    window.location.href = 'index.html';
  }
}

// ==========================================
// WHATSAPP MESSAGE
// ==========================================

function showWhatsAppModal(data) {
  // Create modal HTML
  const modalHTML = `
    <div id="whatsappModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center;">
      <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
        <h3 style="margin-top: 0; color: #25D366;">📱 Send WhatsApp Message</h3>
        
        <div style="background: #f0f0f0; padding: 15px; border-radius: 10px; margin-bottom: 20px; font-family: monospace; white-space: pre-wrap; font-size: 13px;" id="whatsappMessagePreview"></div>
        
        <div style="display: flex; gap: 10px;">
          <button onclick="sendWhatsAppMessage()" style="flex: 1; background: #25D366; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px;">
            📤 Send WhatsApp
          </button>
          <button onclick="closeWhatsAppModal()" style="flex: 1; background: #6c757d; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px;">
            ✖️ Close
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to page
  const modalDiv = document.createElement('div');
  modalDiv.innerHTML = modalHTML;
  document.body.appendChild(modalDiv.firstElementChild);
  
  // Build message in requested format
  const record = window.currentFullRecord || {};
  
  let message = '*Customer Name* - ' + (data.customerName || '') + '\n';
  message += '*Variant* - ' + (data.model || '') + ' - ' + (data.variant || '') + '\n';
  message += '*Colour* - ' + (data.colour || '') + '\n';
  message += '*Finance* - ' + (data.financierName || '') + '\n';
  message += '*Passing Date* - ' + (data.deliveryDate || '') + '\n';
  
  const cashTotal = parseFloat(getValue('hiddenCashTotal') || '0');
  const finalPrice = parseFloat(data.finalPrice || '0');
  
  message += '*Cash Collected* - Rs.' + cashTotal.toFixed(2) + '\n';
  message += '*Final price after discount* - Rs.' + finalPrice + '\n';
  message += '*Discount* - ' + (data.discount || '0') + '\n';
  
  // Get PriceMaster details to check which accessories are available
  const pmCache = priceMasterCache[data.model + '|' + data.variant] || {};
  
  // Accessories - Only show ones that have prices in PriceMaster
  message += '*Accessories* -\n';
  
  const accessoryList = [
    {key: 'guard', name: 'Guard', priceKey: 'guardPrice'},
    {key: 'gripcover', name: 'Grip Cover', priceKey: 'gripPrice'},
    {key: 'seatcover', name: 'Seat Cover', priceKey: 'seatCoverPrice'},
    {key: 'matin', name: 'Matin', priceKey: 'matinPrice'},
    {key: 'tankcover', name: 'Tank Cover', priceKey: 'tankCoverPrice'},
    {key: 'handlehook', name: 'Handle Hook', priceKey: 'handleHookPrice'},
    {key: 'helmet', name: 'Helmet', priceKey: 'helmetPrice'},
    {key: 'raincover', name: 'Rain Cover', priceKey: 'rainCoverPrice'},
    {key: 'buzzer', name: 'Buzzer', priceKey: 'buzzerPrice'},
    {key: 'backrest', name: 'Back Rest', priceKey: 'backRestPrice'}
  ];
  
  // Only show accessories that exist in PriceMaster for this model
  accessoryList.forEach(function(acc) {
    if (pmCache[acc.priceKey]) {
      const value = data[acc.key] || 'No';
      message += acc.name + ' - ' + value + '\n';
    }
  });
  
  // Display message
  document.getElementById('whatsappMessagePreview').textContent = message;
  
  // Store for sending
  window.whatsappMessage = message;
}

function sendWhatsAppMessage() {
  const message = window.whatsappMessage;
  
  if (!message) {
    alert('Message not found!');
    return;
  }
  
  // Check if it's mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Encode message for URL
  const encodedMessage = encodeURIComponent(message);
  
  if (isMobile) {
    // For mobile devices, open WhatsApp app with message ready to share
    const whatsappURL = 'whatsapp://send?text=' + encodedMessage;
    window.location.href = whatsappURL;
  } else {
    // For desktop, open WhatsApp Web with message ready to share
    const whatsappURL = 'https://web.whatsapp.com/send?text=' + encodedMessage;
    window.open(whatsappURL, '_blank');
  }
  
  // Close modal after short delay
  setTimeout(closeWhatsAppModal, 1000);
}

function closeWhatsAppModal() {
  const modal = document.getElementById('whatsappModal');
  if (modal) {
    modal.remove();
  }
}

// ==========================================
// EXECUTIVE NAMES DROPDOWN
// ==========================================

async function loadExecutiveNames() {
  try {
    const res = await API.call('getExecutiveNames', { sessionId: SessionManager.getSessionId() });
    if (!res.success || !res.names) return;
    const sel = document.getElementById('executiveDropdown');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select Executive --</option>';
    res.names.forEach(function(name) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  } catch(e) {
    console.error('loadExecutiveNames error:', e);
  }
}

// ==========================================
// ACCOUNT CHECK DASHBOARD
// ==========================================

function populateAcctMonthOptions() {
  const sel = document.getElementById('acctCheckMonth');
  if (!sel) return;
  const now = new Date();
  let opts = '<option value="">All Months</option>';
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    opts += `<option value="${val}" ${i === 0 ? 'selected' : ''}>${label}</option>`;
  }
  sel.innerHTML = opts;
}

async function loadAccountCheckDashboard() {
  const month = document.getElementById('acctCheckMonth')?.value || '';
  const grid = document.getElementById('acctCardsGrid');
  grid.innerHTML = '<div style="color:#999; font-size:13px;">Loading...</div>';
  document.getElementById('acctPendingList').style.display = 'none';

  try {
    const res = await API.call('getPendingAccountCheck', {
      sessionId: SessionManager.getSessionId(),
      month
    });
    if (!res.success) { grid.innerHTML = '<div style="color:#dc3545; font-size:13px;">Failed to load</div>'; return; }

    const stats = res.stats || {};
    const execs = Object.keys(stats);
    if (execs.length === 0) {
      grid.innerHTML = '<div style="color:#28a745; font-size:13px; padding:8px;">✅ All bookings have Account Check completed for this period!</div>';
      return;
    }

    // Total card for admin only
    const session = SessionManager.getSession();
    const role = session && session.user ? session.user.role : '';
    let totalCard = '';
    if (role === 'admin') {
      const total = execs.reduce((sum, e) => sum + (stats[e].count || 0), 0);
      totalCard = `
        <div class="acct-exec-card" onclick="showAllPending()" style="border-left:5px solid #dc3545;grid-column:1/-1;">
          <div class="exec-name" style="color:#dc3545;">📋 Total Pending</div>
          <div class="exec-count" style="color:#dc3545;">${total}</div>
          <div class="exec-label">Account Check Pending (All Executives)</div>
        </div>`;
    }

    grid.innerHTML = totalCard + execs.map(exec => `
      <div class="acct-exec-card" onclick="showPendingForExec('${exec.replace(/'/g, "\\'")}')">
        <div class="exec-name">${exec || '⚠️ (No Name)'}</div>
        <div class="exec-count">${stats[exec].count}</div>
        <div class="exec-label">Pending Account Check</div>
      </div>
    `).join('');

    // Store stats for click handler
    window._acctStats = stats;
  } catch(e) {
    grid.innerHTML = '<div style="color:#dc3545; font-size:13px;">Error loading dashboard</div>';
  }
}

function showAllPending() {
  const stats = window._acctStats || {};
  const allRecords = Object.keys(stats).reduce((acc, exec) => {
    return acc.concat((stats[exec].records || []).map(r => Object.assign({}, r, { executiveName: exec })));
  }, []);
  document.getElementById('acctPendingTitle').textContent = 'All Executives — ' + allRecords.length + ' pending';
  document.getElementById('acctPendingHead').innerHTML =
    '<tr><th>Receipt No</th><th>Customer</th><th>Model</th><th>Booking Date</th><th>Executive</th><th>Acct Check</th></tr>';
  document.getElementById('acctPendingBody').innerHTML = allRecords.map(r => `
    <tr onclick="searchAndLoadReceipt('${r.receiptNo.replace(/'/g, "\\'")}')">
      <td><strong>${r.receiptNo}</strong></td>
      <td>${r.customerName}</td>
      <td style="font-size:12px;">${r.model}</td>
      <td>${r.bookingDate}</td>
      <td style="font-size:12px;color:#667eea;font-weight:600;">${r.executiveName || '—'}</td>
      <td><span style="color:${r.accountCheck === 'Blank' ? '#999' : '#dc3545'};">${r.accountCheck}</span></td>
    </tr>
  `).join('');
  const panel = document.getElementById('acctPendingList');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showPendingForExec(execName) {
  const stats = window._acctStats || {};
  const records = (stats[execName] || {}).records || [];
  const panel = document.getElementById('acctPendingList');
  document.getElementById('acctPendingTitle').textContent = execName + ' — ' + records.length + ' pending';
  document.getElementById('acctPendingHead').innerHTML =
    '<tr><th>Receipt No</th><th>Customer</th><th>Model</th><th>Booking Date</th><th>Acct Check</th></tr>';
  const tbody = document.getElementById('acctPendingBody');
  tbody.innerHTML = records.map(r => `
    <tr onclick="searchAndLoadReceipt('${r.receiptNo.replace(/'/g, "\\'")}')">
      <td><strong>${r.receiptNo}</strong></td>
      <td>${r.customerName}</td>
      <td style="font-size:12px;">${r.model}</td>
      <td>${r.bookingDate}</td>
      <td><span style="color:${r.accountCheck === 'Blank' ? '#999' : '#dc3545'};">${r.accountCheck}</span></td>
    </tr>
  `).join('');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function searchAndLoadReceipt(receiptNo) {
  document.getElementById('acctPendingList').style.display = 'none';
  // Set search fields and trigger search
  setValue('searchBy', 'Receipt No');
  handleSearchByChange();
  setValue('searchValue', receiptNo);
  await searchRecords();
  // Auto-load the first result if only one
  const results = window._lastSearchResults || [];
  if (results.length === 1) loadRecord(results[0]);
  setTimeout(() => {
    document.getElementById('resultsSection')?.scrollIntoView({ behavior: 'smooth' });
  }, 300);
}

// ==========================================
// CANCEL BOOKING
// ==========================================

function confirmCancelBooking() {
  const receiptNo = document.getElementById('selectedReceiptNo').value;
  if (!receiptNo) return;
  document.getElementById('cancelReceiptNoDisplay').textContent = receiptNo;
  document.getElementById('cancelModal').style.display = 'flex';
}

async function executeCancelBooking() {
  document.getElementById('cancelModal').style.display = 'none';
  const receiptNo = document.getElementById('selectedReceiptNo').value;
  if (!receiptNo) return;

  const btn = document.getElementById('cancelBookingBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Cancelling...';

  try {
    const res = await API.call('cancelBooking', {
      sessionId: SessionManager.getSessionId(),
      receiptNo
    });
    if (res.success) {
      showMessage('✅ Booking ' + receiptNo + ' has been cancelled', 'success');
      document.getElementById('detailsSection').style.display = 'none';
      document.getElementById('resultsSection').style.display = 'none';
      loadAccountCheckDashboard();
    } else {
      showMessage('❌ ' + (res.message || 'Cancel failed'), 'error');
      btn.disabled = false;
      btn.textContent = '🚫 Cancel This Booking';
    }
  } catch(e) {
    showMessage('❌ Cancel failed', 'error');
    btn.disabled = false;
    btn.textContent = '🚫 Cancel This Booking';
  }
}

/**
 * Go back to home page
 */
function goBack() {
  window.location.href = 'home.html';
}

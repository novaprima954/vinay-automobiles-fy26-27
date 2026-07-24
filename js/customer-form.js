// ==========================================
// CUSTOMER FORM PAGE LOGIC - UPDATED
// All fixes applied
// ==========================================

let currentRecord = null;
let allRecords = [];
let currentFilter = 'today'; // FIXED: Default to 'today'
let hasPAN = null;

// ==========================================
// PAGE INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('=== CUSTOMER FORM PAGE ===');
  
  const session = SessionManager.getSession();
  
  if (!session) {
    console.log('❌ No session - redirecting to login');
    alert('Please login first');
    window.location.href = 'index.html';
    return;
  }
  
  const user = session.user;
  
  if (user.role !== 'admin' && user.role !== 'sales' && user.role !== 'accounts') {
    console.log('❌ Access denied for role:', user.role);
    alert('Access denied. Only sales, admin, and accounts can access this page.');
    window.location.href = 'home.html';
    return;
  }
  
  console.log('✅ Access granted:', user.name, '/', user.role);
  
  loadCustomerFormRecords();
});

async function loadCustomerFormRecords() {
  const sessionId = SessionManager.getSessionId();
  const user = SessionManager.getCurrentUser();
  
  console.log('Loading customer form records for:', user.name);
  
  try {
    const response = await API.call('getCustomerFormRecords', {
      sessionId: sessionId
    });
    
    console.log('API Response:', response);
    
    if (response.success) {
      console.log('Number of records received:', response.records ? response.records.length : 0);
      allRecords = response.records || [];
      
      // FIXED: Apply 'today' filter by default
      filterRecords('today');
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Error loading records:', error);
    showMessage('Failed to load records', 'error');
  }
}

function displayRecords(records) {
  const listContainer = document.getElementById('recordsList');
  const emptyState = document.getElementById('emptyState');
  
  console.log('displayRecords called with:', records);
  
  if (!records || records.length === 0) {
    listContainer.style.display = 'none';
    emptyState.style.display = 'block';
    console.log('No records to display - showing empty state');
    return;
  }
  
  listContainer.style.display = 'block';
  emptyState.style.display = 'none';
  
  let html = '';
  
  records.forEach(function(record) {
    html += '<div class="record-item" onclick="openCustomerForm(\'' + record.receiptNo + '\')">';
    html += '  <div class="record-info">';
    html += '    <div class="record-receipt">Receipt: ' + record.receiptNo + '</div>';
    html += '    <div class="record-customer">' + record.customerName + '</div>';
    html += '    <div class="record-details">';
    html += '      ' + record.variant + ' • ' + record.colour + ' • 📱 ' + record.mobileNo;
    html += '    </div>';
    html += '  </div>';
    html += '  <div class="record-badge">✓ Complete</div>';
    html += '</div>';
  });
  
  console.log('Setting innerHTML...');
  listContainer.innerHTML = html;
  console.log('✅ Records displayed successfully');
}

// FIXED: Parse accessories from individual fields
function getAccessoriesList(record) {
  const accessories = [];
  
  if (record.guard === 'Yes') accessories.push('Guard');
  if (record.gripcover === 'Yes' || record.gripCover === 'Yes') accessories.push('Grip Cover');
  if (record.seatcover === 'Yes' || record.seatCover === 'Yes') accessories.push('Seat Cover');
  if (record.matin === 'Yes') accessories.push('Matin');
  if (record.tankcover === 'Yes' || record.tankCover === 'Yes') accessories.push('Tank Cover');
  if (record.handlehook === 'Yes' || record.handleHook === 'Yes') accessories.push('Handle Hook');
  if (record.helmet && record.helmet !== 'No') accessories.push('Helmet (' + record.helmet + ')');
  
  return accessories.length > 0 ? accessories.join(', ') : 'None';
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Renders the customer's actual stored receipt numbers (Receipt No + Receipt No 1-4) as tick items. */
function renderReceiptTicks(record) {
  const container = document.getElementById('formReceiptTicks');
  if (!container) return;

  const candidates = [
    record.receiptNo,
    record.receiptNo1,
    record.receiptNo2,
    record.receiptNo3,
    record.receiptNo4
  ].map(function (v) { return String(v || '').trim(); }).filter(Boolean);

  // De-duplicate while preserving order (receiptNo and receiptNo1 can sometimes match)
  const seen = {};
  const unique = candidates.filter(function (v) {
    if (seen[v]) return false;
    seen[v] = true;
    return true;
  });

  container.innerHTML = unique.length
    ? unique.map(function (rn) {
        return '<span class="tick-item"><span class="tick-box"></span>' + esc(rn) + '</span>';
      }).join('')
    : '<span style="color:#999;font-size:12px;">None on record</span>';
}

function toggleChoiceNumber() {
  const box = document.getElementById('choiceNumberBox');
  if (box) box.classList.toggle('checked');
}

async function openCustomerForm(receiptNo) {
  const sessionId = SessionManager.getSessionId();
  
  console.log('Opening customer form for receipt:', receiptNo);
  
  try {
    const response = await API.call('getRecordByReceiptNo', {
      sessionId: sessionId,
      receiptNo: receiptNo
    });
    
    if (response.success) {
      currentRecord = response.record;
      
      console.log('Current record:', currentRecord);
      
      document.getElementById('formExecutive').textContent = currentRecord.executiveName || '-';
      
      // FIXED: Get accessories from individual fields
      const accessoriesList = getAccessoriesList(currentRecord);
      document.getElementById('formAccessories').textContent = accessoriesList;
      
      console.log('Accessories:', accessoriesList);
      
      document.getElementById('formVariant').textContent = currentRecord.variant || '';
      document.getElementById('formColor').textContent = currentRecord.colour || '';
      document.getElementById('formEngineNo').textContent = currentRecord.engineNumber || '';
      document.getElementById('formChassisNo').textContent = currentRecord.frameNumber || '';
      document.getElementById('formCustomerName').textContent = currentRecord.customerName || '';
      document.getElementById('formMobileNo').textContent = currentRecord.mobileNo || '';
      document.getElementById('formFinancer').textContent = currentRecord.financierName || 'Cash';

      renderReceiptTicks(currentRecord);
      // Reset Choice Number to unticked for each newly opened record
      const choiceBox = document.getElementById('choiceNumberBox');
      if (choiceBox) choiceBox.classList.remove('checked');

      const financierName = (currentRecord.financierName || 'Cash').toLowerCase().trim();
      const isCash = financierName === 'cash' || financierName === '';
      
      if (isCash) {
        document.getElementById('page3').style.display = 'none';
        console.log('✅ Page 3 hidden (Cash payment)');
      } else {
        document.getElementById('page3').style.display = 'block';
        console.log('✅ Page 3 visible (Financed: ' + currentRecord.financierName + ')');
      }
      
      // FIXED: Ask about PAN card
      askAboutPAN();
      
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Error loading record:', error);
    showMessage('Failed to load record details', 'error');
  }
}

// FIXED: Ask about PAN card
function askAboutPAN() {
  const hasCustomerPAN = confirm('Does the customer have a PAN card?\n\nClick OK if YES (skip Form 60)\nClick Cancel if NO (show Form 60)');
  
  hasPAN = hasCustomerPAN;
  
  if (hasCustomerPAN) {
    document.getElementById('page2').style.display = 'none';
    console.log('✅ Page 2 hidden (Customer has PAN)');
  } else {
    document.getElementById('page2').style.display = 'block';
    populateForm60();
    console.log('✅ Page 2 visible (Customer does NOT have PAN)');
  }
  
  document.getElementById('recordsContainer').style.display = 'none';
  document.getElementById('formsWrapper').classList.add('active');
  document.getElementById('formActions').classList.add('active');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  console.log('✅ Forms displayed');
}

function populateForm60() {
  if (!currentRecord) {
    console.error('No current record to populate Form 60');
    return;
  }
  
  console.log('Populating Form 60 for:', currentRecord.customerName);
  
  document.getElementById('form60Name1').textContent = currentRecord.customerName || '';
  document.getElementById('form60Name2').textContent = currentRecord.customerName || '';
  
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const month = months[today.getMonth()];
  const year = String(today.getFullYear()).slice(-1);
  
  document.getElementById('form60Day').textContent = day;
  document.getElementById('form60Month').textContent = month;
  document.getElementById('form60Year').textContent = year;
  
  console.log('✅ Form 60 populated with date:', day, month, '202' + year);
}

function printAllForms() {
  console.log('🖨️ Printing all forms...');
  window.print();
}

/**
 * Renders page1/page2/page3 into a single jsPDF document. Shared by shareAsPDF()
 * (downloads locally) and saveCustomerFormToDrive() (uploads to Drive).
 */
async function _buildCustomerFormPdf() {
  if (!currentRecord || !currentRecord.customerName) {
    throw new Error('NO_DATA');
  }
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    throw new Error('NO_LIBRARY');
  }

  const customerName = currentRecord.customerName
    .replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toUpperCase();
  const filename = customerName + '.pdf';

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageIds = ['page1', 'page2', 'page3'];
  let firstPage = true;

  for (let i = 0; i < pageIds.length; i++) {
    const el = document.getElementById(pageIds[i]);
    if (!el || el.style.display === 'none') continue;

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 794,
      scrollY: 0
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    if (!firstPage) pdf.addPage();
    // Fit image to exactly A4 (210 x 297 mm)
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    firstPage = false;
  }

  if (firstPage) throw new Error('NO_PAGES');

  return { pdf, filename };
}

async function shareAsPDF() {
  showMessage('⏳ Generating PDF... Please wait.', 'info');
  try {
    const { pdf, filename } = await _buildCustomerFormPdf();
    pdf.save(filename);
    showMessage('✅ PDF downloaded: ' + filename, 'success');
  } catch (error) {
    console.error('PDF generation error:', error);
    if (error.message === 'NO_DATA') { alert('⚠️ No customer data available'); return; }
    if (error.message === 'NO_LIBRARY') { alert('PDF library not loaded. Please use Print → Save as PDF instead.'); window.print(); return; }
    if (error.message === 'NO_PAGES') { alert('⚠️ No pages to export'); return; }
    showMessage('⚠️ PDF failed — using print dialog instead.', 'error');
    window.print();
  }
}

async function saveCustomerFormToDrive() {
  showMessage('⏳ Saving to Drive... Please wait.', 'info');
  try {
    const { pdf, filename } = await _buildCustomerFormPdf();
    const dataUri = pdf.output('datauristring');
    const base64 = dataUri.split(',')[1];

    const r = await API.call('saveCustomerFormToDrive', {
      sessionId: SessionManager.getSessionId(),
      pdfBase64: base64,
      fileName: filename,
      customerName: currentRecord.customerName || ''
    });

    if (r.success) {
      showMessage('✅ Saved to Drive — Customer Form / ' + (r.folderDate || ''), 'success');
    } else {
      showMessage('❌ ' + (r.message || 'Could not save to Drive'), 'error');
    }
  } catch (error) {
    console.error('Save to Drive error:', error);
    if (error.message === 'NO_DATA') { alert('⚠️ No customer data available'); return; }
    if (error.message === 'NO_LIBRARY') { alert('PDF library not loaded — cannot save to Drive.'); return; }
    if (error.message === 'NO_PAGES') { alert('⚠️ No pages to save'); return; }
    showMessage('⚠️ Could not save to Drive: ' + error.message, 'error');
  }
}

function closeAllForms() {
  console.log('Closing forms, returning to records list');
  
  document.getElementById('formsWrapper').classList.remove('active');
  document.getElementById('formActions').classList.remove('active');
  
  document.getElementById('page2').style.display = 'block';
  
  document.getElementById('recordsContainer').style.display = 'block';
  
  currentRecord = null;
  hasPAN = null;
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showMessage(text, type) {
  const msg = document.getElementById('statusMessage');
  if (!msg) return;
  
  msg.textContent = text;
  msg.className = 'message ' + type;
  msg.classList.remove('hidden');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  if (type === 'success' || type === 'info') {
    setTimeout(function() {
      msg.classList.add('hidden');
    }, 3000);
  }
}

function goBack() {
  window.location.href = 'home.html';
}

// FIXED: Filter records with correct button IDs
function filterRecords(filterType) {
  console.log('Filtering by:', filterType);
  
  currentFilter = filterType;
  
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.classList.remove('filter-btn-active');
  });
  
  let activeBtn = null;
  if (filterType === 'today') {
    activeBtn = document.getElementById('filterToday');
  } else if (filterType === 'next7days') {
    activeBtn = document.getElementById('filterNext7');
  } else if (filterType === 'thisMonth') {
    activeBtn = document.getElementById('filterMonth');
  } else if (filterType === 'all') {
    activeBtn = document.getElementById('filterAll');
  }
  
  if (activeBtn) {
    activeBtn.classList.add('filter-btn-active');
  }
  
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let filtered = allRecords;
  
  if (filterType === 'today') {
    filtered = allRecords.filter(function(record) {
      if (!record.deliveryDate) return false;
      const deliveryDate = parseDate(record.deliveryDate);
      return deliveryDate && deliveryDate.getTime() === today.getTime();
    });
    console.log('Today filter: ' + filtered.length + ' records');
  } else if (filterType === 'next7days') {
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);
    
    filtered = allRecords.filter(function(record) {
      if (!record.deliveryDate) return false;
      const deliveryDate = parseDate(record.deliveryDate);
      return deliveryDate && deliveryDate >= today && deliveryDate <= next7Days;
    });
    console.log('Next 7 days filter: ' + filtered.length + ' records');
  } else if (filterType === 'thisMonth') {
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();
    
    filtered = allRecords.filter(function(record) {
      if (!record.deliveryDate) return false;
      const deliveryDate = parseDate(record.deliveryDate);
      return deliveryDate && deliveryDate.getMonth() === thisMonth && deliveryDate.getFullYear() === thisYear;
    });
    console.log('This month filter: ' + filtered.length + ' records');
  }
  
  console.log('Filtered results:', filtered.length);
  displayRecords(filtered);
}

function searchRecords() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  console.log('Searching for:', searchTerm);
  
  if (searchTerm === '') {
    filterRecords(currentFilter);
    return;
  }
  
  const filtered = allRecords.filter(function(record) {
    return record.customerName && record.customerName.toLowerCase().includes(searchTerm);
  });
  
  console.log('Search results:', filtered.length);
  displayRecords(filtered);
}

function parseDate(dateString) {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return null;
  }
  
  date.setHours(0, 0, 0, 0);
  return date;
}

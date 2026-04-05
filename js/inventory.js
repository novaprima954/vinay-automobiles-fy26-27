// ==========================================
// INVENTORY MANAGEMENT
// ==========================================

let invUser = null;
let invSessionId = null;
let invLocations = [];
let invSkus = [];
let invFieldValues = {}; // { Category: [], Type: [], Brand: [], Color: [] }
let invStock = [];       // [{ skuId, locationId, qty }]
let invTransactions = [];
let activeIssueType = 'issue';
let currentFieldTab = 'Category';
let issueSkuRowCount = 0;
let otcSkuRowCount = 0;
let returnSkuRowCount = 0;
let currentBooking = null;
let bookingSearchResults = [];

const ACCESSORY_FIELDS = [
  { key: 'guard',      label: 'Guard' },
  { key: 'gripcover',  label: 'Grip Cover' },
  { key: 'seatcover',  label: 'Seat Cover' },
  { key: 'matin',      label: 'Matin' },
  { key: 'tankcover',  label: 'Tank Cover' },
  { key: 'handlehook', label: 'Handle Hook' },
  { key: 'helmet',     label: 'Helmet' },
  { key: 'raincover',  label: 'Rain Cover' },
  { key: 'buzzer',     label: 'Buzzer' },
  { key: 'backrest',   label: 'Back Rest' }
];

// ==========================================
// INIT
// ==========================================

document.addEventListener('DOMContentLoaded', async function () {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  invUser = session.user;
  invSessionId = session.sessionId;
  document.getElementById('currentUser').textContent = invUser.name + ' (' + invUser.role + ')';

  // Show masters tab for admin only
  if (invUser.role === 'admin') {
    document.getElementById('mastersTab').style.display = '';
  }

  // Set today's date on date fields
  const today = new Date().toISOString().split('T')[0];
  ['siDate', 'otcDate', 'issueDeliveryDate', 'returnDate', 'histFrom', 'histTo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  showLoading(true);
  try {
    await Promise.all([loadLocations(), loadSkus(), loadFieldValues(), loadStock()]);
    populateAllDropdowns();
    renderDashboard();
  } catch (e) {
    showMessage('Error loading inventory data: ' + e.message, 'error');
  }
  showLoading(false);
});

// ==========================================
// DATA LOADERS
// ==========================================

async function loadLocations() {
  const res = await API.inventoryCall('getInvLocations', { sessionId: invSessionId });
  if (res.success) invLocations = res.locations || [];
}

async function loadSkus() {
  const res = await API.inventoryCall('getInvSkus', { sessionId: invSessionId });
  if (res.success) invSkus = res.skus || [];
}

async function loadFieldValues() {
  const res = await API.inventoryCall('getInvFieldValues', { sessionId: invSessionId });
  if (res.success) invFieldValues = res.fieldValues || {};
}

async function loadStock() {
  const res = await API.inventoryCall('getInvStock', { sessionId: invSessionId });
  if (res.success) invStock = res.stock || [];
}

// ==========================================
// DROPDOWN POPULATION
// ==========================================

function populateAllDropdowns() {
  populateSkuDropdowns();
  populateLocationDropdowns();
}

function populateSkuDropdowns() {
  const skuOptions = buildSkuOptions();
  ['siSku', 'trSku'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = '<option value="">-- Select Accessory --</option>' + skuOptions; }
  });
}

function buildSkuOptions() {
  return invSkus.map(s =>
    `<option value="${s.skuId}">${skuDisplayName(s)}</option>`
  ).join('');
}

function skuDisplayName(sku) {
  if (!sku) return '';
  return [sku.category, sku.type, sku.brand, sku.color].filter(Boolean).join(' / ');
}

function skuById(skuId) {
  return invSkus.find(s => s.skuId === skuId) || null;
}

function populateLocationDropdowns() {
  const locOptions = invLocations.map(l =>
    `<option value="${l.locationId}">${l.name}</option>`
  ).join('');
  ['siLocation', 'trFrom', 'trTo', 'otcLocation', 'returnToLocation',
   'dashLocationFilter', 'histLocation'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const prefix = id.startsWith('dash') || id.startsWith('hist')
      ? '<option value="">All Locations</option>'
      : '<option value="">-- Select Location --</option>';
    el.innerHTML = prefix + locOptions;
  });
}

// ==========================================
// TABS
// ==========================================

function showTab(name) {
  document.querySelectorAll('.inv-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.inv-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  const tabs = document.querySelectorAll('.inv-tab');
  tabs.forEach(t => { if (t.textContent.toLowerCase().includes(name.substring(0, 4).toLowerCase())) t.classList.add('active'); });

  if (name === 'history') loadHistory();
  if (name === 'masters') renderMasters();
  if (name === 'dashboard') renderDashboard();
}

// ==========================================
// DASHBOARD
// ==========================================

function renderDashboard() {
  const locFilter = document.getElementById('dashLocationFilter').value;
  const catFilter = document.getElementById('dashCategoryFilter').value;

  // Populate category filter
  const catEl = document.getElementById('dashCategoryFilter');
  const cats = [...new Set(invSkus.map(s => s.category))].filter(Boolean);
  catEl.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${c}" ${catFilter === c ? 'selected' : ''}>${c}</option>`).join('');

  const filteredSkus = invSkus.filter(s =>
    (!catFilter || s.category === catFilter)
  );

  const visibleLocs = locFilter
    ? invLocations.filter(l => l.locationId === locFilter)
    : invLocations;

  // Build stock lookup
  const stockMap = {};
  invStock.forEach(s => {
    stockMap[s.skuId + '|' + s.locationId] = s.qty || 0;
  });

  // Low stock alerts
  const lowStockItems = [];
  invSkus.forEach(sku => {
    const totalQty = invLocations.reduce((sum, l) =>
      sum + (stockMap[sku.skuId + '|' + l.locationId] || 0), 0);
    if (sku.minStock > 0 && totalQty <= sku.minStock) {
      lowStockItems.push({ sku, totalQty });
    }
  });

  const lowSection = document.getElementById('lowStockSection');
  const lowGrid = document.getElementById('lowStockGrid');
  if (lowStockItems.length > 0) {
    lowSection.style.display = '';
    lowGrid.innerHTML = lowStockItems.map(({ sku, totalQty }) => `
      <div class="alert-card">
        <div class="sku-name">${skuDisplayName(sku)}</div>
        <div class="sku-stock">${totalQty}</div>
        <div class="sku-min">Min: ${sku.minStock}</div>
      </div>
    `).join('');
  } else {
    lowSection.style.display = 'none';
  }

  // Build table
  const tbody = document.getElementById('stockTableBody');
  const thead = document.getElementById('stockTableHeaders');

  // Inject location headers into the header row
  const headerRow = document.querySelector('.stock-table thead tr');
  // Remove old location headers (keep first 4)
  while (headerRow.cells.length > 4) headerRow.deleteCell(4);
  visibleLocs.forEach(l => {
    const th = document.createElement('th');
    th.textContent = l.name;
    th.style.textAlign = 'center';
    headerRow.appendChild(th);
  });

  if (filteredSkus.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + (4 + visibleLocs.length) + '" style="text-align:center; color:#999; padding:20px;">No accessories found</td></tr>';
    return;
  }

  tbody.innerHTML = filteredSkus.map(sku => {
    const qtyCells = visibleLocs.map(l => {
      const qty = stockMap[sku.skuId + '|' + l.locationId] || 0;
      const total = invLocations.reduce((s, loc) => s + (stockMap[sku.skuId + '|' + loc.locationId] || 0), 0);
      const isLow = sku.minStock > 0 && total <= sku.minStock;
      const cls = qty === 0 ? 'zero' : (isLow ? 'low' : '');
      return `<td class="stock-qty ${cls}">${qty === 0 ? '-' : qty}</td>`;
    }).join('');
    return `<tr>
      <td>${sku.category || '-'}</td>
      <td>${sku.type || '-'}</td>
      <td>${sku.brand || '-'}</td>
      <td>${sku.color || '-'} ${sku.minStock > 0 ? '<span class="low-badge">Min:' + sku.minStock + '</span>' : ''}</td>
      ${qtyCells}
    </tr>`;
  }).join('');
}

// ==========================================
// STOCK IN
// ==========================================

async function submitStockIn() {
  const skuId = document.getElementById('siSku').value;
  const locationId = document.getElementById('siLocation').value;
  const qty = parseInt(document.getElementById('siQty').value);
  const date = document.getElementById('siDate').value;
  const remarks = document.getElementById('siRemarks').value;

  if (!skuId || !locationId || !qty || qty < 1) {
    showMessage('Please fill Accessory, Location, and Quantity', 'error'); return;
  }

  showLoading(true);
  const res = await API.inventoryCall('invStockIn', {
    sessionId: invSessionId,
    skuId, locationId, qty, date, remarks
  });
  showLoading(false);

  if (res.success) {
    showMessage('Stock recorded successfully', 'success');
    await loadStock();
    renderDashboard();
    document.getElementById('siQty').value = '';
    document.getElementById('siRemarks').value = '';
  } else {
    showMessage(res.message || 'Failed to record stock', 'error');
  }
}

// ==========================================
// TRANSFER
// ==========================================

function showTransferStock() {
  const skuId = document.getElementById('trSku').value;
  const locationId = document.getElementById('trFrom').value;
  const el = document.getElementById('trAvailableStock');
  if (!skuId || !locationId) { el.textContent = ''; return; }
  const s = invStock.find(x => x.skuId === skuId && x.locationId === locationId);
  const qty = s ? s.qty : 0;
  el.innerHTML = `Available at selected location: <strong>${qty}</strong>`;
}

async function submitTransfer() {
  const skuId = document.getElementById('trSku').value;
  const fromId = document.getElementById('trFrom').value;
  const toId = document.getElementById('trTo').value;
  const qty = parseInt(document.getElementById('trQty').value);
  const remarks = document.getElementById('trRemarks').value;

  if (!skuId || !fromId || !toId || !qty || qty < 1) {
    showMessage('Please fill all fields', 'error'); return;
  }
  if (fromId === toId) {
    showMessage('From and To locations cannot be the same', 'error'); return;
  }
  const s = invStock.find(x => x.skuId === skuId && x.locationId === fromId);
  if (!s || s.qty < qty) {
    showMessage('Insufficient stock at selected location', 'error'); return;
  }

  showLoading(true);
  const res = await API.inventoryCall('invTransfer', {
    sessionId: invSessionId,
    skuId, fromLocationId: fromId, toLocationId: toId, qty, remarks
  });
  showLoading(false);

  if (res.success) {
    showMessage('Transfer completed', 'success');
    await loadStock();
    renderDashboard();
    showTransferStock();
  } else {
    showMessage(res.message || 'Transfer failed', 'error');
  }
}

// ==========================================
// ISSUE TO BOOKING / OTC SALE
// ==========================================

function setIssueType(type) {
  activeIssueType = type;
  document.getElementById('toggleIssue').classList.toggle('active', type === 'issue');
  document.getElementById('toggleOtc').classList.toggle('active', type === 'otc');
  document.getElementById('issueBookingForm').style.display = type === 'issue' ? '' : 'none';
  document.getElementById('otcSaleForm').style.display = type === 'otc' ? '' : 'none';
  if (type === 'otc' && document.getElementById('otcSkuList').children.length === 0) addOtcSkuRow();
}

function onIssueSearchTypeChange() {
  const type = document.getElementById('issueSearchType').value;
  const textEl = document.getElementById('issueSearchText');
  const dateEl = document.getElementById('issueSearchDate');
  const label = document.getElementById('issueSearchLabel');
  const labels = { receiptNo: 'Receipt No', customerName: 'Customer Name', executiveName: 'Executive Name', deliveryDate: 'Delivery Date' };
  const placeholders = { receiptNo: 'Enter receipt number', customerName: 'Enter customer name', executiveName: 'Enter executive name' };
  label.textContent = labels[type] || 'Search Value';
  if (type === 'deliveryDate') {
    textEl.style.display = 'none';
    dateEl.style.display = '';
    textEl.value = '';
  } else {
    textEl.style.display = '';
    dateEl.style.display = 'none';
    dateEl.value = '';
    textEl.placeholder = placeholders[type] || 'Enter search value';
  }
  resetBookingSearch();
}

function resetBookingSearch() {
  currentBooking = null;
  bookingSearchResults = [];
  document.getElementById('bookingInfoBox').classList.remove('show');
  document.getElementById('bookingSearchResults').style.display = 'none';
  document.getElementById('issueItemsSection').style.display = 'none';
  document.getElementById('issueSkuList').innerHTML = '';
  issueSkuRowCount = 0;
}

async function lookupBooking() {
  const searchType = document.getElementById('issueSearchType').value;
  const isDate = searchType === 'deliveryDate';
  const searchValue = isDate
    ? document.getElementById('issueSearchDate').value
    : document.getElementById('issueSearchText').value.trim();

  if (!searchValue) { showMessage('Enter a search value', 'error'); return; }

  showLoading(true);
  const res = await API.inventoryCall('getBookingForIssue', { sessionId: invSessionId, searchType, searchValue });
  showLoading(false);

  document.getElementById('bookingSearchResults').style.display = 'none';

  if (!res.success) {
    showMessage(res.message || 'Booking not found', 'error');
    resetBookingSearch();
    return;
  }

  if (res.bookings && res.bookings.length > 1) {
    bookingSearchResults = res.bookings;
    renderBookingResults(res.bookings);
    document.getElementById('bookingSearchResults').style.display = '';
    document.getElementById('bookingInfoBox').classList.remove('show');
    document.getElementById('issueItemsSection').style.display = 'none';
  } else {
    const booking = res.booking || (res.bookings && res.bookings[0]);
    if (booking) {
      showBookingDetails(booking);
    } else {
      showMessage('Booking not found', 'error');
      resetBookingSearch();
    }
  }
}

function renderBookingResults(bookings) {
  const list = document.getElementById('bookingResultsList');
  list.innerHTML = bookings.map((b, i) =>
    `<div class="booking-result-item" onclick="selectBookingFromResults(${i})"
      style="padding:10px 14px; border-bottom:1px solid #eee; cursor:pointer; font-size:13px; display:flex; gap:16px; flex-wrap:wrap;">
      <span><strong>${b.receiptNo || '-'}</strong></span>
      <span>${b.customerName || '-'}</span>
      <span style="color:#666;">${b.executiveName || '-'}</span>
      <span style="color:#888;">${b.deliveryDate || 'No delivery date'}</span>
    </div>`
  ).join('');
}

function selectBookingFromResults(index) {
  document.getElementById('bookingSearchResults').style.display = 'none';
  showBookingDetails(bookingSearchResults[index]);
}

function showBookingDetails(booking) {
  currentBooking = booking;
  const b = booking;
  const acctOk = b.accountCheck === 'Yes';

  document.getElementById('bookingInfoRow').innerHTML = `
    <div class="booking-info-item">Receipt: <span>${b.receiptNo || '-'}</span></div>
    <div class="booking-info-item">Customer: <span>${b.customerName || '-'}</span></div>
    <div class="booking-info-item">Executive: <span>${b.executiveName || '-'}</span></div>
    <div class="booking-info-item">Model: <span>${b.model || '-'} ${b.variant || ''}</span></div>
    <div class="booking-info-item">Delivery Date: <span>${b.deliveryDate || 'Not set'}</span></div>
    <div class="booking-info-item">Account Check: <span style="color:${acctOk ? '#2e7d32' : '#c62828'}; font-weight:700;">${b.accountCheck || 'Pending'}</span></div>
  `;
  document.getElementById('bookingInfoBox').classList.add('show');

  const warning = document.getElementById('accountCheckWarning');
  const submitBtn = document.getElementById('issueSubmitBtn');
  warning.style.display = acctOk ? 'none' : '';
  submitBtn.disabled = !acctOk;
  submitBtn.style.opacity = acctOk ? '' : '0.5';
  submitBtn.style.cursor = acctOk ? '' : 'not-allowed';

  document.getElementById('issueItemsSection').style.display = '';
  if (b.deliveryDate) document.getElementById('issueDeliveryDate').value = b.deliveryDate;

  document.getElementById('issueSkuList').innerHTML = '';
  issueSkuRowCount = 0;
  renderOrderedAccessories(b);
}

function renderOrderedAccessories(booking) {
  const ordered = ACCESSORY_FIELDS.filter(a => booking[a.key] === 'Yes');
  if (ordered.length === 0) {
    document.getElementById('issueSkuList').innerHTML =
      '<div style="color:#888; font-size:13px; padding:10px;">No accessories ordered in this booking.</div>';
    return;
  }
  ordered.forEach(a => addIssueSkuRow(a.label));
}

function addIssueSkuRow(accessoryName) {
  const id = ++issueSkuRowCount;
  const row = document.createElement('div');
  row.className = 'sku-issue-item';
  row.id = 'issue-row-' + id;

  const storeLocation = invLocations.find(l => l.name.toLowerCase() === 'store');
  const locOptions = invLocations.map(l =>
    `<option value="${l.locationId}" ${storeLocation && l.locationId === storeLocation.locationId ? 'selected' : ''}>${l.name}</option>`
  ).join('');

  row.innerHTML = `
    <div>
      <input type="text" value="${accessoryName || ''}" placeholder="Type" readonly
        style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px; font-size:13px; background:#f0f0f0; color:#444;">
    </div>
    <div>
      <select data-role="sku" style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px; font-size:13px;">
        <option value="">-- Select SKU --</option>${buildSkuOptions()}
      </select>
    </div>
    <div>
      <input type="number" min="1" value="1" style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px; font-size:13px;">
    </div>
    <div>
      <select data-role="location" style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px; font-size:13px;">
        <option value="">-- Location --</option>${locOptions}
      </select>
    </div>
    <button class="btn-remove-sku" onclick="document.getElementById('issue-row-${id}').remove()" style="margin-top:2px;">✕</button>
  `;
  document.getElementById('issueSkuList').appendChild(row);
}

function addOtcSkuRow() {
  const id = ++otcSkuRowCount;
  const row = document.createElement('div');
  row.className = 'sku-issue-item';
  row.id = 'otc-row-' + id;
  row.innerHTML = `
    <div>
      <label>Accessory</label>
      <select style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px; font-size:13px;">
        <option value="">-- Select --</option>${buildSkuOptions()}
      </select>
    </div>
    <div>
      <label>Qty</label>
      <input type="number" min="1" value="1" style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px; font-size:13px;">
    </div>
    <div></div>
    <button class="btn-remove-sku" onclick="document.getElementById('otc-row-${id}').remove()">✕</button>
  `;
  document.getElementById('otcSkuList').appendChild(row);
}

function collectSkuRows(listId) {
  const items = [];
  document.querySelectorAll('#' + listId + ' .sku-issue-item').forEach(row => {
    const skuSel = row.querySelector('[data-role="sku"]') || row.querySelector('select');
    const locSel = row.querySelector('[data-role="location"]');
    const inp = row.querySelector('input[type="number"]');
    if (skuSel && inp && skuSel.value) {
      items.push({
        skuId: skuSel.value,
        qty: parseInt(inp.value) || 1,
        locationId: locSel ? locSel.value : ''
      });
    }
  });
  return items;
}

async function submitIssue() {
  if (!currentBooking) { showMessage('Look up a booking first', 'error'); return; }
  if (currentBooking.accountCheck !== 'Yes') {
    showMessage('Cannot issue: Account Check not completed for this booking', 'error'); return;
  }

  const items = collectSkuRows('issueSkuList');
  if (items.length === 0) { showMessage('Add at least one accessory row', 'error'); return; }

  for (const item of items) {
    if (!item.skuId) { showMessage('Select a SKU for every accessory row', 'error'); return; }
    if (!item.locationId) { showMessage('Select a location for every accessory row', 'error'); return; }
  }

  showLoading(true);
  const res = await API.inventoryCall('invIssueToBooking', {
    sessionId: invSessionId,
    receiptNo: currentBooking.receiptNo,
    customerName: currentBooking.customerName,
    executiveName: currentBooking.executiveName,
    deliveryDate: document.getElementById('issueDeliveryDate').value,
    items: JSON.stringify(items),
    remarks: document.getElementById('issueRemarks').value
  });
  showLoading(false);

  if (res.success) {
    showMessage('Accessories issued successfully', 'success');
    await loadStock();
    renderDashboard();
    resetBookingSearch();
    document.getElementById('issueSearchText').value = '';
    document.getElementById('issueRemarks').value = '';
  } else {
    showMessage(res.message || 'Issue failed', 'error');
  }
}

async function submitOtcSale() {
  const customer = document.getElementById('otcCustomer').value.trim();
  const receiptNo = document.getElementById('otcReceiptNo').value.trim();
  const amount = document.getElementById('otcAmount').value;
  const locationId = document.getElementById('otcLocation').value;
  const items = collectSkuRows('otcSkuList');

  if (!customer || !receiptNo || !locationId || items.length === 0) {
    showMessage('Fill Customer Name, Receipt No, Location, and at least one item', 'error'); return;
  }

  showLoading(true);
  const res = await API.inventoryCall('invOtcSale', {
    sessionId: invSessionId,
    customerName: customer,
    mobileNo: document.getElementById('otcMobile').value,
    otcReceiptNo: receiptNo,
    saleAmount: amount,
    date: document.getElementById('otcDate').value,
    locationId,
    items: JSON.stringify(items),
    remarks: document.getElementById('otcRemarks').value
  });
  showLoading(false);

  if (res.success) {
    showMessage('OTC sale recorded', 'success');
    await loadStock();
    renderDashboard();
    ['otcCustomer','otcMobile','otcReceiptNo','otcAmount','otcRemarks'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('otcSkuList').innerHTML = '';
    otcSkuRowCount = 0;
    addOtcSkuRow();
  } else {
    showMessage(res.message || 'OTC sale failed', 'error');
  }
}

// ==========================================
// RETURNS
// ==========================================

function onReturnTypeChange() {
  const type = document.getElementById('returnType').value;
  document.getElementById('returnRefLabel').textContent =
    type === 'booking' ? 'Booking Receipt No' : 'OTC Receipt No';
  document.getElementById('returnInfoBox').classList.remove('show');
  document.getElementById('returnItemsSection').style.display = 'none';
}

async function lookupReturn() {
  const refNo = document.getElementById('returnRefNo').value.trim();
  const type = document.getElementById('returnType').value;
  if (!refNo) { showMessage('Enter a reference number', 'error'); return; }

  showLoading(true);
  const res = await API.inventoryCall('getIssuedItems', {
    sessionId: invSessionId,
    refNo,
    refType: type
  });
  showLoading(false);

  if (res.success) {
    const info = res.info || {};
    document.getElementById('returnInfoRow').innerHTML = `
      <div class="booking-info-item">Customer: <span>${info.customerName || '-'}</span></div>
      <div class="booking-info-item">Reference: <span>${refNo}</span></div>
      ${info.executiveName ? `<div class="booking-info-item">Executive: <span>${info.executiveName}</span></div>` : ''}
    `;
    document.getElementById('returnInfoBox').classList.add('show');
    document.getElementById('returnItemsSection').style.display = '';
    if (document.getElementById('returnSkuList').children.length === 0) addReturnSkuRow();
  } else {
    showMessage(res.message || 'No records found', 'error');
  }
}

function addReturnSkuRow() {
  const id = ++returnSkuRowCount;
  const row = document.createElement('div');
  row.className = 'sku-issue-item';
  row.id = 'return-row-' + id;
  row.innerHTML = `
    <div>
      <label>Accessory</label>
      <select style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px; font-size:13px;">
        <option value="">-- Select --</option>${buildSkuOptions()}
      </select>
    </div>
    <div>
      <label>Qty</label>
      <input type="number" min="1" value="1" style="width:100%; padding:8px; border:2px solid #ddd; border-radius:6px; font-size:13px;">
    </div>
    <div></div>
    <button class="btn-remove-sku" onclick="document.getElementById('return-row-${id}').remove()">✕</button>
  `;
  document.getElementById('returnSkuList').appendChild(row);
}

async function submitReturn() {
  const refNo = document.getElementById('returnRefNo').value.trim();
  const type = document.getElementById('returnType').value;
  const locationId = document.getElementById('returnToLocation').value;
  const items = collectSkuRows('returnSkuList');
  const reason = document.getElementById('returnReason').value.trim();

  if (!refNo || !locationId || items.length === 0 || !reason) {
    showMessage('Fill all fields and add items to return', 'error'); return;
  }

  showLoading(true);
  const res = await API.inventoryCall('invReturn', {
    sessionId: invSessionId,
    refNo,
    refType: type,
    toLocationId: locationId,
    items: JSON.stringify(items),
    reason,
    date: document.getElementById('returnDate').value
  });
  showLoading(false);

  if (res.success) {
    showMessage('Return processed successfully', 'success');
    await loadStock();
    renderDashboard();
    document.getElementById('returnRefNo').value = '';
    document.getElementById('returnInfoBox').classList.remove('show');
    document.getElementById('returnItemsSection').style.display = 'none';
    document.getElementById('returnSkuList').innerHTML = '';
    returnSkuRowCount = 0;
  } else {
    showMessage(res.message || 'Return failed', 'error');
  }
}

// ==========================================
// HISTORY
// ==========================================

async function loadHistory() {
  const type = document.getElementById('histType').value;
  const locationId = document.getElementById('histLocation').value;
  const fromDate = document.getElementById('histFrom').value;
  const toDate = document.getElementById('histTo').value;

  const res = await API.inventoryCall('getInvTransactions', {
    sessionId: invSessionId,
    type, locationId, fromDate, toDate
  });

  if (res.success) {
    invTransactions = res.transactions || [];
    renderHistory();
  }
}

function renderHistory() {
  const tbody = document.getElementById('historyBody');
  if (invTransactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#999; padding:20px;">No transactions found</td></tr>';
    return;
  }
  tbody.innerHTML = invTransactions.map(t => {
    const typeClass = 'txn-' + (t.type || '');
    return `<tr>
      <td style="white-space:nowrap;">${t.date || ''}</td>
      <td><span class="txn-type-badge ${typeClass}">${t.type || ''}</span></td>
      <td>${t.skuName || ''}</td>
      <td>${t.fromLocation || '-'}</td>
      <td>${t.toLocation || '-'}</td>
      <td style="text-align:center; font-weight:700;">${t.qty || ''}</td>
      <td style="font-family:monospace; font-size:12px;">${t.receiptNo || t.otcReceiptNo || '-'}</td>
      <td>${t.customerName || '-'}</td>
      <td>${t.enteredBy || ''}</td>
      <td style="font-size:12px; color:#666;">${t.remarks || ''}</td>
    </tr>`;
  }).join('');
}

function exportHistoryCSV() {
  if (invTransactions.length === 0) { showMessage('No data to export', 'error'); return; }
  let csv = 'Date,Type,Accessory,From Location,To Location,Qty,Receipt No,Customer,User,Remarks\n';
  invTransactions.forEach(t => {
    csv += [t.date, t.type, t.skuName, t.fromLocation, t.toLocation, t.qty,
      t.receiptNo || t.otcReceiptNo, t.customerName, t.enteredBy, t.remarks
    ].map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(',') + '\n';
  });
  downloadCSV(csv, 'Inventory_History.csv');
}

function exportStockCSV() {
  const stockMap = {};
  invStock.forEach(s => { stockMap[s.skuId + '|' + s.locationId] = s.qty || 0; });
  let csv = 'Category,Type,Brand,Color,' + invLocations.map(l => l.name).join(',') + '\n';
  invSkus.forEach(sku => {
    const qtys = invLocations.map(l => stockMap[sku.skuId + '|' + l.locationId] || 0);
    csv += [sku.category, sku.type, sku.brand, sku.color, ...qtys]
      .map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(',') + '\n';
  });
  downloadCSV(csv, 'Inventory_Stock.csv');
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==========================================
// MASTERS (Admin only)
// ==========================================

function renderMasters() {
  renderLocationsList();
  renderSkuList();
  renderFieldValuesList();
  populateMasterDropdowns();
}

function renderLocationsList() {
  const el = document.getElementById('locationsList');
  el.innerHTML = invLocations.map(l => `
    <div class="master-item">
      <span>${l.name}</span>
    </div>
  `).join('') || '<div style="color:#999; font-size:13px; padding:8px;">No locations yet</div>';
}

function renderSkuList() {
  const el = document.getElementById('skuList');
  el.innerHTML = invSkus.map(s => `
    <div class="master-item">
      <span style="font-size:12px;">${skuDisplayName(s)}</span>
      <span style="font-size:11px; color:#888;">Min:${s.minStock || 0}</span>
    </div>
  `).join('') || '<div style="color:#999; font-size:13px; padding:8px;">No SKUs yet</div>';
}

function populateMasterDropdowns() {
  const fields = ['Category', 'Type', 'Brand', 'Color'];
  const ids = ['newSkuCategory', 'newSkuType', 'newSkuBrand', 'newSkuColor'];
  fields.forEach((field, i) => {
    const el = document.getElementById(ids[i]);
    if (!el) return;
    const vals = (invFieldValues[field] || []);
    const optional = field === 'Brand' || field === 'Color';
    el.innerHTML = `<option value="">-- ${field}${optional ? ' (optional)' : ''} --</option>` +
      vals.map(v => `<option value="${v}">${v}</option>`).join('');
  });
}

function filterTypesByCategory() {
  // Types are not filtered by category in this simple implementation - all types shown
}

function showFieldTab(field) {
  currentFieldTab = field;
  document.getElementById('currentFieldTab').value = field;
  document.querySelectorAll('.field-tab').forEach(t => {
    t.classList.toggle('active', t.textContent === field);
  });
  renderFieldValuesList();
}

function renderFieldValuesList() {
  const el = document.getElementById('fieldValuesList');
  const vals = invFieldValues[currentFieldTab] || [];
  el.innerHTML = vals.map(v => `
    <div class="master-item">
      <span>${v}</span>
    </div>
  `).join('') || '<div style="color:#999; font-size:13px; padding:8px;">No values yet</div>';
}

async function addLocation() {
  const name = document.getElementById('newLocationName').value.trim();
  if (!name) { showMessage('Enter a location name', 'error'); return; }

  const res = await API.inventoryCall('addInvLocation', { sessionId: invSessionId, name });
  if (res.success) {
    showMessage('Location added', 'success');
    document.getElementById('newLocationName').value = '';
    await loadLocations();
    populateLocationDropdowns();
    renderLocationsList();
  } else {
    showMessage(res.message || 'Failed', 'error');
  }
}

async function addSku() {
  const category = document.getElementById('newSkuCategory').value;
  const type = document.getElementById('newSkuType').value;
  const brand = document.getElementById('newSkuBrand').value;
  const color = document.getElementById('newSkuColor').value;
  const minStock = parseInt(document.getElementById('newSkuMinStock').value) || 0;

  if (!category || !type) { showMessage('Category and Type are required', 'error'); return; }

  const res = await API.inventoryCall('addInvSku', {
    sessionId: invSessionId,
    category, type, brand, color, minStock
  });
  if (res.success) {
    showMessage('Accessory SKU added', 'success');
    await loadSkus();
    populateSkuDropdowns();
    renderSkuList();
  } else {
    showMessage(res.message || 'Failed', 'error');
  }
}

async function addFieldValue() {
  const field = document.getElementById('currentFieldTab').value;
  const value = document.getElementById('newFieldValue').value.trim();
  if (!value) { showMessage('Enter a value', 'error'); return; }

  const res = await API.inventoryCall('addInvFieldValue', {
    sessionId: invSessionId, field, value
  });
  if (res.success) {
    showMessage(field + ' value added', 'success');
    document.getElementById('newFieldValue').value = '';
    await loadFieldValues();
    renderFieldValuesList();
    populateMasterDropdowns();
  } else {
    showMessage(res.message || 'Failed', 'error');
  }
}

// ==========================================
// HELPERS
// ==========================================

function showLoading(show) {
  // reuse existing loading mechanism if present, or silently skip
  const el = document.getElementById('statusMessage');
  if (show) {
    el.textContent = 'Loading...';
    el.className = 'message info';
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function showMessage(msg, type) {
  const el = document.getElementById('statusMessage');
  el.textContent = msg;
  el.className = 'message ' + type;
  el.classList.remove('hidden');
  if (type === 'success') setTimeout(() => el.classList.add('hidden'), 3000);
}

function goBack() {
  window.location.href = 'home.html';
}

function onSkuChange(prefix) { /* placeholder for future use */ }

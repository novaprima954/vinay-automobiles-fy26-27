// ==========================================
// CRM QUOTATION GENERATOR  v2
// ==========================================

let currentUser = null;
let leadId = null;
let priceDetails = null;
let lastQuotNo = '';
let customAccItems = [];    // { id, label, price }
let pendingQuotData = null; // quotation data for reprint restoration
let compareMode = false;
let priceDetails2 = null;   // vehicle 2 for comparison

const ACC_CONFIG = [
  { key: 'guardPrice',      label: 'All Round Guard' },
  { key: 'gripPrice',       label: 'Grip Cover' },
  { key: 'seatCoverPrice',  label: 'Seat Cover' },
  { key: 'matinPrice',      label: 'Matin' },
  { key: 'tankCoverPrice',  label: 'Tank Cover' },
  { key: 'handleHookPrice', label: 'Handle Hook / Ladies Hook' },
  { key: 'helmetPrice',     label: 'TVS Genuine Helmet' },
  { key: 'rainCoverPrice',  label: 'Rain Cover' },
  { key: 'buzzerPrice',     label: 'Buzzer' },
  { key: 'backRestPrice',   label: 'Back Rest' }
];

document.addEventListener('DOMContentLoaded', async function() {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  currentUser = session.user;

  const urlParams = new URLSearchParams(window.location.search);
  leadId = urlParams.get('leadId');
  const reprintQuotNo = urlParams.get('quotNo');

  // If reprinting, fix the quotNo so we don't generate a new one
  if (reprintQuotNo) lastQuotNo = reprintQuotNo;

  // Show CRM details section only for new customers (no leadId)
  if (!leadId) {
    document.getElementById('crmDetailsSection').style.display = 'block';
  }

  // Instant prefill from URL params (fallback)
  let modelHint = urlParams.get('model') || '';
  if (urlParams.get('name'))    document.getElementById('custName').value    = urlParams.get('name');
  if (urlParams.get('mobile'))  document.getElementById('custMobile').value  = urlParams.get('mobile');
  if (urlParams.get('address')) document.getElementById('custAddress').value = urlParams.get('address');

  // If leadId given, fetch lead details to auto-fill
  if (leadId) {
    try {
      const lr = await API.getLeadDetails(leadId);
      if (lr.success && lr.lead) {
        const l = lr.lead;
        document.getElementById('custName').value    = l.customerName || '';
        document.getElementById('custMobile').value  = l.mobileNo     || '';
        document.getElementById('custAddress').value = l.address       || '';
        modelHint = modelHint || l.model || '';
        document.getElementById('btnOpenLead').style.display = 'block';
      }
    } catch(e) {}
  }

  // Restrict follow-up date: today → today+10
  _setFollowUpDateLimits('quotFollowUpDate');

  // If reprinting a quotation, load saved accessories/settings
  if (reprintQuotNo) {
    try {
      const qr = await API.getQuotationByNo(reprintQuotNo);
      if (qr.success && qr.quotation && qr.quotation.quotData) {
        try { pendingQuotData = JSON.parse(qr.quotation.quotData); } catch(e) {}
        // Override model hint from saved quotation
        if (!modelHint && qr.quotation.model) modelHint = qr.quotation.model;
      }
    } catch(e) {}
  }

  // Load financier list for dropdown
  _loadFinancierDropdown();

  await loadModels(modelHint);
});

// ── FINANCIER DROPDOWN ──────────────────────

async function _loadFinancierDropdown() {
  try {
    const sel = document.getElementById('quotFinancier');
    if (!sel) return;
    const r = await API.getFinancierUsers();
    if (r.success && r.financiers) {
      r.financiers.forEach(function(f) {
        const opt = document.createElement('option');
        opt.value = f.name; opt.textContent = f.name;
        sel.appendChild(opt);
      });
    }
  } catch(e) {}
}

// ── ACCELERATOR TOGGLE ───────────────────────

function toggleAccelerator() {
  const checked = document.getElementById('punchedInAccelerator').checked;
  const followUpSection = document.getElementById('followUpSection');
  if (followUpSection) {
    followUpSection.style.display = checked ? 'none' : '';
  }
}

// ── LEAD SEARCH ─────────────────────────────

async function searchLead() {
  const mobile = document.getElementById('searchMobile').value.trim();
  if (!mobile || mobile.length < 10) {
    showMessage('Enter a valid 10-digit mobile number', 'error');
    return;
  }

  const btn = document.getElementById('btnSearch');
  btn.disabled = true; btn.textContent = 'Searching...';

  try {
    const response = await API.findLeadByMobile(mobile);
    if (!response.success) {
      showMessage(response.message || 'Search failed', 'error');
      return;
    }
    if (!response.found) {
      showMessage('No existing lead found for this mobile. Fill in details to create a new one.', 'info');
      document.getElementById('custMobile').value = mobile;
      return;
    }

    // Lead found — fill all fields
    const lead = response.lead;
    document.getElementById('custName').value    = lead.customerName || '';
    document.getElementById('custMobile').value  = lead.mobileNo    || mobile;
    document.getElementById('custAddress').value = lead.address     || '';
    leadId = lead.leadId;

    // Try to select model
    if (lead.model) {
      const matched = setModelValue(lead.model);
      if (matched) await onModelChange(lead.model);
    }

    // Hide CRM details section (already a CRM lead)
    document.getElementById('crmDetailsSection').style.display = 'none';
    document.getElementById('btnOpenLead').style.display = 'block';

    // Collapse search box
    document.getElementById('searchBox').style.display = 'none';
    document.getElementById('toggleSearchBtn').textContent = '🔍 Search Existing Lead';
    showMessage('✅ ' + lead.customerName + ' — ' + (lead.status || 'Pool') + (lead.assignedTo ? ' · ' + lead.assignedTo : ''), 'success');
  } catch (e) {
    showMessage('Search error: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Find';
  }
}

function toggleSearch() {
  const box = document.getElementById('searchBox');
  const btn = document.getElementById('toggleSearchBtn');
  if (box.style.display === 'none') {
    box.style.display = 'block';
    btn.textContent = '✕ Cancel Search';
    document.getElementById('searchMobile').focus();
  } else {
    box.style.display = 'none';
    btn.textContent = '🔍 Search Existing Lead';
  }
}

// ── MODELS ──────────────────────────────────

async function loadModels(modelHint) {
  try {
    const response = await API.getPriceMasterModels();
    const sel = document.getElementById('modelSelect');
    if (response.success && response.models) {
      response.models.forEach(function(m) {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = m;
        sel.appendChild(opt);
      });
      // Try to pre-select from hint
      if (modelHint) {
        const matched = setModelValue(modelHint);
        if (matched) await onModelChange(modelHint);
      }
    }
  } catch (e) {
    showMessage('Error loading models', 'error');
  }
}

/**
 * Try to match model name — exact, case-insensitive, or contains match.
 * Returns true if a match was found and selected.
 */
function setModelValue(hint) {
  const sel = document.getElementById('modelSelect');
  const opts = Array.from(sel.options).slice(1); // skip placeholder
  const h = hint.trim().toLowerCase();

  // 1. Exact
  const exact = opts.find(function(o) { return o.value.toLowerCase() === h; });
  if (exact) { sel.value = exact.value; return true; }

  // 2. PriceMaster model is contained in the hint (e.g. hint="Jupiter 110", PM model="Jupiter 110")
  const contains = opts.find(function(o) { return h.includes(o.value.toLowerCase()); });
  if (contains) { sel.value = contains.value; return true; }

  // 3. Hint is contained in PriceMaster model
  const hintIn = opts.find(function(o) { return o.value.toLowerCase().includes(h); });
  if (hintIn) { sel.value = hintIn.value; return true; }

  // 4. Starts-with match (first word)
  const firstWord = h.split(' ')[0];
  const starts = opts.find(function(o) { return o.value.toLowerCase().startsWith(firstWord); });
  if (starts) { sel.value = starts.value; return true; }

  return false;
}

async function onModelChange(variantHint) {
  const model = document.getElementById('modelSelect').value;
  const varSel = document.getElementById('variantSelect');
  varSel.innerHTML = '<option value="">-- Select Variant --</option>';
  varSel.disabled = true;
  document.getElementById('accessoriesCard').style.display = 'none';
  document.getElementById('btnGenerate').disabled = true;
  priceDetails = null;
  if (!model) return;

  try {
    const response = await API.getPriceMasterVariants(model);
    if (response.success && response.variants) {
      response.variants.forEach(function(v) {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        varSel.appendChild(opt);
      });
      varSel.disabled = false;

      // Auto-select if only one variant
      if (response.variants.length === 1) {
        varSel.value = response.variants[0];
        await onVariantChange();
      } else if (variantHint) {
        // Try to match variant from hint
        const h = String(variantHint).toLowerCase();
        const match = response.variants.find(function(v) {
          return v.toLowerCase().includes(h) || h.includes(v.toLowerCase());
        });
        if (match) {
          varSel.value = match;
          await onVariantChange();
        }
      }
    }
  } catch (e) {
    showMessage('Error loading variants', 'error');
  }
}

async function onVariantChange() {
  const model   = document.getElementById('modelSelect').value;
  const variant = document.getElementById('variantSelect').value;
  if (!variant) return;

  customAccItems = [];  // reset custom items on variant change
  document.getElementById('accGrid').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('accessoriesCard').style.display = 'block';
  document.getElementById('btnGenerate').disabled = true;

  try {
    const response = await API.getPriceMasterDetails(model, variant);
    if (response.success) {
      priceDetails = response.details;
      renderAccessories(priceDetails);
      if (pendingQuotData) {
        restoreQuotData(pendingQuotData);
        pendingQuotData = null;
      }
      recalculate();
      document.getElementById('btnGenerate').disabled = false;
      // Show compare toggle now that vehicle 1 is loaded
      const compareCard = document.getElementById('compareToggleCard');
      if (compareCard) compareCard.style.display = '';
    } else {
      showMessage(response.message, 'error');
    }
  } catch (e) {
    showMessage('Error loading price details', 'error');
  }
}

// ── VEHICLE 2 (COMPARISON) ──────────────────

function toggleCompareMode() {
  compareMode = !compareMode;
  const card  = document.getElementById('vehicle2Card');
  const btn   = document.getElementById('btnToggleCompare');
  if (compareMode) {
    card.style.display = '';
    btn.innerHTML = '✕ Cancel Comparison';
    btn.style.cssText += ';background:#fff0f0;color:#ef5350;border-color:#ef5350;';
    _populateModelSelect2();
  } else {
    card.style.display = 'none';
    btn.innerHTML = '⚖️ Compare with Another Vehicle';
    btn.style.cssText += ';background:#f0f4ff;color:#667eea;border-color:#667eea;';
    priceDetails2 = null;
  }
}

async function _populateModelSelect2() {
  const sel = document.getElementById('modelSelect2');
  if (sel.options.length > 1) return;  // already loaded
  try {
    const r = await API.getPriceMasterModels();
    if (r.success && r.models) {
      r.models.forEach(function(m) {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = m;
        sel.appendChild(opt);
      });
    }
  } catch(e) {}
}

async function onModelChange2() {
  const model  = document.getElementById('modelSelect2').value;
  const varSel = document.getElementById('variantSelect2');
  varSel.innerHTML = '<option value="">-- Select Variant --</option>';
  varSel.disabled  = true;
  priceDetails2    = null;
  if (!model) return;
  try {
    const r = await API.getPriceMasterVariants(model);
    if (r.success && r.variants) {
      r.variants.forEach(function(v) {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        varSel.appendChild(opt);
      });
      varSel.disabled = false;
      if (r.variants.length === 1) { varSel.value = r.variants[0]; await onVariantChange2(); }
    }
  } catch(e) {}
}

async function onVariantChange2() {
  const model   = document.getElementById('modelSelect2').value;
  const variant = document.getElementById('variantSelect2').value;
  if (!model || !variant) return;
  try {
    const r = await API.getPriceMasterDetails(model, variant);
    if (r.success) { priceDetails2 = r.details; showMessage('Vehicle 2 loaded — ready to compare', 'success'); }
  } catch(e) {}
}

// ── ACCESSORIES ─────────────────────────────

function renderAccessories(details) {
  const grid = document.getElementById('accGrid');
  grid.innerHTML = '';
  const available = ACC_CONFIG.filter(function(a) { return details[a.key] && Number(details[a.key]) > 0; });

  if (available.length === 0) {
    grid.innerHTML = '<div style="color:#aaa;font-size:13px;grid-column:1/-1;">No optional accessories in PriceMaster for this variant.</div>';
  } else {
    available.forEach(function(acc) {
      const price = Number(details[acc.key]);
      const div = document.createElement('div');
      div.className = 'acc-item checked';
      div.onclick = function() { toggleAcc(this); };
      div.innerHTML = `
        <input type="checkbox" checked data-key="${acc.key}" data-price="${price}" onchange="recalculate()">
        <div class="acc-item-info">
          <div class="acc-item-name">${acc.label}</div>
          <div class="acc-item-price">₹${fmt(price)}</div>
        </div>
      `;
      grid.appendChild(div);
    });
  }

  // Custom accessories container + Add button
  const customSection = document.createElement('div');
  customSection.style.cssText = 'grid-column:1/-1;margin-top:8px;';
  customSection.innerHTML = `
    <div id="customAccContainer"></div>
    <button type="button" onclick="addCustomAccItem()"
      style="width:100%;padding:10px;background:#f0f4ff;color:#667eea;border:2px dashed #667eea;
             border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-top:6px;">
      ➕ Add Custom Product
    </button>`;
  grid.appendChild(customSection);

  document.getElementById('summaryBar').style.display = 'block';
}

function addCustomAccItem() {
  const id = Date.now();
  customAccItems.push({ id: id, label: '', price: 0 });
  renderCustomAccRows();
}

function removeCustomAccItem(id) {
  customAccItems = customAccItems.filter(function(a) { return a.id !== id; });
  renderCustomAccRows();
  recalculate();
}

function updateCustomAcc(id, field, value) {
  const item = customAccItems.find(function(a) { return a.id === id; });
  if (!item) return;
  if (field === 'price') item.price = Math.max(0, Number(value) || 0);
  else item.label = value;
  recalculate();
}

function renderCustomAccRows() {
  const container = document.getElementById('customAccContainer');
  if (!container) return;
  container.innerHTML = customAccItems.map(function(a) {
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;background:#f8f9fa;border:2px solid #e0e0e0;border-radius:8px;padding:8px 10px;">' +
      '<input type="text" class="form-input" style="flex:1;padding:7px 10px;font-size:13px;" ' +
        'placeholder="Product name" value="' + (a.label || '').replace(/"/g,'&quot;') + '" ' +
        'oninput="updateCustomAcc(' + a.id + ',\'label\',this.value)">' +
      '<input type="number" class="form-input" style="width:110px;padding:7px 10px;font-size:13px;text-align:right;" ' +
        'placeholder="Amount" value="' + (a.price || '') + '" min="0" ' +
        'oninput="updateCustomAcc(' + a.id + ',\'price\',this.value)">' +
      '<button type="button" onclick="removeCustomAccItem(' + a.id + ')" ' +
        'style="background:none;border:none;font-size:20px;cursor:pointer;color:#ef5350;padding:0 4px;flex-shrink:0;">✕</button>' +
    '</div>';
  }).join('');
}

/**
 * Restore accessories from saved quotData (for reprint)
 * quotData = { selectedAccKeys, customAcc, discount, isFinanced, color }
 */
function restoreQuotData(qd) {
  if (!qd) return;

  // 1. Uncheck all, then re-check only saved keys
  document.querySelectorAll('#accGrid input[type="checkbox"]').forEach(function(cb) {
    const keep = qd.selectedAccKeys && qd.selectedAccKeys.includes(cb.dataset.key);
    cb.checked = keep;
    const item = cb.closest('.acc-item');
    if (item) item.classList.toggle('checked', keep);
  });

  // 2. Restore custom accessories
  if (qd.customAcc && qd.customAcc.length > 0) {
    customAccItems = qd.customAcc.map(function(a) {
      return { id: Date.now() + Math.random(), label: a.label, price: Number(a.price) || 0 };
    });
    renderCustomAccRows();
  }

  // 3. Restore discount
  if (qd.discount != null) {
    const discEl = document.getElementById('discount');
    if (discEl) discEl.value = qd.discount;
  }

  // 4. Restore hypothecation
  const finEl = document.getElementById('isFinanced');
  if (finEl && qd.isFinanced != null) finEl.checked = !!qd.isFinanced;

  // 5. Restore color
  if (qd.color && qd.color !== '-') {
    const colEl = document.getElementById('vehicleColor');
    if (colEl) colEl.value = qd.color;
  }

  // 6. Restore follow-up date
  if (qd.followUpDate) {
    const fuEl = document.getElementById('quotFollowUpDate');
    if (fuEl) { fuEl.value = qd.followUpDate; fuEl.style.borderColor = '#e8e8e8'; }
  }
}

function toggleAcc(el) {
  const cb = el.querySelector('input[type="checkbox"]');
  cb.checked = !cb.checked;
  el.classList.toggle('checked', cb.checked);
  recalculate();
}

function recalculate() {
  if (!priceDetails) return;
  const exShowroom = Number(priceDetails.exShowroom) || 0;
  const insurance  = Number(priceDetails.insurance)  || 0;
  const rto        = Number(priceDetails.rto)        || 0;
  const pdi        = Number(priceDetails.serviceCharge) || 0;
  const mandAcc    = Number(priceDetails.mandAccessories) || 0;
  const productTotal = exShowroom + insurance + rto + pdi + mandAcc;
  const discount   = Math.max(0, Number(document.getElementById('discount').value) || 0);
  const financed   = document.getElementById('isFinanced') && document.getElementById('isFinanced').checked;
  const hypothecationCharge = financed ? 500 : 0;

  let accTotal = 0;
  document.querySelectorAll('#accGrid input[type="checkbox"]:checked').forEach(function(cb) {
    accTotal += Number(cb.dataset.price) || 0;
  });
  const customAccTotal = customAccItems.reduce(function(s, a) { return s + (Number(a.price) || 0); }, 0);

  const grandTotal = Math.max(0, productTotal + accTotal + customAccTotal + hypothecationCharge - discount);
  document.getElementById('sumExShowroom').textContent = '₹' + fmt(exShowroom);
  document.getElementById('sumInsurance').textContent  = '₹' + fmt(insurance);
  document.getElementById('sumRto').textContent        = '₹' + fmt(rto);
  document.getElementById('sumPdi').textContent        = '₹' + fmt(pdi);
  const mandEl = document.getElementById('sumMandAcc');
  if (mandEl) { mandEl.textContent = '₹' + fmt(mandAcc); mandEl.closest('.summary-row').style.display = mandAcc > 0 ? 'flex' : 'none'; }
  document.getElementById('sumAcc').textContent = '₹' + fmt(accTotal + customAccTotal);
  const finEl = document.getElementById('sumFinance');
  if (finEl) { finEl.style.display = financed ? '' : 'none'; }
  document.getElementById('sumTotal').textContent = '₹' + fmt(grandTotal);
}

// ── GENERATE ────────────────────────────────

async function generateQuotation() {
  const custName = document.getElementById('custName').value.trim();
  const mobile   = document.getElementById('custMobile').value.trim();
  const model    = document.getElementById('modelSelect').value;
  const variant  = document.getElementById('variantSelect').value;

  if (!custName) { showMessage('Please enter customer name', 'error'); return; }
  if (!mobile || !/^\d{10}$/.test(mobile)) { showMessage('Please enter valid 10-digit mobile', 'error'); return; }
  if (!model || !variant) { showMessage('Please select model and variant', 'error'); return; }
  if (compareMode && !priceDetails2) {
    showMessage('Please select Model and Variant for Vehicle 2 before comparing', 'error');
    document.getElementById('vehicle2Card').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const punchedInAccelerator = !!(document.getElementById('punchedInAccelerator') && document.getElementById('punchedInAccelerator').checked);
  const followUpDate = (!punchedInAccelerator && document.getElementById('quotFollowUpDate')) ? document.getElementById('quotFollowUpDate').value : '';
  if (!punchedInAccelerator && !followUpDate) {
    showMessage('Please set a Follow-up Date before generating the quotation', 'error');
    document.getElementById('quotFollowUpDate').style.borderColor = '#ef5350';
    document.getElementById('followUpSection').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const btn = document.getElementById('btnGenerate');
  btn.disabled = true; btn.textContent = 'Generating...';

  try {
    // Use existing quotNo if reprinting, otherwise generate new
    const quotNo = lastQuotNo || ('QT' + Math.floor(1000 + Math.random() * 9000));

    const color    = document.getElementById('vehicleColor').value.trim() || '-';
    const address  = document.getElementById('custAddress').value.trim();
    const district = document.getElementById('custDistrict').value.trim();
    const discount = Math.max(0, Number(document.getElementById('discount').value) || 0);
    const financed = document.getElementById('isFinanced') && document.getElementById('isFinanced').checked;
    const hypothecationCharge = financed ? 500 : 0;
    const execName   = currentUser ? currentUser.name : '';
    const execMobile = currentUser ? (currentUser.mobile || currentUser.phone || '') : '';

    const exShowroom   = Number(priceDetails.exShowroom) || 0;
    const insurance    = Number(priceDetails.insurance)  || 0;
    const rto          = Number(priceDetails.rto)        || 0;
    const pdi          = Number(priceDetails.serviceCharge) || 0;
    const mandAcc      = Number(priceDetails.mandAccessories) || 0;
    const productTotal = exShowroom + insurance + rto + pdi + mandAcc;

    const selectedAcc = [];
    document.querySelectorAll('#accGrid input[type="checkbox"]:checked').forEach(function(cb) {
      const acc = ACC_CONFIG.find(function(a) { return a.key === cb.dataset.key; });
      if (acc) selectedAcc.push({ label: acc.label, price: Number(cb.dataset.price) });
    });
    // Include custom accessories (non-empty name + price > 0)
    const customAcc = customAccItems.filter(function(a) { return a.label && Number(a.price) > 0; });
    const allAcc    = selectedAcc.concat(customAcc.map(function(a) { return { label: a.label, price: Number(a.price) }; }));
    const accTotal   = allAcc.reduce(function(s, a) { return s + a.price; }, 0);
    const grandTotal = Math.max(0, productTotal + accTotal + hypothecationCharge - discount);

    lastQuotNo = quotNo;

    // ── Comparison mode ─────────────────────
    if (compareMode && priceDetails2) {
      const model2    = document.getElementById('modelSelect2').value;
      const variant2  = document.getElementById('variantSelect2').value;
      const color2    = document.getElementById('vehicleColor2').value.trim() || '-';
      const pd2       = priceDetails2;

      const exShowroom2 = Number(pd2.exShowroom) || 0;
      const insurance2  = Number(pd2.insurance)  || 0;
      const rto2        = Number(pd2.rto)        || 0;
      const pdi2        = Number(pd2.serviceCharge) || 0;
      const mandAcc2    = Number(pd2.mandAccessories) || 0;
      const productTotal2 = exShowroom2 + insurance2 + rto2 + pdi2 + mandAcc2;

      // Accessories: use same checked keys, look up price in pd2
      const compAcc = [];
      document.querySelectorAll('#accGrid input[type="checkbox"]:checked').forEach(function(cb) {
        const acc  = ACC_CONFIG.find(function(a) { return a.key === cb.dataset.key; });
        if (!acc) return;
        const p1 = Number(cb.dataset.price) || 0;
        const p2 = Number(pd2[acc.key]) || 0;
        compAcc.push({ label: acc.label, p1: p1, p2: p2 });
      });
      // Custom accessories — same price for both
      customAccItems.filter(function(a) { return a.label && Number(a.price) > 0; })
        .forEach(function(a) { compAcc.push({ label: a.label, p1: Number(a.price), p2: Number(a.price) }); });

      const accTotal2    = compAcc.reduce(function(s,a){ return s+a.p2; }, 0);
      const grandTotal2  = Math.max(0, productTotal2 + accTotal2 + hypothecationCharge - discount);

      const compHtml = buildComparisonQuotationHTML({
        quotNo, date: new Date(), custName, mobile, address, district, execName, execMobile,
        v1: { model, variant, color, exShowroom, insurance, rto, pdi, mandAcc, productTotal, accTotal, hypothecationCharge, discount, grandTotal },
        v2: { model: model2, variant: variant2, color: color2, exShowroom: exShowroom2, insurance: insurance2, rto: rto2, pdi: pdi2, mandAcc: mandAcc2, productTotal: productTotal2, accTotal: accTotal2, hypothecationCharge, discount, grandTotal: grandTotal2 },
        compAcc
      });

      document.getElementById('quotContent').innerHTML = compHtml;
      document.getElementById('quotPreviewWrapper').style.display = 'block';
      document.getElementById('quotPreviewWrapper').scrollIntoView({ behavior: 'smooth' });

      // ── Create / link CRM lead (same logic as single-vehicle path) ────────────
      if (!leadId) {
        const crmNote2     = document.getElementById('crmNote')       ? document.getElementById('crmNote').value.trim() : '';
        const finAssigned2 = document.getElementById('quotFinancier') ? document.getElementById('quotFinancier').value  : '';
        try {
          const addRes2 = await API.addLead({
            customerName:         custName,
            mobileNo:             mobile,
            address:              [address, district].filter(Boolean).join(', '),
            model:                (model + (variant ? ' ' + variant : '')).trim(),
            source:               'Walk-in',
            followUpDate:         followUpDate,
            financierAssigned:    finAssigned2,
            punchedInAccelerator: punchedInAccelerator
          });
          if (addRes2.success) {
            leadId = addRes2.leadId;
            if (crmNote2) {
              await API.logCRMInteraction(leadId, 'Note', crmNote2, followUpDate).catch(function() {});
            }
            document.getElementById('btnOpenLead').style.display = 'block';
            document.getElementById('crmDetailsSection').style.display = 'none';
          } else if (addRes2.isDuplicate && addRes2.existingLead) {
            leadId = addRes2.existingLead.leadId;
            document.getElementById('btnOpenLead').style.display = 'block';
            document.getElementById('crmDetailsSection').style.display = 'none';
            showMessage('ℹ️ Customer already in CRM — quotation linked to existing lead', 'success');
          }
        } catch(ce) { console.error('addLead (comparison) error:', ce); }
      }

      // Update follow-up date for existing leads
      if (leadId && followUpDate) {
        try { await API.updateLead(leadId, { followUpDate: followUpDate }); } catch(e) {}
      }

      // Save comparison quotation to CRM_Quotations
      try {
        await API.saveCRMQuotation({
          quotNo, leadId: leadId || '', customerName: custName,
          model: model + ' vs ' + model2, variant, totalAmount: grandTotal
        });
      } catch(e) { console.error(e); }
      return;  // skip normal path below
    }
    // ── End comparison mode ──────────────────

    // Build quotData for saving (enables reprint restoration)
    const selectedAccKeys = [];
    document.querySelectorAll('#accGrid input[type="checkbox"]').forEach(function(cb) {
      if (cb.checked && cb.dataset.key) selectedAccKeys.push(cb.dataset.key);
    });
    const quotDataObj = {
      selectedAccKeys: selectedAccKeys,
      customAcc: customAccItems.filter(function(a) { return a.label && Number(a.price) > 0; }),
      discount:   discount,
      isFinanced: financed,
      color:      color,
      followUpDate:        followUpDate,
      punchedInAccelerator: punchedInAccelerator
    };

    const html = buildQuotationHTML({
      quotNo, date: new Date(), custName, mobile, address, district,
      model, variant, color, execName, execMobile,
      exShowroom, insurance, rto, pdi, mandAcc, productTotal,
      selectedAcc: allAcc, accTotal, hypothecationCharge, discount, grandTotal
    });

    document.getElementById('quotContent').innerHTML = html;
    document.getElementById('quotPreviewWrapper').style.display = 'block';

    // Auto-save new lead to CRM if not already a known lead
    // Source is always 'Walk-in' for quotation-generated leads (customer is physically present)
    if (!leadId) {
      const crmNote       = document.getElementById('crmNote')       ? document.getElementById('crmNote').value.trim()    : '';
      const finAssigned   = document.getElementById('quotFinancier') ? document.getElementById('quotFinancier').value      : '';
      try {
        const addRes = await API.addLead({
          customerName:         custName,
          mobileNo:             mobile,
          address:              [address, district].filter(Boolean).join(', '),
          model:                (model + (variant ? ' ' + variant : '')).trim(),
          source:               'Walk-in',
          followUpDate:         followUpDate,
          financierAssigned:    finAssigned,
          punchedInAccelerator: punchedInAccelerator
        });
        if (addRes.success) {
          leadId = addRes.leadId;
          // Log initial note if the user typed one (saveCRMQuotation will log the quotation itself)
          if (crmNote) {
            await API.logCRMInteraction(leadId, 'Note', crmNote, followUpDate).catch(function() {});
          }
          document.getElementById('btnOpenLead').style.display = 'block';
          document.getElementById('crmDetailsSection').style.display = 'none';
        } else if (addRes.isDuplicate && addRes.existingLead) {
          // Mobile already in CRM — link quotation to existing lead
          leadId = addRes.existingLead.leadId;
          document.getElementById('btnOpenLead').style.display = 'block';
          document.getElementById('crmDetailsSection').style.display = 'none';
          showMessage('ℹ️ Customer already in CRM — quotation linked to existing lead', 'success');
        }
      } catch(ce) {
        console.error('addLead error:', ce);
      }
    }

    // Save follow-up date for existing leads too
    if (leadId && followUpDate) {
      try {
        await API.updateLead(leadId, { followUpDate: followUpDate });
      } catch(e) { console.error('updateLead followup error:', e); }
    }

    document.getElementById('quotPreviewWrapper').scrollIntoView({ behavior: 'smooth' });

    // Save quotation record to CRM (with quotData for reprint)
    try {
      await API.saveCRMQuotation({ quotNo, leadId: leadId || '', customerName: custName, model, variant, totalAmount: grandTotal, quotData: quotDataObj });
    } catch(sqe) {
      console.error('saveCRMQuotation error:', sqe);
    }

  } catch (e) {
    showMessage('Error generating quotation', 'error');
  } finally {
    btn.disabled = false; btn.textContent = '📄 Generate Quotation';
  }
}

function editQuotation() {
  document.getElementById('quotPreviewWrapper').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function _renderQuotPDF() {
  // Shared PDF rendering — returns { pdf, custName, fileName }
  const el = document.getElementById('quotContent');
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, scrollY: 0 });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pdfW = 210, pdfH = 297;
  const imgH = (canvas.height / canvas.width) * pdfW;
  if (imgH <= pdfH) {
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfW, imgH);
  } else {
    const scale = pdfH / imgH;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfW * scale, pdfH);
  }
  const custNameRaw  = (document.getElementById('custName').value || 'Customer').trim();
  const custNameSafe = custNameRaw.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const custName     = custNameSafe.replace(/\s+/g, '_'); // for legacy reference
  const fileName     = custNameSafe + ' - ' + (lastQuotNo || 'QT') + '.pdf';
  return { pdf, custName, fileName };
}

async function savePDF() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    window.print();
    return;
  }

  const btn = document.querySelector('.btn-save-pdf');
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';

  try {
    const { pdf, fileName } = await _renderQuotPDF();
    pdf.save(fileName);

  } catch (e) {
    showMessage('PDF generation failed, opening print dialog', 'error');
    window.print();
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Save PDF';
  }
}

async function sendWhatsApp() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    showMessage('PDF library not loaded. Please refresh the page.', 'error');
    return;
  }

  const phone = (document.getElementById('custMobile').value || '').replace(/\D/g, '');
  if (!phone || phone.length < 10) {
    showMessage('Customer mobile number is required to send on WhatsApp', 'error');
    return;
  }

  const btn = document.getElementById('btnSendWA');
  btn.disabled = true;
  btn.textContent = '⏳ Sending...';

  try {
    // Generate PDF and convert to base64
    const { pdf, fileName } = await _renderQuotPDF();
    const base64 = pdf.output('datauristring').split(',')[1];

    const customerName = document.getElementById('custName').value || 'Customer';
    const model        = document.getElementById('modelSelect').value   || '';
    const variant      = document.getElementById('variantSelect').value || '';
    const modelVariant = (model + (variant ? ' ' + variant : '')).trim();
    const execName     = currentUser ? (currentUser.name   || '') : '';
    const execMobile   = currentUser ? (currentUser.mobile || '') : '';

    showMessage('📤 Uploading and sending...', 'info');

    const response = await API.sendQuotationWhatsApp(base64, fileName, customerName, phone, lastQuotNo, modelVariant, execName, execMobile);

    if (response.success) {
      showWAToast('✅ Quotation sent on WhatsApp!', 'success');
      // Note: WhatsApp interaction is logged server-side by GAS — no duplicate log here
    } else {
      showWAToast('❌ ' + (response.message || 'Failed to send WhatsApp'), 'error');
    }
  } catch (e) {
    showWAToast('❌ Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '📲 Send on WhatsApp';
  }
}

// ── BUILD HTML ───────────────────────────────

function buildQuotationHTML(d) {
  const today = fmtDateDisplay(d.date);
  const mandAcc = d.mandAcc || 0;

  let accRows = '';
  d.selectedAcc.forEach(function(a) {
    accRows += `<tr><td>${a.label}</td><td>₹ ${fmt(a.price)}</td></tr>`;
  });

  const addressFull = [d.address, d.district].filter(Boolean).join(', ');

  return `
<div class="quot-wrap">
  <div class="quot-header">
    <div>
      <div class="quot-company-name">VINAY AUTOMOBILES</div>
      <div class="quot-company-sub">Authorised TVS Dealer</div>
      <div class="quot-company-addr">Darwha Road, Yavatmal, Maharashtra<br>
        ${d.execName ? `<strong>${d.execName}</strong>${d.execMobile ? ' · ' + d.execMobile : ''}<br>` : ''}📞 9130040050</div>
    </div>
    <div style="text-align:right;">
      <div class="quot-brand">TVS</div>
      <div class="quot-brand-sub">Motor Company</div>
    </div>
  </div>

  <div class="quot-heading">QUOTATION</div>
  <div class="quot-meta">
    <div>Quotation No : <span>${d.quotNo}</span></div>
    <div>Date : <span>${today}</span></div>
  </div>

  <div class="quot-body">
    <div class="quot-left">
      <div class="quot-box">
        <div class="quot-box-title">Customer Details</div>
        <div class="quot-box-body">
          <div class="quot-field"><strong>Name :</strong> <span>${d.custName}</span></div>
          <div class="quot-field"><strong>Mobile :</strong> <span>${d.mobile}</span></div>
          ${addressFull ? `<div class="quot-field"><strong>Address :</strong> <span>${addressFull}</span></div>` : ''}
        </div>
      </div>
      <div class="quot-box">
        <div class="quot-box-title">Model</div>
        <div class="quot-box-body">
          <div class="quot-field"><strong>Model :</strong> <span>${d.model} ${d.variant}</span></div>
          <div class="quot-field"><strong>Color :</strong> <span>${d.color}</span></div>
          ${getMandatoryAccDescription(d.model) ? `<div style="margin-top:8px;font-size:11px;color:#444;">Standard Accessories: ${getMandatoryAccDescription(d.model)}</div>` : ''}
          ${d.execName ? `<div style="margin-top:8px;padding-top:7px;border-top:1.5px dashed #bbb;font-size:12px;color:#222;font-weight:700;">Executive : ${d.execName}${d.execMobile ? '<span style="font-weight:500;color:#444;"> · ' + d.execMobile + '</span>' : ''}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="quot-right">
      <div class="quot-box">
        <div class="quot-box-title">Price</div>
        <div class="quot-box-body" style="padding:0;">
          <table class="quot-price-table">
            <thead><tr><th>Type</th><th>Amount (Rs.)</th></tr></thead>
            <tbody>
              <tr><td>Ex-showroom Price</td><td>₹ ${fmt(d.exShowroom)}</td></tr>
              ${d.insurance > 0 ? `<tr><td>Insurance (1Y PA, 1Y OD, 5Y TP)</td><td>₹ ${fmt(d.insurance)}</td></tr>` : ''}
              ${d.rto > 0 ? `<tr><td>Road Tax</td><td>₹ ${fmt(d.rto)}</td></tr>` : ''}
              ${mandAcc > 0 ? `<tr><td>Standard Accessories<br><span style="font-size:10px;color:#555;">${getMandatoryAccDescription(d.model)}</span></td><td>₹ ${fmt(mandAcc)}</td></tr>` : ''}
              ${d.pdi > 0 ? `<tr><td>Service Charge</td><td>₹ ${fmt(d.pdi)}</td></tr>` : ''}
              <tr class="total-row"><td><strong>Product Total</strong></td><td><strong>₹ ${fmt(d.productTotal)}</strong></td></tr>
              ${d.selectedAcc.length > 0 ? `
                <tr class="section-header"><td colspan="2"><strong>Extra Accessories</strong></td></tr>
                ${accRows}
                <tr class="total-row"><td><strong>Accessories Total</strong></td><td><strong>₹ ${fmt(d.accTotal)}</strong></td></tr>
              ` : ''}
              ${d.hypothecationCharge > 0 ? `<tr><td>Hypothecation Charge</td><td>₹ ${fmt(d.hypothecationCharge)}</td></tr>` : ''}
              ${d.discount > 0 ? `<tr><td style="color:#ef5350;"><strong>Discount</strong></td><td style="color:#ef5350;"><strong>- ₹ ${fmt(d.discount)}</strong></td></tr>` : ''}
              <tr class="grand-total"><td><strong>Final Total</strong></td><td><strong>₹ ${fmt(d.grandTotal)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <div class="quot-desc" style="margin-top:10px;">
    <div class="quot-desc-title">🏦 Bank Details (for Online Transfer)</div>
    <div class="quot-desc-body" style="display:flex;gap:24px;flex-wrap:wrap;">
      <div><strong>Bank Name :</strong> HDFC Bank</div>
      <div><strong>Account No :</strong> 50200038743479</div>
      <div><strong>IFSC :</strong> HDFC0001017</div>
      <div><strong>Branch :</strong> Yavatmal</div>
      <div><strong>Account Name :</strong> Vinay Automobiles</div>
    </div>
  </div>
  <div class="quot-terms">
    <strong>Terms and Conditions:</strong>
    <ol>
      <li>Prices, taxes, duties &amp; any other Govt. levies, R.T.O., Insurance, Road Tax etc. are subject to change without notice at the time of delivery.</li>
      <li>Booking subject to availability.</li>
      <li>All the above Terms &amp; Conditions of Sales are subject to change without notice.</li>
      <li>All matters are subject to Yavatmal jurisdiction only.</li>
    </ol>
  </div>
  <div class="quot-company-footer">Vinay Automobiles — Darwha Road, Yavatmal, Maharashtra | Authorised TVS Dealer</div>
</div>`;
}

// ── COMPARISON QUOTATION ────────────────────

function buildComparisonQuotationHTML(d) {
  const today = fmtDateDisplay(d.date);
  const v1 = d.v1, v2 = d.v2;
  const fmtOrDash = function(n) { return n > 0 ? '₹ ' + fmt(n) : '—'; };

  // Build accessory rows
  let accRows = '';
  if (d.compAcc && d.compAcc.length > 0) {
    accRows += `<tr class="section-header"><td colspan="3"><strong>Extra Accessories</strong></td></tr>`;
    d.compAcc.forEach(function(a) {
      accRows += `<tr><td>${a.label}</td><td>${fmtOrDash(a.p1)}</td><td>${fmtOrDash(a.p2)}</td></tr>`;
    });
    accRows += `<tr class="total-row"><td><strong>Accessories Total</strong></td><td><strong>${fmtOrDash(v1.accTotal)}</strong></td><td><strong>${fmtOrDash(v2.accTotal)}</strong></td></tr>`;
  }

  const showRow = function(label, val1, val2) {
    if (val1 <= 0 && val2 <= 0) return '';
    return `<tr><td>${label}</td><td>${fmtOrDash(val1)}</td><td>${fmtOrDash(val2)}</td></tr>`;
  };

  const addressFull = [d.address, d.district].filter(Boolean).join(', ');

  return `
<div class="quot-wrap">
  <div class="quot-header">
    <div>
      <div class="quot-company-name">VINAY AUTOMOBILES</div>
      <div class="quot-company-sub">Authorised TVS Dealer</div>
      <div class="quot-company-addr">Darwha Road, Yavatmal, Maharashtra<br>
        ${d.execName ? `<strong>${d.execName}</strong>${d.execMobile ? ' · ' + d.execMobile : ''}<br>` : ''}📞 9130040050</div>
    </div>
    <div style="text-align:right;">
      <div class="quot-brand">TVS</div>
      <div class="quot-brand-sub">Motor Company</div>
    </div>
  </div>

  <div class="quot-heading">COMPARISON QUOTATION</div>
  <div class="quot-meta">
    <div>Quotation No : <span>${d.quotNo}</span></div>
    <div>Date : <span>${today}</span></div>
  </div>

  <!-- Customer row -->
  <div style="border:1px solid #bbb;padding:10px 12px;margin-bottom:12px;font-size:12px;">
    <span style="font-weight:700;margin-right:16px;">Name : ${d.custName}</span>
    <span style="margin-right:16px;">Mobile : ${d.mobile}</span>
    ${addressFull ? `<span>Address : ${addressFull}</span>` : ''}
  </div>

  <!-- Comparison Table -->
  <table class="quot-price-table" style="width:100%;">
    <thead>
      <tr>
        <th style="width:38%;">Item</th>
        <th style="width:31%;text-align:center;background:#e0e0e0;">${v1.model}<br><span style="font-size:10px;font-weight:500;">${v1.variant}</span></th>
        <th style="width:31%;text-align:center;background:#c8c8c8;">${v2.model}<br><span style="font-size:10px;font-weight:500;">${v2.variant}</span></th>
      </tr>
    </thead>
    <tbody>
      <tr style="background:#f5f5f5;">
        <td>Color</td>
        <td style="text-align:center;">${v1.color}</td>
        <td style="text-align:center;">${v2.color}</td>
      </tr>
      ${showRow('Ex-Showroom Price', v1.exShowroom, v2.exShowroom)}
      ${showRow('Insurance', v1.insurance, v2.insurance)}
      ${showRow('Road Tax', v1.rto, v2.rto)}
      ${v1.mandAcc > 0 || v2.mandAcc > 0 ? `<tr><td>Standard Accessories<br><span style="font-size:10px;color:#555;">${getMandatoryAccDescription(v1.model)}</span></td><td>${fmtOrDash(v1.mandAcc)}</td><td>${fmtOrDash(v2.mandAcc)}</td></tr>` : ''}
      ${showRow('Service Charge', v1.pdi, v2.pdi)}
      <tr class="total-row">
        <td><strong>Product Total</strong></td>
        <td style="background:#e0e0e0;"><strong>₹ ${fmt(v1.productTotal)}</strong></td>
        <td style="background:#c8c8c8;"><strong>₹ ${fmt(v2.productTotal)}</strong></td>
      </tr>
      ${accRows}
      ${v1.hypothecationCharge > 0 || v2.hypothecationCharge > 0 ? showRow('Hypothecation Charge', v1.hypothecationCharge, v2.hypothecationCharge) : ''}
      ${v1.discount > 0 || v2.discount > 0 ? `<tr><td><strong>Discount</strong></td><td><strong>- ₹ ${fmt(v1.discount)}</strong></td><td><strong>- ₹ ${fmt(v2.discount)}</strong></td></tr>` : ''}
      <tr class="grand-total">
        <td><strong>Final Total</strong></td>
        <td style="background:#222;"><strong>₹ ${fmt(v1.grandTotal)}</strong></td>
        <td style="background:#444;"><strong>₹ ${fmt(v2.grandTotal)}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="quot-desc" style="margin-top:12px;">
    <div class="quot-desc-title">🏦 Bank Details (for Online Transfer)</div>
    <div class="quot-desc-body" style="display:flex;gap:24px;flex-wrap:wrap;">
      <div><strong>Bank Name :</strong> HDFC Bank</div>
      <div><strong>Account No :</strong> 50200038743479</div>
      <div><strong>IFSC :</strong> HDFC0001017</div>
      <div><strong>Branch :</strong> Yavatmal</div>
      <div><strong>Account Name :</strong> Vinay Automobiles</div>
    </div>
  </div>
  <div class="quot-terms">
    <strong>Terms and Conditions:</strong>
    <ol>
      <li>Prices, taxes, duties &amp; any other Govt. levies are subject to change without notice at time of delivery.</li>
      <li>Booking subject to availability.</li>
      <li>All matters are subject to Yavatmal jurisdiction only.</li>
    </ol>
  </div>
  <div class="quot-company-footer">Vinay Automobiles — Darwha Road, Yavatmal, Maharashtra | Authorised TVS Dealer</div>
</div>`;
}

// ── HELPERS ─────────────────────────────────

function getVehicleType(model) {
  const m = (model || '').toLowerCase();
  if (m.includes('jupiter') || m.includes('ntorq') || m.includes('iqube') || m.includes('zest') || m.includes('orbiter')) return 'SCOOTER';
  return 'MOTORCYCLE';
}

function getMandatoryAccDescription(model) {
  const m = (model || '').toLowerCase();
  const models = ['jupiter', 'ntorq', 'zest', 'orbiter', 'iqube'];
  if (models.some(function(s) { return m.includes(s); }))
    return '<strong>Footrest</strong>, Side Stand, Number Plate Bracket, Centre Stand';
  return '<strong>Footrest</strong>, Side Stand, Number Plate Bracket';
}

// ── FOLLOW-UP DATE LIMITS ────────────────────
// Restrict a date input to today … today+10 days only

function _setFollowUpDateLimits(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const today = new Date();
  const max10  = new Date(today);
  max10.setDate(today.getDate() + 10);
  const toISO = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  el.min = toISO(today);
  el.max = toISO(max10);
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateDisplay(d) {
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
}

function fmtDateStr(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return String(d.getDate()).padStart(2,'0') + '-' + months[d.getMonth()] + '-' + d.getFullYear();
}

function showMessage(text, type) {
  const el = document.getElementById('statusMessage');
  el.textContent = text; el.className = 'message ' + type; el.style.display = 'block';
  if (type === 'success') setTimeout(function() { el.style.display = 'none'; }, 3000);
}

function showWAToast(text, type) {
  const el = document.getElementById('waToast');
  if (!el) { showMessage(text, type); return; }
  const isSuccess = type === 'success';
  el.textContent  = text;
  el.style.background   = isSuccess ? '#25D366' : '#ef5350';
  el.style.color        = 'white';
  el.style.display      = 'block';
  el.style.opacity      = '1';
  clearTimeout(el._waTimer);
  el._waTimer = setTimeout(function() {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.5s';
    setTimeout(function() { el.style.display = 'none'; el.style.transition = ''; }, 500);
  }, isSuccess ? 4000 : 6000);
}

function goBack() {
  if (leadId) window.location.href = 'crm-detail.html?leadId=' + leadId;
  else window.location.href = 'crm.html';
}


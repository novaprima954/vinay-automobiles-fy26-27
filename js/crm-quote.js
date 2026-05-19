// ==========================================
// CRM QUOTATION GENERATOR  v1
// ==========================================

let currentUser = null;
let leadId = null;
let priceDetails = null;

// Accessory config: key matches PriceMaster field, label shown on quotation
const ACC_CONFIG = [
  { key: 'guardPrice',      label: 'All Round Guard' },
  { key: 'gripPrice',       label: 'Grip Cover' },
  { key: 'seatCoverPrice',  label: 'Seat Cover' },
  { key: 'matinPrice',      label: 'Matin' },
  { key: 'tankCoverPrice',  label: 'Tank Cover' },
  { key: 'handleHookPrice', label: 'Handle Hook / Ladies Hook' },
  { key: 'helmetPrice',     label: 'Genuine Helmet' },
  { key: 'rainCoverPrice',  label: 'Rain Cover' },
  { key: 'buzzerPrice',     label: 'Buzzer' },
  { key: 'backRestPrice',   label: 'Back Rest' }
];

document.addEventListener('DOMContentLoaded', async function() {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  currentUser = session.user;

  // Pre-fill from lead if leadId provided
  const urlParams = new URLSearchParams(window.location.search);
  leadId = urlParams.get('leadId');
  if (leadId) await prefillFromLead(leadId);

  await loadModels();
});

// ── PRE-FILL ────────────────────────────────

async function prefillFromLead(id) {
  try {
    const response = await API.getLeadDetails(id);
    if (response.success) {
      const lead = response.lead;
      document.getElementById('custName').value    = lead.customerName || '';
      document.getElementById('custMobile').value  = lead.mobileNo || '';
      document.getElementById('custEmail').value   = lead.email || '';
      document.getElementById('custAddress').value = lead.address || '';
      // Pre-select model if it matches
      if (lead.model) {
        document.getElementById('modelSelect').dataset.prefill = lead.model;
      }
    }
  } catch (e) { /* silent — optional pre-fill */ }
}

// ── MODELS ──────────────────────────────────

async function loadModels() {
  try {
    const response = await API.getPriceMasterModels();
    const sel = document.getElementById('modelSelect');
    if (response.success && response.models) {
      response.models.forEach(function(m) {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = m;
        sel.appendChild(opt);
      });
      // Apply pre-fill if set
      const pre = sel.dataset.prefill;
      if (pre) {
        sel.value = pre;
        if (sel.value) await onModelChange();
      }
    }
  } catch (e) {
    showMessage('Error loading models', 'error');
  }
}

async function onModelChange() {
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
      if (response.variants.length === 1) {
        varSel.value = response.variants[0];
        await onVariantChange();
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

  document.getElementById('accGrid').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('accessoriesCard').style.display = 'block';
  document.getElementById('btnGenerate').disabled = true;

  try {
    const response = await API.getPriceMasterDetails(model, variant);
    if (response.success) {
      priceDetails = response.details;
      renderAccessories(priceDetails);
      recalculate();
      document.getElementById('btnGenerate').disabled = false;
    } else {
      showMessage(response.message, 'error');
    }
  } catch (e) {
    showMessage('Error loading price details', 'error');
  }
}

// ── ACCESSORIES ─────────────────────────────

function renderAccessories(details) {
  const grid = document.getElementById('accGrid');
  grid.innerHTML = '';

  const available = ACC_CONFIG.filter(function(a) { return details[a.key] && Number(details[a.key]) > 0; });

  if (available.length === 0) {
    grid.innerHTML = '<div style="color:#aaa;font-size:13px;grid-column:1/-1;">No optional accessories in PriceMaster for this variant.</div>';
    document.getElementById('summaryBar').style.display = 'block';
    return;
  }

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

  document.getElementById('summaryBar').style.display = 'block';
}

function toggleAcc(el) {
  const cb = el.querySelector('input[type="checkbox"]');
  cb.checked = !cb.checked;
  el.classList.toggle('checked', cb.checked);
  recalculate();
}

function recalculate() {
  if (!priceDetails) return;
  const qty = parseInt(document.getElementById('quantity').value) || 1;

  const exShowroom = Number(priceDetails.exShowroom) || 0;
  const insurance  = Number(priceDetails.insurance)  || 0;
  const rto        = Number(priceDetails.rto)        || 0;
  const pdi        = Number(priceDetails.serviceCharge) || 0;
  const productTotal = exShowroom + insurance + rto + pdi;

  let accTotal = 0;
  document.querySelectorAll('#accGrid input[type="checkbox"]:checked').forEach(function(cb) {
    accTotal += Number(cb.dataset.price) || 0;
  });

  const grandTotal = (productTotal + accTotal) * qty;

  document.getElementById('sumExShowroom').textContent = '₹' + fmt(exShowroom);
  document.getElementById('sumInsurance').textContent  = '₹' + fmt(insurance);
  document.getElementById('sumRto').textContent        = '₹' + fmt(rto);
  document.getElementById('sumPdi').textContent        = '₹' + fmt(pdi);
  document.getElementById('sumAcc').textContent        = '₹' + fmt(accTotal);
  document.getElementById('sumQty').textContent        = qty;
  document.getElementById('sumTotal').textContent      = '₹' + fmt(grandTotal);
}

// ── GENERATE QUOTATION ──────────────────────

async function generateQuotation() {
  // Validate
  const custName = document.getElementById('custName').value.trim();
  const mobile   = document.getElementById('custMobile').value.trim();
  const model    = document.getElementById('modelSelect').value;
  const variant  = document.getElementById('variantSelect').value;

  if (!custName) { showMessage('Please enter customer name', 'error'); return; }
  if (!mobile || !/^\d{10}$/.test(mobile)) { showMessage('Please enter valid 10-digit mobile', 'error'); return; }
  if (!model || !variant) { showMessage('Please select model and variant', 'error'); return; }

  const btn = document.getElementById('btnGenerate');
  btn.disabled = true; btn.textContent = 'Generating...';

  try {
    // Get quotation number
    const qnRes = await API.getNextQuotationNumber();
    const quotNo = qnRes.success ? qnRes.quotNo : 'VA/' + fmtDateStr(new Date()) + '/0001';

    // Collect data
    const qty    = parseInt(document.getElementById('quantity').value) || 1;
    const color  = document.getElementById('vehicleColor').value.trim() || '-';
    const email  = document.getElementById('custEmail').value.trim();
    const address  = document.getElementById('custAddress').value.trim();
    const district = document.getElementById('custDistrict').value.trim();

    const exShowroom = Number(priceDetails.exShowroom) || 0;
    const insurance  = Number(priceDetails.insurance)  || 0;
    const rto        = Number(priceDetails.rto)        || 0;
    const pdi        = Number(priceDetails.serviceCharge) || 0;
    const productTotal = exShowroom + insurance + rto + pdi;

    // Collect selected accessories
    const selectedAcc = [];
    document.querySelectorAll('#accGrid input[type="checkbox"]:checked').forEach(function(cb) {
      const acc = ACC_CONFIG.find(function(a) { return a.key === cb.dataset.key; });
      if (acc) selectedAcc.push({ label: acc.label, price: Number(cb.dataset.price) });
    });
    const accTotal   = selectedAcc.reduce(function(s, a) { return s + a.price; }, 0);
    const grandTotal = (productTotal + accTotal) * qty;

    // Render quotation HTML
    const html = buildQuotationHTML({
      quotNo, date: new Date(), custName, mobile, email, address, district,
      model, variant, color, qty,
      exShowroom, insurance, rto, pdi, productTotal,
      selectedAcc, accTotal, grandTotal
    });

    document.getElementById('quotContent').innerHTML = html;
    document.getElementById('quotPreviewWrapper').style.display = 'block';
    document.getElementById('quotPreviewWrapper').scrollIntoView({ behavior: 'smooth' });

    // Save record silently
    API.saveCRMQuotation({
      quotNo, leadId: leadId || '',
      customerName: custName, model, variant,
      total: grandTotal
    }).catch(function() {});

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

// ── BUILD QUOTATION HTML ────────────────────

function buildQuotationHTML(d) {
  const today = fmtDateDisplay(d.date);

  // Accessories rows
  let accRows = '';
  d.selectedAcc.forEach(function(a) {
    accRows += `<tr><td>${a.label}</td><td>₹ ${fmt(a.price)}</td></tr>`;
  });

  const mandAcc = Number(priceDetails.mandAccessories) || 0;
  let mandAccRow = '';
  if (mandAcc > 0) {
    mandAccRow = `<tr><td>Mandatory Accessories</td><td>₹ ${fmt(mandAcc)}</td></tr>`;
  }

  const addressFull = [d.address, d.district].filter(Boolean).join(', ') || 'Maharashtra';

  return `
<div class="quot-wrap">

  <!-- Company Header -->
  <div class="quot-header">
    <div>
      <div class="quot-company-name">VINAY AUTOMOBILES</div>
      <div class="quot-company-sub">Authorised TVS Dealer</div>
      <div class="quot-company-addr">Yavatmal, Maharashtra</div>
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

  <!-- Two-column body -->
  <div class="quot-body">
    <!-- LEFT -->
    <div class="quot-left">
      <div class="quot-box">
        <div class="quot-box-title">Customer</div>
        <div class="quot-box-body">
          <div class="quot-field"><strong>Name :</strong> <span>${d.custName}</span></div>
          <div class="quot-field"><strong>Mobile :</strong> <span>${d.mobile}</span></div>
          ${d.email ? `<div class="quot-field"><strong>Email :</strong> <span>${d.email}</span></div>` : ''}
          <div class="quot-field"><strong>Address :</strong> <span>${addressFull}</span></div>
        </div>
      </div>
      <div class="quot-box">
        <div class="quot-box-title">Model</div>
        <div class="quot-box-body">
          <div class="quot-field"><strong>Type :</strong> <span>${getVehicleType(d.model)}</span></div>
          <div class="quot-field"><strong>Model :</strong> <span>${d.model} ${d.variant}</span></div>
          <div class="quot-field"><strong>Color :</strong> <span>${d.color}</span></div>
        </div>
      </div>
    </div>

    <!-- RIGHT -->
    <div class="quot-right">
      <div class="quot-box">
        <div class="quot-box-title">Price</div>
        <div class="quot-box-body" style="padding:0;">
          <table class="quot-price-table">
            <thead>
              <tr><th>Type</th><th>Amount (Rs.)</th></tr>
            </thead>
            <tbody>
              <tr><td>Ex-showroom Price</td><td>₹ ${fmt(d.exShowroom)}</td></tr>
              ${d.insurance > 0 ? `<tr><td>Insurance (1st yr Comp. + 4 Yrs TP)</td><td>₹ ${fmt(d.insurance)}</td></tr>` : ''}
              ${d.rto > 0 ? `<tr><td>Registration Fee &amp; Road Tax</td><td>₹ ${fmt(d.rto)}</td></tr>` : ''}
              ${d.pdi > 0 ? `<tr><td>PDI Cost</td><td>₹ ${fmt(d.pdi)}</td></tr>` : ''}
              <tr class="total-row"><td><strong>A. Product Total</strong></td><td><strong>₹ ${fmt(d.productTotal)}</strong></td></tr>

              ${(d.selectedAcc.length > 0 || mandAcc > 0) ? `
                <tr class="section-header"><td colspan="2"><strong>Extra Accessories</strong></td></tr>
                ${mandAccRow}
                ${accRows}
                <tr class="total-row"><td><strong>B. Accessories Total</strong></td><td><strong>₹ ${fmt(d.accTotal + mandAcc)}</strong></td></tr>
              ` : `<tr class="total-row"><td><strong>B. Accessories Total</strong></td><td><strong>₹ 0</strong></td></tr>`}

              <tr><td><strong>C. Quantity</strong></td><td><strong>${d.qty}</strong></td></tr>
              <tr class="total-row"><td><strong>D. Quotation Total (A+B)×C</strong></td><td><strong>₹ ${fmt(d.grandTotal)}</strong></td></tr>
              <tr class="grand-total"><td><strong>Final Offer Total</strong></td><td><strong>₹ ${fmt(d.grandTotal)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div><!-- /quot-body -->

  <!-- Footer note -->
  <div class="quot-footer-note">This is a computer generated quotation — no signature required</div>

  <!-- Terms -->
  <div class="quot-terms">
    <strong>Terms and Conditions:</strong>
    <ol>
      <li>Prices, taxes, duties &amp; any other Govt. levies, R.T.O., Insurance, Road Tax etc. are payable by you and are subject to change without notice at the time of delivery.</li>
      <li>Payment terms — 100% to be made in the name of Vinay Automobiles by cheque / draft which is subject to realization. For online transfer please contact the showroom.</li>
      <li>The company shall not be liable for any loss / damage incurred by you due to any prevention, hindrance or delay in manufacture, delivery of vehicle or accessories, shortage of material, strike, riots, accident, machinery breakdown, government policies, Acts of God and Nature, and all events beyond our control.</li>
      <li>All the above Terms &amp; Conditions of Sales are subject to change without notice.</li>
      <li>For disputes, if any, only the courts of Yavatmal shall have the jurisdiction.</li>
    </ol>
  </div>

  <div class="quot-company-footer">
    Vinay Automobiles — Yavatmal, Maharashtra &nbsp;|&nbsp; Authorised TVS Dealer
  </div>

</div>
  `;
}

// ── HELPERS ─────────────────────────────────

function getVehicleType(model) {
  const m = (model || '').toLowerCase();
  if (m.includes('jupiter') || m.includes('ntorq') || m.includes('iqube')) return 'SCOOTER';
  return 'MOTORCYCLE';
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateDisplay(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
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

function goBack() {
  if (leadId) window.location.href = 'crm-detail.html?leadId=' + leadId;
  else window.location.href = 'crm.html';
}

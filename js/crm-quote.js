// ==========================================
// CRM QUOTATION GENERATOR  v2
// ==========================================

let currentUser = null;
let leadId = null;
let priceDetails = null;
let lastQuotNo = '';

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

  await loadModels(modelHint);
});

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
    if (response.success) {
      const lead = response.lead;
      document.getElementById('custName').value    = lead.customerName || '';
      document.getElementById('custMobile').value  = lead.mobileNo    || '';
      document.getElementById('custEmail').value   = lead.email       || '';
      document.getElementById('custAddress').value = lead.address     || '';
      leadId = lead.leadId;

      // Try to select model
      if (lead.model) {
        const matched = setModelValue(lead.model);
        if (matched) await onModelChange(lead.model);
      }

      // Collapse search box
      document.getElementById('searchBox').style.display = 'none';
      document.getElementById('toggleSearchBtn').textContent = '🔍 Search Existing Lead';
      showMessage('✅ Lead details filled from ' + lead.customerName + ' (' + (lead.status || 'available') + ')', 'success');
    } else {
      showMessage(response.message, 'error');
    }
  } catch (e) {
    showMessage('Error searching lead', 'error');
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
  const exShowroom = Number(priceDetails.exShowroom) || 0;
  const insurance  = Number(priceDetails.insurance)  || 0;
  const rto        = Number(priceDetails.rto)        || 0;
  const pdi        = Number(priceDetails.serviceCharge) || 0;
  const mandAcc    = Number(priceDetails.mandAccessories) || 0;
  const productTotal = exShowroom + insurance + rto + pdi + mandAcc;
  const discount   = Math.max(0, Number(document.getElementById('discount').value) || 0);
  const financed   = document.getElementById('isFinanced') && document.getElementById('isFinanced').checked;
  const financeCharge = financed ? 500 : 0;

  let accTotal = 0;
  document.querySelectorAll('#accGrid input[type="checkbox"]:checked').forEach(function(cb) {
    accTotal += Number(cb.dataset.price) || 0;
  });

  const grandTotal = Math.max(0, productTotal + accTotal + financeCharge - discount);
  document.getElementById('sumExShowroom').textContent = '₹' + fmt(exShowroom);
  document.getElementById('sumInsurance').textContent  = '₹' + fmt(insurance);
  document.getElementById('sumRto').textContent        = '₹' + fmt(rto);
  document.getElementById('sumPdi').textContent        = '₹' + fmt(pdi);
  const mandEl = document.getElementById('sumMandAcc');
  if (mandEl) { mandEl.textContent = '₹' + fmt(mandAcc); mandEl.closest('.summary-row').style.display = mandAcc > 0 ? 'flex' : 'none'; }
  document.getElementById('sumAcc').textContent = '₹' + fmt(accTotal);
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

  const btn = document.getElementById('btnGenerate');
  btn.disabled = true; btn.textContent = 'Generating...';

  try {
    // Random 4-digit quotation number
    const quotNo = 'QT' + Math.floor(1000 + Math.random() * 9000);

    const color    = document.getElementById('vehicleColor').value.trim() || '-';
    const address  = document.getElementById('custAddress').value.trim();
    const district = document.getElementById('custDistrict').value.trim();
    const discount = Math.max(0, Number(document.getElementById('discount').value) || 0);
    const financed = document.getElementById('isFinanced') && document.getElementById('isFinanced').checked;
    const financeCharge = financed ? 500 : 0;
    const execName = currentUser ? currentUser.name : '';

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
    const accTotal   = selectedAcc.reduce(function(s, a) { return s + a.price; }, 0);
    const grandTotal = Math.max(0, productTotal + accTotal + financeCharge - discount);

    lastQuotNo = quotNo;
    const html = buildQuotationHTML({
      quotNo, date: new Date(), custName, mobile, address, district,
      model, variant, color, execName,
      exShowroom, insurance, rto, pdi, mandAcc, productTotal,
      selectedAcc, accTotal, financeCharge, discount, grandTotal
    });

    document.getElementById('quotContent').innerHTML = html;
    document.getElementById('quotPreviewWrapper').style.display = 'block';

    // Auto-save new lead to CRM if not already a known lead
    if (!leadId) {
      const crmSource   = document.getElementById('crmSource').value;
      const crmStatus   = document.getElementById('crmStatus').value;
      const crmFollowUp = document.getElementById('crmFollowUp').value;
      const crmNote     = document.getElementById('crmNote').value.trim();
      try {
        const addRes = await API.addLead({
          customerName: custName,
          mobileNo:     mobile,
          address:      [address, district].filter(Boolean).join(', '),
          model:        model,
          source:       crmSource
        });
        if (addRes.success) {
          leadId = addRes.leadId;
          if (crmNote) {
            await API.logCRMInteraction(leadId, 'Note', crmNote).catch(function() {});
          }
          document.getElementById('btnOpenLead').style.display = 'block';
          document.getElementById('crmDetailsSection').style.display = 'none';
        }
      } catch(ce) {}
    }

    document.getElementById('quotPreviewWrapper').scrollIntoView({ behavior: 'smooth' });
    API.saveCRMQuotation({ quotNo, leadId: leadId || '', customerName: custName, model, variant, totalAmount: grandTotal }).catch(function() {});

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
  const custName = (document.getElementById('custName').value || 'Customer')
    .replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const fileName = 'Quotation_' + (lastQuotNo || custName) + '_' + custName + '.pdf';
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

    showMessage('📤 Uploading and sending...', 'info');

    const response = await API.sendQuotationWhatsApp(base64, fileName, customerName, phone, lastQuotNo);

    if (response.success) {
      showMessage('✅ Quotation sent on WhatsApp successfully!', 'success');
    } else {
      showMessage('❌ ' + (response.message || 'Failed to send WhatsApp'), 'error');
    }
  } catch (e) {
    showMessage('Error sending WhatsApp: ' + e.message, 'error');
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
      <div class="quot-company-addr">Darwha Road, Yavatmal, Maharashtra<br>📞 9130040050</div>
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
          ${getMandatoryAccDescription(d.model) ? `<div style="margin-top:8px;padding:6px 10px;background:#fffde7;border:1.5px solid #f9a825;border-radius:5px;font-size:11px;font-weight:800;color:#333;">⭐ Standard Accessories: ${getMandatoryAccDescription(d.model)}</div>` : ''}
          ${d.execName ? `<div style="margin-top:6px;padding-top:5px;border-top:1px dashed #ccc;font-size:10px;color:#555;"><strong>Executive :</strong> ${d.execName}</div>` : ''}
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
              ${mandAcc > 0 ? `<tr style="background:#fffde7;"><td style="font-weight:800;font-size:12px;">⭐ Standard Accessories<br><span style="font-weight:600;font-size:10px;color:#555;">${getMandatoryAccDescription(d.model)}</span></td><td style="font-weight:800;font-size:12px;">₹ ${fmt(mandAcc)}</td></tr>` : ''}
              ${d.pdi > 0 ? `<tr><td>Service Charge</td><td>₹ ${fmt(d.pdi)}</td></tr>` : ''}
              <tr class="total-row"><td><strong>Product Total</strong></td><td><strong>₹ ${fmt(d.productTotal)}</strong></td></tr>
              ${d.selectedAcc.length > 0 ? `
                <tr class="section-header"><td colspan="2"><strong>Extra Accessories</strong></td></tr>
                ${accRows}
                <tr class="total-row"><td><strong>Accessories Total</strong></td><td><strong>₹ ${fmt(d.accTotal)}</strong></td></tr>
              ` : ''}
              ${d.financeCharge > 0 ? `<tr style="background:#f3e5f5;"><td style="font-weight:700;">🏦 Finance Charge</td><td style="font-weight:700;">₹ ${fmt(d.financeCharge)}</td></tr>` : ''}
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

// ── HELPERS ─────────────────────────────────

function getVehicleType(model) {
  const m = (model || '').toLowerCase();
  if (m.includes('jupiter') || m.includes('ntorq') || m.includes('iqube') || m.includes('zest') || m.includes('orbiter')) return 'SCOOTER';
  return 'MOTORCYCLE';
}

function getMandatoryAccDescription(model) {
  const m = (model || '').toLowerCase();
  const models = ['jupiter 110', 'jupiter 125', 'ntorq', 'zest', 'orbiter', 'iqube'];
  if (models.some(function(s) { return m.includes(s); })) return 'Footrest, Side Stand';
  if (m.includes('jupiter')) return 'Footrest, Side Stand'; // fallback for other Jupiter variants
  return '';
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

function goBack() {
  if (leadId) window.location.href = 'crm-detail.html?leadId=' + leadId;
  else window.location.href = 'crm.html';
}


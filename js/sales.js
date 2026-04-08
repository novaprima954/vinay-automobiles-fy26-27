// ==========================================
// SALES FORM WITH PRICEMASTER INTEGRATION
// ==========================================

let currentUser = null;
let priceMasterDetails = null;

document.addEventListener('DOMContentLoaded', async function() {
  console.log('=== SALES FORM WITH PRICEMASTER ===');
  
  // Check authentication
  const session = SessionManager.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  
  currentUser = session.user;
  const execDisplayName = currentUser.name || currentUser.username || '';
  document.getElementById('currentUser').textContent = execDisplayName;
  document.getElementById('executiveName').value = execDisplayName;
  
  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('bookingDate').value = today;
  
  // Load models from PriceMaster
  await loadModels();
  
  // Setup event listeners
  document.getElementById('model').addEventListener('change', handleModelChange);
  document.getElementById('variant').addEventListener('change', handleVariantChange);
  document.getElementById('financierName').addEventListener('change', handleFinancierChange);
  document.getElementById('salesForm').addEventListener('submit', handleSubmit);
  
  // Auto-calculate totals
  setupTotalCalculation();
  
  // Auto-copy receipt number
  document.getElementById('receiptNo').addEventListener('input', function() {
    document.getElementById('receiptNo1').value = this.value;
  });
});

/**
 * Load models from PriceMaster
 */
async function loadModels() {
  console.log('📋 Loading models from PriceMaster...');
  
  try {
    const response = await API.getPriceMasterModels();
    
    console.log('PriceMaster models response:', response);
    
    if (response.success) {
      const modelSelect = document.getElementById('model');
      modelSelect.innerHTML = '<option value="">-- Select --</option>';
      
      response.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
      });
      
      console.log('✅ Loaded', response.models.length, 'models from PriceMaster');
    } else {
      console.error('❌ PriceMaster error:', response.message);
      showMessage('Error loading models: ' + response.message, 'error');
      
      // Fallback to manual list
      const modelSelect = document.getElementById('model');
      modelSelect.innerHTML = `
        <option value="">-- Select --</option>
        <option>Jupiter 110</option>
        <option>Jupiter 125</option>
        <option>Ntorq</option>
        <option>Zest</option>
        <option>Radeon</option>
        <option>Raider</option>
      `;
    }
  } catch (error) {
    console.error('❌ Load models error:', error);
    showMessage('Error loading models from PriceMaster. Using manual list.', 'error');
    
    // Fallback to manual list
    const modelSelect = document.getElementById('model');
    modelSelect.innerHTML = `
      <option value="">-- Select --</option>
      <option>Jupiter 110</option>
      <option>Jupiter 125</option>
      <option>Ntorq</option>
      <option>Zest</option>
      <option>Radeon</option>
      <option>Raider</option>
    `;
  }
}

/**
 * Handle model selection change
 */
async function handleModelChange() {
  const model = this.value;
  const variantSelect = document.getElementById('variant');
  
  // Reset variant and accessories
  variantSelect.innerHTML = '<option value="">-- Loading variants... --</option>';
  document.getElementById('accessoryFields').innerHTML = '';
  priceMasterDetails = null;
  
  if (!model) {
    variantSelect.innerHTML = '<option value="">-- Select Model First --</option>';
    return;
  }
  
  try {
    const response = await API.getPriceMasterVariants(model);
    
    if (response.success) {
      variantSelect.innerHTML = '<option value="">-- Select --</option>';
      
      response.variants.forEach(variant => {
        const option = document.createElement('option');
        option.value = variant;
        option.textContent = variant;
        variantSelect.appendChild(option);
      });
      
      console.log('✅ Loaded', response.variants.length, 'variants for', model);
    } else {
      showMessage('Error loading variants: ' + response.message, 'error');
      variantSelect.innerHTML = '<option value="">-- Error loading --</option>';
    }
  } catch (error) {
    console.error('Load variants error:', error);
    showMessage('Error loading variants', 'error');
  }
}

/**
 * Handle variant selection change
 */
async function handleVariantChange() {
  const model = document.getElementById('model').value;
  const variant = this.value;
  
  // Reset accessories
  document.getElementById('accessoryFields').innerHTML = '';
  priceMasterDetails = null;
  
  if (!model || !variant) {
    return;
  }
  
  try {
    const response = await API.getPriceMasterDetails(model, variant);
    
    if (response.success) {
      priceMasterDetails = response.details;
      renderAccessories(priceMasterDetails);
      console.log('✅ Loaded PriceMaster details for', model, variant);
    } else {
      showMessage('Price not found in PriceMaster for ' + model + ' ' + variant, 'error');
    }
  } catch (error) {
    console.error('Load details error:', error);
    showMessage('Error loading price details', 'error');
  }
}

/**
 * Render accessory checkboxes based on PriceMaster
 */
function renderAccessories(details) {
  const container = document.getElementById('accessoryFields');
  container.innerHTML = '';
  
  const accessories = [
    { key: 'guardPrice', name: 'Guard', id: 'guard' },
    { key: 'gripPrice', name: 'Grip Cover', id: 'grip' },
    { key: 'seatCoverPrice', name: 'Seat Cover', id: 'seatCover' },
    { key: 'matinPrice', name: 'Matin', id: 'matin' },
    { key: 'tankCoverPrice', name: 'Tank Cover', id: 'tankCover' },
    { key: 'handleHookPrice', name: 'Handle Hook', id: 'handleHook' },
    { key: 'rainCoverPrice', name: 'Rain Cover', id: 'rainCover' },
    { key: 'buzzerPrice', name: 'Buzzer', id: 'buzzer' },
    { key: 'backRestPrice', name: 'Back Rest', id: 'backRest' }
  ];
  
  // Render regular checkboxes
  accessories.forEach(acc => {
    if (details[acc.key]) {
      const div = document.createElement('div');
      div.className = 'form-group';
      div.innerHTML = `
        <label>
          <input type="checkbox" id="${acc.id}" name="${acc.id}">
          ${acc.name} (₹${details[acc.key]})
        </label>
      `;
      container.appendChild(div);
    }
  });
  
  // Helmet with quantity
  if (details.helmetPrice) {
    const div = document.createElement('div');
    div.className = 'form-group';
    div.style.gridColumn = '1 / -1';
    div.innerHTML = `
      <label>
        <input type="checkbox" id="helmet" name="helmet">
        Helmet (₹${details.helmetPrice} each)
      </label>
      <select id="helmetQty" style="margin-left: 10px; padding: 8px; display: none;">
        <option value="1">Quantity: 1</option>
        <option value="2">Quantity: 2</option>
      </select>
    `;
    container.appendChild(div);
    
    // Show/hide quantity dropdown
    document.getElementById('helmet').addEventListener('change', function() {
      document.getElementById('helmetQty').style.display = this.checked ? 'inline-block' : 'none';
    });
  }
}

/**
 * Handle financier change
 */
function handleFinancierChange() {
  const financier = this.value;
  const otherInput = document.getElementById('otherFinancierInput');
  
  // Show/hide Other input
  if (financier === 'Other') {
    otherInput.style.display = 'block';
  } else {
    otherInput.style.display = 'none';
    otherInput.value = '';
  }
}

/**
 * Setup total calculation
 */
function setupTotalCalculation() {
  const amountFields = [
    'receipt1Amount', 'receipt2Amount', 'receipt3Amount', 'receipt4Amount', 'disbursedAmount'
  ];
  
  amountFields.forEach(fieldId => {
    document.getElementById(fieldId).addEventListener('input', updateTotals);
  });
}

/**
 * Update payment totals
 */
function updateTotals() {
  const r1 = parseFloat(document.getElementById('receipt1Amount').value) || 0;
  const r2 = parseFloat(document.getElementById('receipt2Amount').value) || 0;
  const r3 = parseFloat(document.getElementById('receipt3Amount').value) || 0;
  const r4 = parseFloat(document.getElementById('receipt4Amount').value) || 0;
  const disbursed = parseFloat(document.getElementById('disbursedAmount').value) || 0;
  
  const cashTotal = r1 + r2 + r3 + r4;
  const grandTotal = cashTotal + disbursed;
  
  document.getElementById('cashTotalDisplay').textContent = '₹' + cashTotal.toFixed(2);
  document.getElementById('disbursedDisplay').textContent = '₹' + disbursed.toFixed(2);
  document.getElementById('totalDisplay').textContent = '₹' + grandTotal.toFixed(2);
}

/**
 * Get accessory values
 */
/**
 * Get accessory values
 * Returns "Yes" for checked, "No" for unchecked (only for rendered accessories)
 * Non-rendered accessories return empty string (blank)
 */
function getAccessoryValues() {
  const values = {
    guard: '',
    gripcover: '',
    seatcover: '',  // Changed from seatCover
    matin: '',
    tankcover: '',  // Changed from tankCover
    handlehook: '',  // Changed from handleHook
    helmet: '',
    raincover: '',
    buzzer: '',
    backrest: ''
  };
  
  // Only set Yes/No for accessories that are actually rendered (exist in DOM)
  const guardEl = document.getElementById('guard');
  if (guardEl) {
    values.guard = guardEl.checked ? 'Yes' : 'No';
  }
  
  const gripEl = document.getElementById('grip');
  if (gripEl) {
    values.gripcover = gripEl.checked ? 'Yes' : 'No';  // Changed from 'grip' to 'gripcover'
  }
  
  const seatCoverEl = document.getElementById('seatCover');
  if (seatCoverEl) {
    values.seatcover = seatCoverEl.checked ? 'Yes' : 'No';  // Changed to seatcover
  }
  
  const matinEl = document.getElementById('matin');
  if (matinEl) {
    values.matin = matinEl.checked ? 'Yes' : 'No';
  }
  
  const tankCoverEl = document.getElementById('tankCover');
  if (tankCoverEl) {
    values.tankcover = tankCoverEl.checked ? 'Yes' : 'No';  // Changed to tankcover
  }
  
  const handleHookEl = document.getElementById('handleHook');
  if (handleHookEl) {
    values.handlehook = handleHookEl.checked ? 'Yes' : 'No';  // Changed to handlehook
  }
  
  const helmetEl = document.getElementById('helmet');
  if (helmetEl && helmetEl.checked) {
    values.helmet = document.getElementById('helmetQty')?.value || '1';
  } else if (helmetEl) {
    values.helmet = 'No';
  }

  const rainCoverEl = document.getElementById('rainCover');
  if (rainCoverEl) {
    values.raincover = rainCoverEl.checked ? 'Yes' : 'No';
  }

  const buzzerEl = document.getElementById('buzzer');
  if (buzzerEl) {
    values.buzzer = buzzerEl.checked ? 'Yes' : 'No';
  }

  const backRestEl = document.getElementById('backRest');
  if (backRestEl) {
    values.backrest = backRestEl.checked ? 'Yes' : 'No';
  }

  return values;
}

/**
 * Handle form submission
 */
async function handleSubmit(e) {
  e.preventDefault();
  
  const financier = document.getElementById('financierName').value;
  let financierFinal = financier;
  
  if (financier === 'Other') {
    const otherValue = document.getElementById('otherFinancierInput').value.trim();
    if (!otherValue) {
      showMessage('Please enter financier name', 'error');
      return;
    }
    financierFinal = otherValue;
  }
  
  const accessories = getAccessoryValues();
  
  console.log('=== ACCESSORY VALUES ===');
  console.log('Guard element exists:', document.getElementById('guard') !== null);
  console.log('Guard value:', accessories.guard);
  console.log('Grip element exists:', document.getElementById('grip') !== null);
  console.log('Grip Cover value:', accessories.gripcover);  // Changed to gripcover
  console.log('Seat Cover element exists:', document.getElementById('seatCover') !== null);
  console.log('Seat Cover value:', accessories.seatcover);  // Changed to seatcover
  console.log('Matin element exists:', document.getElementById('matin') !== null);
  console.log('Matin value:', accessories.matin);
  console.log('Tank Cover element exists:', document.getElementById('tankCover') !== null);
  console.log('Tank Cover value:', accessories.tankcover);  // Changed to tankcover
  console.log('Handle Hook element exists:', document.getElementById('handleHook') !== null);
  console.log('Handle Hook value:', accessories.handlehook);  // Changed to handlehook
  console.log('Helmet element exists:', document.getElementById('helmet') !== null);
  console.log('Helmet value:', accessories.helmet);
  console.log('=== END ACCESSORY VALUES ===');
  
  const data = {
    receiptNo: document.getElementById('receiptNo').value.trim(),
    executiveName: document.getElementById('executiveName').value,
    bookingDate: document.getElementById('bookingDate').value,
    customerName: document.getElementById('customerName').value.trim(),
    mobileNo: document.getElementById('mobileNo').value.trim(),
    model: document.getElementById('model').value,
    variant: document.getElementById('variant').value,
    colour: document.getElementById('colour').value.trim(),
    discount: document.getElementById('discount').value.trim(),
    finalPrice: document.getElementById('finalPrice').value,
    financierName: financierFinal,
    deliveryDate: document.getElementById('deliveryDate').value,
    guard: accessories.guard,
    gripcover: accessories.gripcover,
    seatcover: accessories.seatcover,  // Changed from seatCover
    matin: accessories.matin,
    tankcover: accessories.tankcover,  // Changed from tankCover
    handlehook: accessories.handlehook,  // Changed from handleHook
    helmet: accessories.helmet,
    raincover: accessories.raincover,
    buzzer: accessories.buzzer,
    backrest: accessories.backrest,
    salesRemark: document.getElementById('salesRemark').value.trim(),
    receiptNo1: document.getElementById('receiptNo1').value.trim(),
    receipt1Amount: document.getElementById('receipt1Amount').value,
    receiptNo2: document.getElementById('receiptNo2').value.trim(),
    receipt2Amount: document.getElementById('receipt2Amount').value,
    receiptNo3: document.getElementById('receiptNo3').value.trim(),
    receipt3Amount: document.getElementById('receipt3Amount').value,
    receiptNo4: document.getElementById('receiptNo4').value.trim(),
    receipt4Amount: document.getElementById('receipt4Amount').value,
    doNumber: document.getElementById('doNumber').value.trim(),
    disbursedAmount: document.getElementById('disbursedAmount').value
  };
  
  console.log('Submitting sale:', data);
  
  try {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '🔍 Checking...';

    const sessionId = SessionManager.getSessionId();

    // Block duplicate receipt numbers before saving
    const dupCheck = await API.checkDuplicateReceipt(sessionId, data.receiptNo);
    if (dupCheck.isDuplicate) {
      submitBtn.disabled = false;
      submitBtn.textContent = '💾 Save Sales Entry';
      showMessage('❌ Receipt No ' + data.receiptNo + ' already exists. Duplicate entry not allowed.', 'error');
      document.getElementById('receiptNo').focus();
      return;
    }

    submitBtn.textContent = '💾 Saving...';
    const response = await API.saveSales(sessionId, data);
    
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Save Sales Entry';
    
    if (response.success) {
      showMessage('✅ Sale saved successfully!', 'success');
      
      // Show WhatsApp modal
      setTimeout(() => {
        showWhatsAppModal(data);
      }, 1000);
      
      // Reset form
      setTimeout(() => {
        resetForm();
      }, 3000);
    } else {
      showMessage(response.message || 'Error saving sale', 'error');
    }
  } catch (error) {
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitBtn').textContent = '💾 Save Sales Entry';
    console.error('Submit error:', error);
    showMessage('Error saving sale', 'error');
  }
}

/**
 * Show WhatsApp modal
 */
function showWhatsAppModal(data) {
  // Build accessories list based on what's available for this variant
  let accessoriesText = '';
  
  if (priceMasterDetails) {
    if (priceMasterDetails.guardPrice) {
      accessoriesText += `Guard - ${data.guard}\n`;
    }
    if (priceMasterDetails.gripPrice) {
      accessoriesText += `Grip Cover - ${data.gripcover}\n`;
    }
    if (priceMasterDetails.seatCoverPrice) {
      accessoriesText += `Seat Cover - ${data.seatcover}\n`;  // Changed to seatcover
    }
    if (priceMasterDetails.matinPrice) {
      accessoriesText += `Matin - ${data.matin}\n`;
    }
    if (priceMasterDetails.tankCoverPrice) {
      accessoriesText += `Tank Cover - ${data.tankcover}\n`;  // Changed to tankcover
    }
    if (priceMasterDetails.handleHookPrice) {
      accessoriesText += `Handle Hook - ${data.handlehook}\n`;  // Changed to handlehook
    }
    if (priceMasterDetails.helmetPrice) {
      // Show helmet quantity or No
      const helmetText = (data.helmet && data.helmet !== 'No') ? data.helmet : 'No';
      accessoriesText += `Helmet - ${helmetText}\n`;
    }
    if (priceMasterDetails.rainCoverPrice) {
      accessoriesText += `Rain Cover - ${data.raincover}\n`;
    }
    if (priceMasterDetails.buzzerPrice) {
      accessoriesText += `Buzzer - ${data.buzzer}\n`;
    }
    if (priceMasterDetails.backRestPrice) {
      accessoriesText += `Back Rest - ${data.backrest}`;
    }
  }
  
  // Remove trailing newline if exists
  accessoriesText = accessoriesText.replace(/\n$/, '');
  
  // Calculate total cash collected (sum of all receipts)
  const r1 = parseFloat(data.receipt1Amount) || 0;
  const r2 = parseFloat(data.receipt2Amount) || 0;
  const r3 = parseFloat(data.receipt3Amount) || 0;
  const r4 = parseFloat(data.receipt4Amount) || 0;
  const totalCashCollected = r1 + r2 + r3 + r4;
  
  const message = `Customer Name - ${data.customerName}
Variant - ${data.model} ${data.variant}
Colour - ${data.colour}
Finance - ${data.financierName}
Passing Date - ${data.deliveryDate}
Cash Collected - ₹${totalCashCollected.toLocaleString('en-IN')}
Final price after discount - ${data.finalPrice}
Discount - ${data.discount}
Accessories -
${accessoriesText}`;
  
  document.getElementById('whatsappMessage').textContent = message;
  document.getElementById('whatsappModal').classList.add('show');
  
  // Store for WhatsApp sharing
  window.currentWhatsAppData = {
    message: message
  };
}

/**
 * Share on WhatsApp
 */
function shareOnWhatsApp() {
  if (window.currentWhatsAppData) {
    const message = window.currentWhatsAppData.message;
    
    // Check if it's mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // For mobile devices, open WhatsApp app with message ready to share
      const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
      window.location.href = url;
    } else {
      // For desktop, open WhatsApp Web with message ready to share
      const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
    
    closeWhatsAppModal();
  }
}

/**
 * Close WhatsApp modal
 */
function closeWhatsAppModal() {
  document.getElementById('whatsappModal').classList.remove('show');
}

/**
 * Reset form
 */
function resetForm() {
  document.getElementById('salesForm').reset();
  document.getElementById('executiveName').value = currentUser.name || currentUser.username || '';
  document.getElementById('accessoryFields').innerHTML = '';
  priceMasterDetails = null;
  updateTotals();
  
  // Reset to today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('bookingDate').value = today;
}

/**
 * Show message
 */
function showMessage(text, type) {
  const msgDiv = document.getElementById('statusMessage');
  msgDiv.textContent = text;
  msgDiv.className = 'message ' + type;
  msgDiv.classList.remove('hidden');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  if (type === 'success') {
    setTimeout(() => {
      msgDiv.classList.add('hidden');
    }, 3000);
  }
}

/**
 * Go back
 */
function goBack() {
  window.location.href = 'home.html';
}

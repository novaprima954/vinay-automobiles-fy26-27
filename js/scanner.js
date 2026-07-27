// ==========================================
// VEHICLE SCANNER PAGE LOGIC
// ==========================================

let currentStream = null;
let currentReceiptNo = null;
let currentRecord = null;

let photoStream = null;
let currentPhotoType = null; // 'chassis' or 'vehicle'
let currentPhotoDataUrl = null;
let photoUploadInProgress = false;
let scannerSearchTimer = null;

// ==========================================
// PAGE INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('=== VEHICLE SCANNER PAGE ===');
  
  // Check authentication
  const session = SessionManager.getSession();
  
  if (!session) {
    console.log('âŒ No session - redirecting to login');
    alert('Please login first');
    window.location.href = 'index.html';
    return;
  }
  
  const user = session.user;
  
  // Check role access (only sales and admin)
  if (user.role !== 'admin' && user.role !== 'sales') {
    console.log('âŒ Access denied for role:', user.role);
    alert('Access denied. Only sales executives can access this page.');
    window.location.href = 'home.html';
    return;
  }
  
  console.log('âœ… Access granted:', user.name, '/', user.role);
  
  // Load pending records
  loadPendingRecords();
});

/**
 * Load records that need vehicle number scanning
 */
async function loadPendingRecords() {
  const sessionId = SessionManager.getSessionId();
  const user = SessionManager.getCurrentUser();
  
  console.log('Loading pending vehicle records for:', user.name);
  
  try {
    const response = await API.call('getPendingVehicleRecords', {
      sessionId: sessionId
    });
    
    if (response.success) {
      displayRecords(response.records);
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Error loading records:', error);
    showMessage('Failed to load records', 'error');
  }
}

/**
 * Live search — debounced. Empty/short query reverts to the normal pending list.
 * Search hits ALL of the user's records (not just pending ones), so a record
 * that already had its Engine/Frame saved can still be found to add a missed photo.
 */
function onScannerSearchInput() {
  const query = document.getElementById('scannerSearchInput').value.trim();

  clearTimeout(scannerSearchTimer);
  scannerSearchTimer = setTimeout(async function() {
    if (query.length < 2) {
      loadPendingRecords();
      return;
    }

    const sessionId = SessionManager.getSessionId();
    try {
      const response = await API.call('searchVehicleRecords', {
        sessionId: sessionId,
        query: query
      });

      if (response.success) {
        displayRecords(response.records);
      } else {
        showMessage(response.message, 'error');
      }
    } catch (error) {
      console.error('Search error:', error);
      showMessage('Search failed', 'error');
    }
  }, 300);
}

/**
 * Display records in list
 */
function displayRecords(records) {
  const listContainer = document.getElementById('recordsList');
  const emptyState = document.getElementById('emptyState');

  if (!records || records.length === 0) {
    listContainer.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  listContainer.style.display = 'block';
  emptyState.style.display = 'none';

  // Clear and build individual cards
  listContainer.innerHTML = '';

  records.forEach(function(record) {
    const card = document.createElement('div');
    card.className = 'record-item';
    card.style.cssText = 'background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.10);margin-bottom:12px;padding:15px;cursor:pointer;transition:box-shadow 0.2s,transform 0.2s;';

    card.innerHTML =
      '<div style=”display:flex;gap:15px;align-items:center;”>' +
        '<div class=”scan-icon”>📷</div>' +
        '<div style=”flex:1;”>' +
          '<div style=”font-size:16px;font-weight:700;color:#333;margin-bottom:3px;”>' + (record.customerName || '-') + '</div>' +
          (record.variant ? '<div style=”font-size:13px;color:#667eea;font-weight:600;margin-bottom:3px;”>' + record.variant + '</div>' : '') +
          '<div style=”font-size:13px;color:#666;margin-bottom:3px;”>📱 ' + (record.mobileNo || '-') + '</div>' +
          '<div style=”font-size:12px;color:#999;”>Receipt: ' + (record.receiptNo || '-') + ' &nbsp;·&nbsp; ' + (record.bookingDate || '') + '</div>' +
        '</div>' +
        '<div style=”color:#667eea;font-size:20px;”>›</div>' +
      '</div>';

    // Hover effect
    card.addEventListener('mouseenter', function() {
      card.style.boxShadow = '0 4px 16px rgba(102,126,234,0.25)';
      card.style.transform = 'translateY(-2px)';
    });
    card.addEventListener('mouseleave', function() {
      card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
      card.style.transform = 'translateY(0)';
    });

    // Click — use data stored in closure, no string escaping needed
    var receiptNo = String(record.receiptNo || '');
    card.addEventListener('click', function() {
      openScanner(receiptNo);
    });

    listContainer.appendChild(card);
  });
}

/**
 * Open scanner modal for a record
 */
async function openScanner(receiptNo) {
  currentReceiptNo = receiptNo;
  
  const sessionId = SessionManager.getSessionId();
  
  try {
    // Get full record details
    const response = await API.call('getRecordByReceiptNo', {
      sessionId: sessionId,
      receiptNo: receiptNo
    });
    
    if (response.success) {
      currentRecord = response.record;
      
      // Populate modal
      document.getElementById('modalReceiptNo').textContent = currentRecord.receiptNo;
      document.getElementById('modalCustomer').textContent = currentRecord.customerName;
      document.getElementById('modalMobile').textContent = currentRecord.mobileNo;
      
      // Pre-fill if already exists
      document.getElementById('engineNumber').value = currentRecord.engineNumber || '';
      document.getElementById('frameNumber').value = currentRecord.frameNumber || '';
      
      // Show modal
      document.getElementById('scannerModal').classList.add('active');

      // Reset camera state
      resetCameraState();

      // Reflect existing photo status
      resetPhotoCaptureState();
      updatePhotoActionUI('chassis', currentRecord.chassisPhotoSaved === 'Yes');
      updatePhotoActionUI('vehicle', currentRecord.vehiclePhotoSaved === 'Yes');

    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Error loading record:', error);
    showMessage('Failed to load record details', 'error');
  }
}

/**
 * Close scanner modal
 */
function closeScanner() {
  // Stop camera if running
  stopCamera();
  stopPhotoCamera();

  // Hide modal
  document.getElementById('scannerModal').classList.remove('active');

  // Clear current record
  currentReceiptNo = null;
  currentRecord = null;
}

// ==========================================
// CHASSIS / VEHICLE PHOTO CAPTURE
// ==========================================

function resetPhotoCaptureState() {
  currentPhotoType = null;
  currentPhotoDataUrl = null;
  photoUploadInProgress = false;
  stopPhotoCamera();

  document.getElementById('photoCapturePanel').classList.remove('active');
  document.getElementById('photoVideoElement').style.display = 'block';
  document.getElementById('photoCapturedImage').style.display = 'none';
  document.getElementById('photoCaptureBtn').style.display = 'block';
  document.getElementById('photoRetakeBtn').style.display = 'none';

  const saveBtn = document.getElementById('photoSaveBtn');
  saveBtn.style.display = 'none';
  saveBtn.disabled = false;
  saveBtn.textContent = '💾 Save Photo';
}

function updatePhotoActionUI(photoType, isSaved) {
  const el = document.getElementById(photoType + 'PhotoAction');
  if (!el) return;

  if (isSaved) {
    el.innerHTML = '<span class="photo-saved-badge">✅ Saved</span>';
  } else {
    const label = photoType === 'chassis' ? '📦' : '🏍️';
    el.innerHTML = '<button class="btn-photo-action" onclick="openPhotoCapture(\'' + photoType + '\')">📷 Take Photo</button>';
  }
}

async function openPhotoCapture(photoType) {
  if (photoUploadInProgress) {
    alert('Please wait for the current photo to finish saving first.');
    return;
  }

  // Defensively release any stream left over from the other photo type
  stopPhotoCamera();

  currentPhotoType = photoType;
  currentPhotoDataUrl = null;

  const panel = document.getElementById('photoCapturePanel');
  panel.classList.add('active');
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const video = document.getElementById('photoVideoElement');
  const image = document.getElementById('photoCapturedImage');
  video.style.display = 'block';
  image.style.display = 'none';
  document.getElementById('photoCaptureBtn').style.display = 'block';
  document.getElementById('photoRetakeBtn').style.display = 'none';
  document.getElementById('photoSaveBtn').style.display = 'none';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    photoStream = stream;
    video.srcObject = stream;
  } catch (error) {
    console.error('Camera error:', error);
    alert('Failed to access camera. Please ensure camera permissions are granted.');
  }
}

function stopPhotoCamera() {
  if (photoStream) {
    photoStream.getTracks().forEach(function(track) { track.stop(); });
    photoStream = null;
  }
}

function capturePhotoImage() {
  const video = document.getElementById('photoVideoElement');
  const image = document.getElementById('photoCapturedImage');

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  currentPhotoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  image.src = currentPhotoDataUrl;

  video.style.display = 'none';
  image.style.display = 'block';
  document.getElementById('photoCaptureBtn').style.display = 'none';
  document.getElementById('photoRetakeBtn').style.display = 'block';
  document.getElementById('photoSaveBtn').style.display = 'block';

  stopPhotoCamera();
}

function retakePhotoImage() {
  openPhotoCapture(currentPhotoType);
}

async function savePhotoAsPdf() {
  if (!currentPhotoDataUrl || !currentPhotoType || photoUploadInProgress) return;

  // Capture locally — currentPhotoType is a shared global and must not be
  // trusted after the upload's await, in case the user switches photo type mid-upload.
  const photoType = currentPhotoType;
  const photoDataUrl = currentPhotoDataUrl;

  photoUploadInProgress = true;
  const saveBtn = document.getElementById('photoSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = '⏳ Saving...';

  try {
    // Fit the photo into an A4 page (portrait), same pattern used for the Customer Form PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    pdf.addImage(photoDataUrl, 'JPEG', 0, 0, 210, 297);
    const pdfBase64 = pdf.output('datauristring').split(',')[1];

    const customerName = (currentRecord.customerName || 'Unknown')
      .replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toUpperCase();
    const fileName = customerName + '_' + photoType + '.pdf';

    const sessionId = SessionManager.getSessionId();
    const response = await API.call('uploadScannerPhoto', {
      sessionId: sessionId,
      receiptNo: currentReceiptNo,
      photoType: photoType,
      pdfBase64: pdfBase64,
      fileName: fileName
    });

    if (response.success) {
      showMessage('✅ ' + response.message, 'success');
      if (photoType === 'chassis') currentRecord.chassisPhotoSaved = 'Yes';
      if (photoType === 'vehicle') currentRecord.vehiclePhotoSaved = 'Yes';
      updatePhotoActionUI(photoType, true);
      resetPhotoCaptureState();
    } else {
      showMessage('❌ ' + response.message, 'error');
      photoUploadInProgress = false;
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Photo';
    }
  } catch (error) {
    console.error('Save photo error:', error);
    showMessage('❌ Failed to save photo. Please try again.', 'error');
    photoUploadInProgress = false;
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Save Photo';
  }
}

/**
 * Reset camera state
 */
function resetCameraState() {
  const video = document.getElementById('videoElement');
  const image = document.getElementById('capturedImage');
  const startBtn = document.getElementById('startCameraBtn');
  const captureBtn = document.getElementById('captureBtn');
  const retakeBtn = document.getElementById('retakeBtn');
  const ocrStatus = document.getElementById('ocrStatus');
  
  video.style.display = 'block';
  image.style.display = 'none';
  
  startBtn.style.display = 'block';
  captureBtn.style.display = 'none';
  retakeBtn.style.display = 'none';
  
  ocrStatus.style.display = 'none';
  
  stopCamera();
}

/**
 * Start camera
 */
async function startCamera() {
  const video = document.getElementById('videoElement');
  const startBtn = document.getElementById('startCameraBtn');
  const captureBtn = document.getElementById('captureBtn');
  
  try {
    // Request camera access
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment' // Use back camera on mobile
      }
    });
    
    currentStream = stream;
    video.srcObject = stream;
    
    // Update buttons
    startBtn.style.display = 'none';
    captureBtn.style.display = 'block';
    
    console.log('âœ… Camera started');
    
  } catch (error) {
    console.error('Camera error:', error);
    alert('Failed to access camera. Please ensure camera permissions are granted.');
  }
}

/**
 * Stop camera
 */
function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(function(track) {
      track.stop();
    });
    currentStream = null;
  }
}

/**
 * Capture image from camera
 */
function captureImage() {
  const video = document.getElementById('videoElement');
  const image = document.getElementById('capturedImage');
  const captureBtn = document.getElementById('captureBtn');
  const retakeBtn = document.getElementById('retakeBtn');
  
  // Create canvas to capture frame
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  
  // Convert to image
  const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
  image.src = imageDataUrl;
  
  // Update UI
  video.style.display = 'none';
  image.style.display = 'block';
  captureBtn.style.display = 'none';
  retakeBtn.style.display = 'block';
  
  // Stop camera
  stopCamera();
  
  console.log('ðŸ“¸ Image captured');
  
  // Process with OCR
  processImageWithOCR(imageDataUrl);
}

/**
 * Retake image
 */
function retakeImage() {
  const video = document.getElementById('videoElement');
  const image = document.getElementById('capturedImage');
  const captureBtn = document.getElementById('captureBtn');
  const retakeBtn = document.getElementById('retakeBtn');
  const ocrStatus = document.getElementById('ocrStatus');
  
  // Reset UI
  video.style.display = 'block';
  image.style.display = 'none';
  retakeBtn.style.display = 'none';
  ocrStatus.style.display = 'none';
  
  // Restart camera
  startCamera();
}

/**
 * Process captured image with OCR
 */
async function processImageWithOCR(imageDataUrl) {
  const ocrStatus = document.getElementById('ocrStatus');
  const engineInput = document.getElementById('engineNumber');
  const frameInput = document.getElementById('frameNumber');
  const engineBadge = document.getElementById('engineExtractedBadge');
  const frameBadge = document.getElementById('frameExtractedBadge');
  
  // Show processing status
  ocrStatus.style.display = 'block';
  
  try {
    console.log('ðŸ” Starting OCR processing...');
    
    // Use Tesseract.js to extract text
    const result = await Tesseract.recognize(
      imageDataUrl,
      'eng',
      {
        logger: function(m) {
          if (m.status === 'recognizing text') {
            console.log('OCR Progress:', Math.round(m.progress * 100) + '%');
          }
        }
      }
    );
    
    const text = result.data.text;
    console.log('OCR Result:', text);
    
    // Extract Engine Number (E:)
    const engineMatch = text.match(/E[:\s]*([A-Z0-9]+)/i);
    if (engineMatch && engineMatch[1]) {
      const engineNumber = engineMatch[1].trim().toUpperCase();
      engineInput.value = engineNumber;
      engineBadge.style.display = 'inline-block';
    }

    // Extract Frame Number (F:)
    const frameMatch = text.match(/F[:\s]*([A-Z0-9]+)/i);
    if (frameMatch && frameMatch[1]) {
      const frameNumber = frameMatch[1].trim().toUpperCase();
      frameInput.value = frameNumber;
      frameBadge.style.display = 'inline-block';
    }
    
    // Hide processing status
    ocrStatus.style.display = 'none';
    
    if (engineMatch || frameMatch) {
      showMessage('âœ… Numbers extracted! Please verify and edit if needed.', 'success');
    } else {
      showMessage('âš ï¸ Could not extract numbers automatically. Please enter manually.', 'error');
    }
    
  } catch (error) {
    console.error('OCR Error:', error);
    ocrStatus.style.display = 'none';
    showMessage('OCR failed. Please enter numbers manually.', 'error');
  }
}

/**
 * Save vehicle numbers
 */
async function saveVehicleNumbers() {
  const engineNumber = document.getElementById('engineNumber').value.trim().toUpperCase();
  const frameNumber = document.getElementById('frameNumber').value.trim().toUpperCase();
  const saveBtn = document.getElementById('saveBtn');
  
  // Validate
  if (!engineNumber) {
    alert('âš ï¸ Please enter Engine Number');
    document.getElementById('engineNumber').focus();
    return;
  }
  
  if (!frameNumber) {
    alert('âš ï¸ Please enter Frame Number');
    document.getElementById('frameNumber').focus();
    return;
  }
  
  const sessionId = SessionManager.getSessionId();
  
  saveBtn.disabled = true;
  saveBtn.textContent = 'â³ Saving...';
  
  try {
    const response = await API.call('saveVehicleNumbers', {
      sessionId: sessionId,
      receiptNo: currentReceiptNo,
      engineNumber: engineNumber,
      frameNumber: frameNumber
    });
    
    if (response.success) {
      showMessage('âœ… Vehicle numbers saved successfully!', 'success');
      
      // Close modal after 1 second
      setTimeout(function() {
        closeScanner();
        // Reload records list
        loadPendingRecords();
      }, 1000);
      
    } else {
      showMessage('âŒ ' + response.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'ðŸ’¾ Save Vehicle Numbers';
    }
    
  } catch (error) {
    console.error('Save error:', error);
    showMessage('âŒ Failed to save. Please try again.', 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = 'ðŸ’¾ Save Vehicle Numbers';
  }
}

/**
 * Show message
 */
function showMessage(text, type) {
  const msg = document.getElementById('statusMessage');
  if (!msg) return;
  
  msg.textContent = text;
  msg.className = 'message ' + type;
  msg.classList.remove('hidden');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  if (type === 'success') {
    setTimeout(function() {
      msg.classList.add('hidden');
    }, 3000);
  }
}

/**
 * Go back to home
 */
function goBack() {
  window.location.href = 'home.html';
}
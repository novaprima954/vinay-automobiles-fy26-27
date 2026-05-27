// ==========================================
// ADD LEAD PAGE LOGIC
// ==========================================

let selectedSource = '';

document.addEventListener('DOMContentLoaded', function() {
  console.log('=== ADD LEAD PAGE ===');
  
  // Check authentication
  const session = SessionManager.getSession();
  
  if (!session) {
    console.log('❌ No session - redirecting to login');
    window.location.href = 'index.html';
    return;
  }
  
  console.log('✅ User:', session.user.name);
  
  // Form submission
  document.getElementById('addLeadForm').addEventListener('submit', handleSubmit);
});

/**
 * Select lead source
 */
function selectSource(element) {
  // Remove previous selection
  document.querySelectorAll('.source-option').forEach(opt => {
    opt.classList.remove('selected');
  });
  
  // Add selection to clicked option
  element.classList.add('selected');
  selectedSource = element.getAttribute('data-source');
  document.getElementById('source').value = selectedSource;
  
  console.log('Selected source:', selectedSource);
}

/**
 * Handle form submission
 */
async function handleSubmit(e) {
  e.preventDefault();
  
  // Validate source selection
  if (!selectedSource) {
    showMessage('Please select a lead source', 'error');
    return;
  }
  
  // Get form data
  const data = {
    customerName: document.getElementById('customerName').value.trim(),
    mobileNo: document.getElementById('mobileNo').value.trim(),
    model: document.getElementById('model').value,
    source: selectedSource,
    expectedDate: document.getElementById('expectedDate').value,
    notes: document.getElementById('notes').value.trim()
  };
  
  // Validate required fields
  if (!data.customerName || !data.mobileNo || !data.model) {
    showMessage('Please fill all required fields', 'error');
    return;
  }
  
  // Validate mobile number
  if (!/^[0-9]{10}$/.test(data.mobileNo)) {
    showMessage('Please enter a valid 10-digit mobile number', 'error');
    return;
  }
  
  console.log('Submitting lead:', data);
  
  // Show loading
  showLoading(true);
  
  try {
    const response = await API.addLead(data);
    
    showLoading(false);
    
    if (response.success) {
      showMessage('✅ Lead added successfully!', 'success');

      // Reset form
      document.getElementById('addLeadForm').reset();
      selectedSource = '';
      document.querySelectorAll('.source-option').forEach(opt => {
        opt.classList.remove('selected');
      });

      // Redirect back to CRM after 1.5 seconds
      setTimeout(() => {
        window.location.href = 'crm.html';
      }, 1500);
    } else if (response.isDuplicate) {
      const el = response.existingLead;
      showMessage(
        `⚠️ Duplicate! "${el.customerName}" already exists (${el.status}, assigned to ${el.assignedTo})`,
        'error'
      );
    } else {
      showMessage(response.message || 'Error adding lead', 'error');
    }
  } catch (error) {
    showLoading(false);
    console.error('Add lead error:', error);
    showMessage('Error adding lead. Please try again.', 'error');
  }
}

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  const submitBtn = document.getElementById('submitBtn');
  
  if (show) {
    overlay.classList.add('active');
    submitBtn.disabled = true;
  } else {
    overlay.classList.remove('active');
    submitBtn.disabled = false;
  }
}

/**
 * Show message
 */
function showMessage(text, type) {
  const msgDiv = document.getElementById('statusMessage');
  msgDiv.textContent = text;
  msgDiv.className = 'message ' + type;
  msgDiv.style.display = 'block';
  
  // Scroll to top to show message
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  if (type === 'success') {
    setTimeout(() => {
      msgDiv.style.display = 'none';
    }, 3000);
  }
}

/**
 * Go back to CRM
 */
function goBack() {
  window.location.href = 'crm.html';
}

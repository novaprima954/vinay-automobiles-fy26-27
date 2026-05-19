// ==========================================
// LEAD DETAILS PAGE LOGIC  v2
// ==========================================

let currentLead = null;
let leadId = null;
let currentUser = null;
let selectedMode = 'Call';

document.addEventListener('DOMContentLoaded', async function() {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  currentUser = session.user;

  const urlParams = new URLSearchParams(window.location.search);
  leadId = urlParams.get('leadId');

  if (!leadId) {
    showMessage('Lead ID not found', 'error');
    setTimeout(function() { window.location.href = 'crm.html'; }, 2000);
    return;
  }

  await loadLeadDetails();
  document.getElementById('updateForm').addEventListener('submit', handleUpdate);
});

// ── LOAD ───────────────────────────────────

async function loadLeadDetails() {
  try {
    const response = await API.getLeadDetails(leadId);
    if (response.success) {
      currentLead = response.lead;
      displayLeadDetails(currentLead);
      document.getElementById('loadingState').style.display = 'none';
      document.getElementById('tabsWrapper').style.display = 'block';
    } else {
      showMessage(response.message, 'error');
      setTimeout(function() { window.location.href = 'crm.html'; }, 2000);
    }
  } catch (error) {
    showMessage('Error loading lead details', 'error');
  }
}

// ── DISPLAY ────────────────────────────────

function displayLeadDetails(lead) {
  document.getElementById('leadName').textContent = lead.customerName;

  // Info grid
  document.getElementById('infoMobileText').textContent = lead.mobileNo || '-';
  document.getElementById('infoModel').textContent      = lead.model    || '-';
  document.getElementById('infoSource').textContent     = lead.source   || '-';
  document.getElementById('infoAssigned').textContent   = lead.assignedTo || 'Unassigned';
  document.getElementById('infoCreated').textContent    = (lead.createdDate || '-') + (lead.createdBy ? ' by ' + lead.createdBy : '');
  document.getElementById('infoLastContact').textContent = lead.lastContactDate || '-';

  if (lead.email) {
    document.getElementById('infoEmailRow').style.display = '';
    document.getElementById('infoEmail').textContent = lead.email;
  }
  if (lead.address) {
    document.getElementById('infoAddressRow').style.display = '';
    document.getElementById('infoAddress').textContent = lead.address;
  }

  // Editable fields
  document.getElementById('status').value       = lead.status || '';
  document.getElementById('expectedDate').value = lead.expectedDate ? formatDateForInput(lead.expectedDate) : '';
  document.getElementById('followUpDate').value = lead.followUpDate ? formatDateForInput(lead.followUpDate) : '';
  document.getElementById('notes').value        = lead.notes || '';

  // Lost reason
  if (lead.lostReason) {
    document.getElementById('lostReason').value = lead.lostReason;
  }
  onStatusChange(); // Show/hide lost reason based on current status

  // Aging display in header
  displayAging(lead);

  // Status banner
  displayStatusBanner(lead.status);

  // Convert button
  document.getElementById('btnConvert').style.display = lead.status === 'Hot Lead' ? 'block' : 'none';

  // Clear update note field on reload
  document.getElementById('notes').value = '';
}

function displayAging(lead) {
  const agingEl = document.getElementById('headerAging');
  const statusClass = (lead.status || '').replace(' ', '-').toLowerCase();

  // Calculate aging (days since last contact or created date)
  let agingDays = 0;
  const refDate = lead.lastContactDate && lead.lastContactDate !== '-' ? lead.lastContactDate : lead.createdDate;
  if (refDate && refDate !== '-') {
    const parsed = new Date(refDate);
    if (!isNaN(parsed)) {
      agingDays = Math.max(0, Math.floor((new Date() - parsed) / (24 * 60 * 60 * 1000)));
    }
  }

  const lines = [];
  const agingClass = agingDays >= 14 ? 'danger' : agingDays >= 7 ? 'warn' : '';
  lines.push(`<span class="aging-pill ${agingClass}">🕑 ${agingDays}d inactive</span>`);

  // Overdue check
  if (lead.followUpDate && lead.followUpDate !== '-' && lead.status !== 'Converted' && lead.status !== 'Lost') {
    const followUpParsed = new Date(formatDateForInput(lead.followUpDate));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!isNaN(followUpParsed) && followUpParsed < today) {
      const daysOverdue = Math.floor((today - followUpParsed) / (24 * 60 * 60 * 1000));
      lines.push(`<span class="overdue-pill">⚠️ ${daysOverdue}d overdue</span>`);
    }
  }

  if (lines.length > 0) {
    agingEl.innerHTML = lines.join(' ');
    agingEl.style.display = 'flex';
  }
}

function displayStatusBanner(status) {
  const banner = document.getElementById('statusBanner');
  if (!status) { banner.style.display = 'none'; return; }

  const classMap = {
    'Hot Lead': 'hot', 'New': 'new', 'Interested': 'interested',
    'Negotiating': 'negotiating', 'Contacted': 'contacted',
    'Cold Lead': 'cold', 'Lost': 'lost', 'Converted': 'converted'
  };
  const emojiMap = {
    'Hot Lead': '🔥', 'New': '🆕', 'Interested': '👀', 'Negotiating': '💬',
    'Contacted': '📞', 'Cold Lead': '❄️', 'Lost': '❌', 'Converted': '✅'
  };

  banner.className = 'status-banner ' + (classMap[status] || '');
  banner.innerHTML = `<span>${(emojiMap[status] || '📊')} ${status}</span>`;
  if (currentLead && currentLead.lostReason) {
    banner.innerHTML += `<span style="font-size:12px;font-weight:600;opacity:0.8;">${currentLead.lostReason}</span>`;
  }
  banner.style.display = 'flex';
}

// ── STATUS CHANGE HANDLER ──────────────────

function onStatusChange() {
  const status = document.getElementById('status').value;
  const lostGroup = document.getElementById('lostReasonGroup');
  const followUpReq = document.getElementById('followUpRequired');

  lostGroup.style.display = (status === 'Lost') ? 'block' : 'none';

  // Follow-up date is not required for Cold Lead or Lost
  if (followUpReq) {
    followUpReq.style.display = (status === 'Cold Lead' || status === 'Lost') ? 'none' : 'inline';
  }
}

// ── UPDATE FORM ────────────────────────────

async function handleUpdate(e) {
  e.preventDefault();

  const status     = document.getElementById('status').value;
  const followUpDate = document.getElementById('followUpDate').value;
  const updateNote = document.getElementById('notes').value.trim();

  // Validate lost reason if Lost
  if (status === 'Lost' && !document.getElementById('lostReason').value) {
    showMessage('Please select a reason for loss', 'error');
    return;
  }

  // Follow-up date mandatory for all except Cold Lead and Lost
  if (status !== 'Cold Lead' && status !== 'Lost' && !followUpDate) {
    showMessage('Next follow-up date is required for this status', 'error');
    document.getElementById('followUpDate').focus();
    return;
  }

  // Update note is always mandatory
  if (!updateNote) {
    showMessage('Please enter an update note before saving', 'error');
    document.getElementById('notes').focus();
    return;
  }

  const data = {
    status:       status,
    expectedDate: document.getElementById('expectedDate').value,
    followUpDate: followUpDate,
    notes:        updateNote,
    lostReason:   document.getElementById('lostReason').value || ''
  };

  const btn = document.getElementById('btnUpdate');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const response = await API.updateLead(leadId, data);
    if (response.success) {
      // Auto-log update note as an interaction
      await API.logCRMInteraction(leadId, 'Note', updateNote).catch(function() {});
      showMessage('✅ Lead updated successfully!', 'success');
      await loadLeadDetails();
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showMessage('Error updating lead', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Save Changes';
  }
}

// ── INTERACTIONS TAB ───────────────────────

function selectMode(el) {
  document.querySelectorAll('.mode-chip').forEach(function(c) { c.classList.remove('selected'); });
  el.classList.add('selected');
  selectedMode = el.getAttribute('data-mode');
}

async function loadInteractions() {
  const container = document.getElementById('interactionsList');
  container.innerHTML = '<div class="loading" style="padding:20px;"><div class="spinner"></div><div>Loading...</div></div>';

  try {
    const response = await API.getCRMInteractions(leadId);
    if (response.success) {
      renderInteractions(response.interactions);
    } else {
      container.innerHTML = '<div class="empty-state"><div class="e-icon">📞</div><div class="e-text">Could not load interactions</div></div>';
    }
  } catch (error) {
    container.innerHTML = '<div class="empty-state"><div class="e-icon">⚠️</div><div class="e-text">Error loading interactions</div></div>';
  }
}

function renderInteractions(interactions) {
  const container = document.getElementById('interactionsList');
  if (!interactions || interactions.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="e-icon">📞</div><div class="e-text">No interactions logged yet. Log your first one above.</div></div>';
    return;
  }

  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'interaction-list';

  interactions.forEach(function(item) {
    const modeClass = (item.mode || 'other').toLowerCase().replace(' ', '');
    const modeEmojiMap = { 'call': '📞', 'whatsapp': '💬', 'visit': '🚗', 'other': '📋' };
    const emoji = modeEmojiMap[modeClass] || '📋';

    const div = document.createElement('div');
    div.className = 'interaction-item ' + modeClass;
    div.innerHTML = `
      <div class="interaction-meta">
        <span class="interaction-mode">${emoji} ${item.mode || 'Other'}</span>
        <span class="interaction-time">${item.timestamp || ''}</span>
      </div>
      <div class="interaction-by">👤 ${item.executiveName || '-'}</div>
      ${item.notes ? `<div class="interaction-notes">${escHtml(item.notes)}</div>` : ''}
    `;
    list.appendChild(div);
  });

  container.appendChild(list);
}

async function logInteraction() {
  const notes = document.getElementById('interactionNotes').value.trim();
  if (!notes) {
    showMessage('Please describe the interaction before logging', 'error');
    document.getElementById('interactionNotes').focus();
    return;
  }
  const btn = document.querySelector('.btn-log');
  btn.disabled = true;
  btn.textContent = 'Logging...';

  try {
    const response = await API.logCRMInteraction(leadId, selectedMode, notes);
    if (response.success) {
      document.getElementById('interactionNotes').value = '';
      showMessage('✅ Interaction logged!', 'success');
      await loadInteractions();
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showMessage('Error logging interaction', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Log Interaction';
  }
}


// ── TAB SWITCHING ──────────────────────────

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });

  if (tabName === 'info') {
    document.querySelectorAll('.tab')[0].classList.add('active');
    document.getElementById('infoTab').classList.add('active');
  } else if (tabName === 'interactions') {
    document.querySelectorAll('.tab')[1].classList.add('active');
    document.getElementById('interactionsTab').classList.add('active');
    loadInteractions();
  }
}

// ── ACTIONS ────────────────────────────────

function callLead() {
  if (currentLead && currentLead.mobileNo) {
    window.location.href = 'tel:' + currentLead.mobileNo;
  }
}

function generateQuote() {
  if (!currentLead) return;
  const params = new URLSearchParams({
    leadId:  leadId,
    name:    currentLead.customerName || '',
    mobile:  currentLead.mobileNo    || '',
    email:   currentLead.email       || '',
    address: currentLead.address     || '',
    district: '',
    model:   currentLead.model       || ''
  });
  window.location.href = 'crm-quote.html?' + params.toString();
}

function whatsappLead() {
  if (!currentLead || !currentLead.mobileNo) return;
  const exec  = currentUser ? currentUser.name : 'Team';
  const model = currentLead.model || '';
  const clean = String(currentLead.mobileNo).replace(/\D/g, '');
  const text  = 'Hi ' + (currentLead.customerName || '') + ', This is ' + exec + '. Thanks for enquiring '
    + (model ? model + ' at ' : 'at ') + 'Vinay Automobiles. Please let us know if any further help is required.';
  window.open('https://wa.me/91' + clean + '?text=' + encodeURIComponent(text), '_blank');
}

function copyMobile() {
  if (!currentLead || !currentLead.mobileNo) return;
  navigator.clipboard.writeText(currentLead.mobileNo).then(function() {
    showMessage('📋 Mobile number copied!', 'success');
  }).catch(function() {
    // Fallback
    const el = document.createElement('textarea');
    el.value = currentLead.mobileNo;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showMessage('📋 Mobile number copied!', 'success');
  });
}

async function convertToSale() {
  if (!confirm('Convert this lead to a sale? This will mark the lead as Converted and redirect to Sales Entry.')) return;

  try {
    const response = await API.convertLeadToSale(leadId);
    if (response.success) {
      showMessage('✅ Lead converted! Redirecting...', 'success');
      setTimeout(function() {
        const params = new URLSearchParams({
          customerName: response.leadData.customerName,
          mobileNo:     response.leadData.mobileNo,
          model:        response.leadData.model
        });
        window.location.href = 'sales.html?' + params.toString();
      }, 1500);
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showMessage('Error converting lead', 'error');
  }
}

// ── HELPERS ────────────────────────────────

function formatDateForInput(dateStr) {
  if (!dateStr || dateStr === '-') return '';
  // Try DD-Mon-YYYY or D/M/YYYY or YYYY-MM-DD formats
  const mName = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
  const m1 = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m1) {
    const mo = mName[m1[2].charAt(0).toUpperCase() + m1[2].slice(1).toLowerCase()];
    if (mo) return m1[3] + '-' + String(mo).padStart(2,'0') + '-' + String(m1[1]).padStart(2,'0');
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showMessage(text, type) {
  const el = document.getElementById('statusMessage');
  el.textContent = text;
  el.className = 'message ' + type;
  el.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (type === 'success') setTimeout(function() { el.style.display = 'none'; }, 3000);
}

function goBack() {
  window.location.href = 'crm.html';
}

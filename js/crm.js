// ==========================================
// CRM PAGE LOGIC  v2
// ==========================================

let currentUser = null;
let dashboardData = null;
let myLeadsCache = [];
let availableLeadsCache = [];
let currentFollowupFilter = 'overdue';
let currentStatusFilter = 'all';

document.addEventListener('DOMContentLoaded', async function() {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  currentUser = session.user;
  document.getElementById('currentUser').textContent = currentUser.name;

  // Show admin analytics section
  if (currentUser.role === 'admin') {
    document.getElementById('adminReportsSection').style.display = 'block';
  }

  await loadDashboard();
});

// ── DASHBOARD ──────────────────────────────

async function loadDashboard() {
  try {
    const response = await API.getCRMDashboard();
    if (response.success) {
      dashboardData = response.dashboard;
      displayDashboard(dashboardData);
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showMessage('Error loading dashboard', 'error');
  }
}

function displayDashboard(data) {
  document.getElementById('overdueCount').textContent  = data.overdueCount  || 0;
  document.getElementById('weekCount').textContent     = data.weekFollowUps || 0;
  document.getElementById('availableCount').textContent = data.available    || 0;
  document.getElementById('convertedCount').textContent = data.converted    || 0;

  // Follow-up filter counts
  document.getElementById('fc_overdue').textContent = data.overdueCount   || 0;
  document.getElementById('fc_today').textContent   = (data.urgentFollowUps || []).length;
  document.getElementById('fc_week').textContent    = data.weekFollowUps  || 0;

  // Overdue badge on nav icon
  const overdueNavBadge = document.getElementById('overdueNavBadge');
  if ((data.overdueCount || 0) > 0) {
    overdueNavBadge.textContent = data.overdueCount > 9 ? '9+' : data.overdueCount;
    overdueNavBadge.style.display = 'block';
  } else {
    overdueNavBadge.style.display = 'none';
  }

  // Today's urgent follow-ups section
  const urgentSection = document.getElementById('urgentSection');
  const urgentList = document.getElementById('urgentList');
  if (data.urgentFollowUps && data.urgentFollowUps.length > 0) {
    document.getElementById('todayBadge').textContent = data.urgentFollowUps.length;
    urgentSection.style.display = 'block';
    urgentList.innerHTML = '';
    data.urgentFollowUps.forEach(function(lead) {
      urgentList.appendChild(makeFollowupCard(lead, 'today'));
    });
  } else {
    urgentSection.style.display = 'none';
  }

  // Load analytics for admin
  if (currentUser && currentUser.role === 'admin') {
    loadAnalytics();
  }
}

// ── FOLLOW-UPS TAB ─────────────────────────

function setFollowupFilter(filter, el) {
  currentFollowupFilter = filter;
  document.querySelectorAll('#followupFilterRow .filter-chip').forEach(function(c) { c.classList.remove('active'); });
  el.classList.add('active');
  renderFollowupsList();
}

function renderFollowupsList() {
  if (!dashboardData) return;
  const container = document.getElementById('followupsList');
  container.innerHTML = '';

  let leads = [];
  let type = 'week';

  if (currentFollowupFilter === 'overdue') {
    leads = dashboardData.overdueLeads || [];
    type = 'overdue';
  } else if (currentFollowupFilter === 'today') {
    leads = dashboardData.urgentFollowUps || [];
    type = 'today';
  } else if (currentFollowupFilter === 'week') {
    leads = dashboardData.weekFollowUpLeads || [];
    type = 'week';
  }

  if (leads.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${type === 'overdue' ? '✅' : '📅'}</div>
        <div class="empty-title">${type === 'overdue' ? 'No overdue follow-ups!' : 'No follow-ups scheduled'}</div>
        <div class="empty-sub">${type === 'overdue' ? 'Great work — all follow-ups are on track.' : 'Check back later.'}</div>
      </div>`;
    return;
  }

  leads.forEach(function(lead) {
    container.appendChild(makeFollowupCard(lead, type));
  });
}

function makeFollowupCard(lead, type) {
  const div = document.createElement('div');
  div.className = 'followup-card ' + type;

  let dateBadgeHtml = '';
  if (type === 'overdue') {
    dateBadgeHtml = `<div class="followup-date-badge overdue">⚠️ ${lead.daysOverdue}d overdue</div>`;
  } else if (type === 'today') {
    dateBadgeHtml = `<div class="followup-date-badge today">🔥 Today</div>`;
  } else {
    dateBadgeHtml = `<div class="followup-date-badge week">📅 ${lead.followUpDate || ''}</div>`;
  }

  const assignedInfo = lead.assignedTo ? `👤 ${lead.assignedTo} · ` : '';

  div.innerHTML = `
    <div class="followup-info">
      <div class="followup-name">${lead.name}</div>
      <div class="followup-meta">${assignedInfo}🏍️ ${lead.model || '-'} · 📱 ${lead.mobile || '-'}</div>
      ${dateBadgeHtml}
    </div>
    <button class="btn-open" onclick="viewLeadDetails('${lead.leadId}')">Open →</button>
  `;
  return div;
}

// ── AVAILABLE LEADS TAB ────────────────────

async function loadAvailableLeads() {
  const container = document.getElementById('availableLeads');
  const loading = document.getElementById('availableLoading');

  if (availableLeadsCache.length === 0) loading.style.display = 'block';
  container.innerHTML = '';

  try {
    const response = await API.getAvailableLeads();
    loading.style.display = 'none';

    if (response.success && response.leads.length > 0) {
      availableLeadsCache = response.leads;
      response.leads.forEach(function(lead) {
        container.appendChild(createAvailableLeadCard(lead));
      });
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <div class="empty-title">No available leads</div>
          <div class="empty-sub">All leads are currently assigned</div>
        </div>`;
    }
  } catch (error) {
    loading.style.display = 'none';
    showMessage('Error loading available leads', 'error');
  }
}

function createAvailableLeadCard(lead) {
  const card = document.createElement('div');
  card.className = 'lead-card';
  card.innerHTML = `
    <div class="lead-top">
      <div class="lead-name">${lead.customerName}</div>
      <div class="lead-badges">
        <span class="status-pill" style="background:#e3f2fd;color:#1565c0;">📦 Available</span>
      </div>
    </div>
    <div class="lead-info">
      <div class="lead-info-row">🏍️ ${lead.model || '-'}</div>
      <div class="lead-info-row">📱 ${lead.mobileNo}</div>
      <div class="lead-info-row">📅 Added ${lead.createdDate || '-'}${lead.createdBy ? ' by ' + lead.createdBy : ''}</div>
    </div>
    <div class="lead-actions">
      <button class="btn-act btn-call-act" onclick="callAndClaimLead('${lead.leadId}','${lead.mobileNo}')">📞 CALL</button>
      <button class="btn-act btn-wa-act" onclick="openWhatsApp('${lead.mobileNo}','${escHtml(lead.customerName)}')">💬 WhatsApp</button>
    </div>
  `;
  return card;
}

// ── MY LEADS TAB ───────────────────────────

async function loadMyLeads() {
  const loading = document.getElementById('myLeadsLoading');
  document.getElementById('myLeads').innerHTML = '';

  if (myLeadsCache.length === 0) loading.style.display = 'block';

  try {
    const response = await API.getMyLeads();
    loading.style.display = 'none';

    if (response.success && response.leads.length > 0) {
      myLeadsCache = response.leads;
      updateStatusCounts(myLeadsCache);
      renderMyLeads();
    } else {
      document.getElementById('myLeads').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">No leads assigned</div>
          <div class="empty-sub">Claim available leads to get started</div>
        </div>`;
    }
  } catch (error) {
    loading.style.display = 'none';
    showMessage('Error loading leads', 'error');
  }
}

function updateStatusCounts(leads) {
  const counts = { all: leads.length, 'Hot Lead': 0, 'New': 0, 'Interested': 0,
                   'Negotiating': 0, 'Contacted': 0, 'Cold Lead': 0, 'Lost': 0 };
  leads.forEach(function(l) { if (counts[l.status] !== undefined) counts[l.status]++; });

  document.getElementById('cnt_all').textContent        = counts['all'];
  document.getElementById('cnt_hot').textContent        = counts['Hot Lead'];
  document.getElementById('cnt_new').textContent        = counts['New'];
  document.getElementById('cnt_interested').textContent = counts['Interested'];
  document.getElementById('cnt_negotiating').textContent= counts['Negotiating'];
  document.getElementById('cnt_contacted').textContent  = counts['Contacted'];
  document.getElementById('cnt_cold').textContent       = counts['Cold Lead'];
  document.getElementById('cnt_lost').textContent       = counts['Lost'];
}

function filterMyLeads(status, el) {
  currentStatusFilter = status;
  document.querySelectorAll('#statusFilterRow .filter-chip').forEach(function(c) { c.classList.remove('active'); });
  el.classList.add('active');
  renderMyLeads();
}

function renderMyLeads() {
  const container = document.getElementById('myLeads');
  container.innerHTML = '';

  const filtered = currentStatusFilter === 'all'
    ? myLeadsCache
    : myLeadsCache.filter(function(l) { return l.status === currentStatusFilter; });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No ${currentStatusFilter === 'all' ? '' : currentStatusFilter} leads</div>
        <div class="empty-sub">Try a different filter</div>
      </div>`;
    return;
  }

  // Sort: overdue first, then by agingDays desc
  filtered.sort(function(a, b) {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return (b.agingDays || 0) - (a.agingDays || 0);
  });

  filtered.forEach(function(lead) {
    container.appendChild(createMyLeadCard(lead));
  });
}

function createMyLeadCard(lead) {
  const card = document.createElement('div');

  // Status class
  const statusClassMap = {
    'Hot Lead': 'hot', 'New': 'new', 'Lost': 'lost', 'Converted': 'converted'
  };
  const statusClass = statusClassMap[lead.status] || '';
  card.className = 'lead-card ' + statusClass;

  // Status pill
  const pillClassMap = {
    'Hot Lead': 'pill-hot', 'New': 'pill-new', 'Interested': 'pill-interested',
    'Negotiating': 'pill-negotiating', 'Contacted': 'pill-contacted',
    'Cold Lead': 'pill-cold', 'Lost': 'pill-lost', 'Converted': 'pill-converted'
  };
  const pillClass = pillClassMap[lead.status] || 'pill-new';
  const statusEmojiMap = {
    'Hot Lead': '🔥', 'New': '🆕', 'Interested': '👀', 'Negotiating': '💬',
    'Contacted': '📞', 'Cold Lead': '❄️', 'Lost': '❌', 'Converted': '✅'
  };
  const statusEmoji = statusEmojiMap[lead.status] || '📊';

  // Aging badge
  let agingHtml = '';
  if (lead.agingDays !== undefined && lead.status !== 'Converted' && lead.status !== 'Lost') {
    const agingClass = lead.agingDays >= 14 ? 'danger' : lead.agingDays >= 7 ? 'warn' : '';
    agingHtml = `<span class="aging-badge ${agingClass}">${lead.agingDays}d</span>`;
  }

  // Overdue badge
  const overdueHtml = lead.isOverdue
    ? `<span class="overdue-badge">⚠️ Overdue</span>`
    : '';

  // Follow-up info
  const followUpHtml = lead.followUpDate
    ? `<div class="lead-info-row">📅 Follow-up: <strong>${lead.followUpDate}</strong></div>`
    : '';

  card.innerHTML = `
    <div class="lead-top">
      <div class="lead-name">${escHtml(lead.customerName)}</div>
      <div class="lead-badges">
        ${overdueHtml}
        ${agingHtml}
        <span class="status-pill ${pillClass}">${statusEmoji} ${lead.status}</span>
      </div>
    </div>
    <div class="lead-info">
      <div class="lead-info-row">🏍️ ${lead.model || '-'}</div>
      <div class="lead-info-row">📱 ${lead.mobileNo}</div>
      ${followUpHtml}
    </div>
    <div class="lead-actions">
      <button class="btn-act btn-call-act" onclick="callLead('${lead.mobileNo}')">📞</button>
      <button class="btn-act btn-wa-act" onclick="openWhatsApp('${lead.mobileNo}','${escHtml(lead.customerName)}')">💬</button>
      <button class="btn-act btn-edit-act" style="flex:2;" onclick="viewLeadDetails('${lead.leadId}')">✏️ Open</button>
    </div>
  `;
  return card;
}

// ── ANALYTICS (admin) ──────────────────────

async function loadAnalytics() {
  const container = document.getElementById('analyticsContent');
  container.innerHTML = '<div class="loading" style="padding:16px;"><div class="spinner"></div><div>Loading...</div></div>';

  try {
    const response = await API.getCRMAnalytics();
    if (!response.success) {
      container.innerHTML = `<div style="padding:16px;color:#999;">${response.message}</div>`;
      return;
    }

    const { sourceStats, execStats } = response.analytics;

    // Source effectiveness table
    let srcRows = '';
    sourceStats.forEach(function(s) {
      srcRows += `
        <tr>
          <td><strong>${s.source}</strong></td>
          <td>${s.total}</td>
          <td style="color:#66BB6A;font-weight:700;">${s.converted}</td>
          <td style="color:#ef5350;">${s.lost}</td>
          <td>
            <span class="conv-rate">${s.convRate}%</span>
            <div class="conv-bar"><div class="conv-bar-fill" style="width:${s.convRate}%"></div></div>
          </td>
        </tr>`;
    });

    // Executive performance table
    let execRows = '';
    execStats.forEach(function(e) {
      execRows += `
        <tr>
          <td><strong>${e.executive}</strong></td>
          <td>${e.total}</td>
          <td style="color:#FF7043;font-weight:600;">${e.hotLeads}</td>
          <td style="color:#66BB6A;font-weight:700;">${e.converted}</td>
          <td>
            <span class="conv-rate">${e.convRate}%</span>
            <div class="conv-bar"><div class="conv-bar-fill" style="width:${e.convRate}%"></div></div>
          </td>
        </tr>`;
    });

    container.innerHTML = `
      <div class="analytics-card">
        <div class="analytics-card-title">🎯 Source Effectiveness</div>
        <div style="overflow-x:auto;">
          <table class="analytics-table">
            <thead><tr><th>Source</th><th>Total</th><th>Won</th><th>Lost</th><th>Conv%</th></tr></thead>
            <tbody>${srcRows || '<tr><td colspan="5" style="color:#999;text-align:center;padding:20px;">No data</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="analytics-card">
        <div class="analytics-card-title">👤 Executive Performance</div>
        <div style="overflow-x:auto;">
          <table class="analytics-table">
            <thead><tr><th>Executive</th><th>Total</th><th>🔥Hot</th><th>✅Won</th><th>Conv%</th></tr></thead>
            <tbody>${execRows || '<tr><td colspan="5" style="color:#999;text-align:center;padding:20px;">No data</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div style="padding:16px;color:#999;">Error loading analytics</div>`;
  }
}

// ── TAB NAVIGATION ─────────────────────────

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });

  if (tab === 'dashboard') {
    document.getElementById('dashboardTab').classList.add('active');
    document.getElementById('navDashboard').classList.add('active');
  } else if (tab === 'followups') {
    document.getElementById('followupsTab').classList.add('active');
    document.getElementById('navFollowups').classList.add('active');
    renderFollowupsList();
  } else if (tab === 'available') {
    document.getElementById('availableTab').classList.add('active');
    document.getElementById('navAvailable').classList.add('active');
    loadAvailableLeads();
  } else if (tab === 'myLeads') {
    document.getElementById('myLeadsTab').classList.add('active');
    document.getElementById('navMyLeads').classList.add('active');
    loadMyLeads();
  }
}

// ── ACTIONS ────────────────────────────────

function callLead(mobileNo) {
  window.location.href = 'tel:' + mobileNo;
}

function openWhatsApp(mobileNo, customerName) {
  const msg = encodeURIComponent('Hi ' + customerName + ', this is Vinay Automobiles. ');
  window.open('https://wa.me/91' + mobileNo + '?text=' + msg, '_blank');
}

async function callAndClaimLead(leadId, mobileNo) {
  try {
    showMessage('Claiming lead...', 'success');
    const response = await API.claimLead(leadId, 'Contacted');
    if (response.success) {
      window.location.href = 'tel:' + mobileNo;
      setTimeout(function() {
        window.location.href = 'crm-detail.html?leadId=' + leadId;
      }, 600);
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showMessage('Error claiming lead', 'error');
  }
}

function viewLeadDetails(leadId) {
  window.location.href = 'crm-detail.html?leadId=' + leadId;
}

function addNewLead() {
  window.location.href = 'crm-add.html';
}

// ── HELPERS ────────────────────────────────

function escHtml(str) {
  return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function showMessage(text, type) {
  const el = document.getElementById('statusMessage');
  el.textContent = text;
  el.className = 'message ' + type;
  el.style.display = 'block';
  if (type === 'success') setTimeout(function() { el.style.display = 'none'; }, 3000);
}

function goBack() {
  window.location.href = 'home.html';
}

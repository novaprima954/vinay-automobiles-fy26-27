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

  await loadDashboard();
});

// ── DASHBOARD ──────────────────────────────

async function loadDashboard() {
  // Show cached data instantly if fresh (< 90s)
  try {
    const cached = localStorage.getItem('crm_dash_v3');
    if (cached) {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < 90000) {
        dashboardData = data;
        displayDashboard(data);
        _bgRefreshDashboard(); // refresh in background
        return;
      }
    }
  } catch(ce) {}

  try {
    const response = await API.getCRMDashboard();
    if (response.success) {
      dashboardData = response.dashboard;
      try { localStorage.setItem('crm_dash_v3', JSON.stringify({ data: dashboardData, ts: Date.now() })); } catch(se) {}
      displayDashboard(dashboardData);
    } else {
      showMessage(response.message, 'error');
    }
  } catch (error) {
    showMessage('Error loading dashboard', 'error');
  }
}

async function _bgRefreshDashboard() {
  try {
    const response = await API.getCRMDashboard();
    if (response.success) {
      dashboardData = response.dashboard;
      try { localStorage.setItem('crm_dash_v3', JSON.stringify({ data: dashboardData, ts: Date.now() })); } catch(se) {}
      displayDashboard(dashboardData);
    }
  } catch(e) {}
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
  // Lost count shown once myLeads loads; set placeholder
  document.getElementById('fc_lost').textContent    = '...';

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
    // Exclude Lost leads from overdue — backend does this but double-check client-side
    leads = (dashboardData.overdueLeads || []).filter(function(l) { return l.status !== 'Lost'; });
    type = 'overdue';
  } else if (currentFollowupFilter === 'today') {
    leads = dashboardData.urgentFollowUps || [];
    type = 'today';
  } else if (currentFollowupFilter === 'week') {
    leads = (dashboardData.weekFollowUpLeads || []).filter(function(l) { return l.status !== 'Lost'; });
    type = 'week';
  } else if (currentFollowupFilter === 'lost') {
    // Pull from myLeadsCache — load if needed
    if (myLeadsCache.length === 0) {
      container.innerHTML = '<div class="loading" style="padding-top:30px;"><div class="spinner"></div><div>Loading lost leads...</div></div>';
      loadMyLeads().then(function() {
        // After load, re-render
        renderFollowupsList();
      });
      return;
    }
    leads = myLeadsCache.filter(function(l) { return l.status === 'Lost'; });
    type = 'lost';
  }

  if (leads.length === 0) {
    const msgs = {
      overdue: ['✅', 'No overdue follow-ups!', 'Great work — all follow-ups are on track.'],
      today:   ['🔔', 'No follow-ups today', 'Enjoy the free day!'],
      week:    ['📅', 'No follow-ups this week', 'Check back later.'],
      lost:    ['😔', 'No lost leads', 'Great conversion rate!']
    };
    const m = msgs[type] || msgs['week'];
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${m[0]}</div>
        <div class="empty-title">${m[1]}</div>
        <div class="empty-sub">${m[2]}</div>
      </div>`;
    return;
  }

  leads.forEach(function(lead) {
    container.appendChild(makeFollowupCard(lead, type));
  });
}

function makeFollowupCard(lead, type) {
  const div = document.createElement('div');
  div.className = 'followup-card ' + (type === 'lost' ? 'lost' : type);

  let dateBadgeHtml = '';
  if (type === 'overdue') {
    dateBadgeHtml = `<div class="followup-date-badge overdue">⚠️ ${lead.daysOverdue}d overdue</div>`;
  } else if (type === 'today') {
    dateBadgeHtml = `<div class="followup-date-badge today">🔥 Today</div>`;
  } else if (type === 'lost') {
    const reason = lead.lostReason ? ' · ' + lead.lostReason : '';
    dateBadgeHtml = `<div class="followup-date-badge" style="background:#ffebee;color:#ef5350;">❌ Lost${reason}</div>`;
  } else {
    dateBadgeHtml = `<div class="followup-date-badge week">📅 ${lead.followUpDate || ''}</div>`;
  }

  const assignedInfo = lead.assignedTo ? '👤 ' + lead.assignedTo + ' · ' : '';
  const mobile = lead.mobile || lead.mobileNo || '-';
  const name   = lead.name   || lead.customerName || '-';

  div.innerHTML = `
    <div class="followup-info">
      <div class="followup-name">${name}</div>
      <div class="followup-meta">${assignedInfo}🏍️ ${lead.model || '-'} · 📱 ${mobile}</div>
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
      <button class="btn-act btn-wa-act" onclick="openWhatsApp('${lead.mobileNo}','${escHtml(lead.customerName)}','${escHtml(lead.model||'')}')">💬 WhatsApp</button>
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
  // Also update Lost count in Follow-ups tab
  document.getElementById('fc_lost').textContent        = counts['Lost'];
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
      <button class="btn-act btn-wa-act" onclick="openWhatsApp('${lead.mobileNo}','${escHtml(lead.customerName)}','${escHtml(lead.model||'')}')">💬</button>
      <button class="btn-act btn-edit-act" style="flex:2;" onclick="viewLeadDetails('${lead.leadId}')">✏️ Open</button>
    </div>
  `;
  return card;
}

// ── ANALYTICS (admin) ──────────────────────

async function loadAnalytics() {
  const container = document.getElementById('analyticsContent');
  const titleEl   = document.getElementById('analyticsSection').querySelector('.section-title');
  container.innerHTML = '<div class="loading" style="padding:16px;"><div class="spinner"></div><div>Loading...</div></div>';

  try {
    const response = await API.getCRMAnalytics();
    if (!response.success) {
      container.innerHTML = `<div style="padding:16px;color:#999;">${response.message}</div>`;
      return;
    }

    const { sourceStats, execStats } = response.analytics;
    const isAdmin = response.isAdmin;
    titleEl.textContent = isAdmin ? '📊 Analytics' : '📊 My Performance';

    // Source effectiveness table
    let srcRows = '';
    sourceStats.forEach(function(s) {
      srcRows += `<tr>
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
      const isMe = !isAdmin; // non-admin only sees themselves
      execRows += `<tr style="${isMe ? 'background:#f0f4ff;' : ''}">
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

    const execTableTitle = isAdmin ? '👤 Executive Performance' : '👤 My Stats';

    container.innerHTML = `
      <div class="analytics-card">
        <div class="analytics-card-title">🎯 ${isAdmin ? 'Source Effectiveness' : 'My Leads by Source'}</div>
        <div style="overflow-x:auto;">
          <table class="analytics-table">
            <thead><tr><th>Source</th><th>Total</th><th>Won</th><th>Lost</th><th>Conv%</th></tr></thead>
            <tbody>${srcRows || '<tr><td colspan="5" style="color:#999;text-align:center;padding:20px;">No data yet</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="analytics-card">
        <div class="analytics-card-title">${execTableTitle}</div>
        <div style="overflow-x:auto;">
          <table class="analytics-table">
            <thead><tr><th>${isAdmin ? 'Executive' : 'Name'}</th><th>Total</th><th>🔥Hot</th><th>✅Won</th><th>Conv%</th></tr></thead>
            <tbody>${execRows || '<tr><td colspan="5" style="color:#999;text-align:center;padding:20px;">No data yet</td></tr>'}</tbody>
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

function openWhatsApp(mobileNo, customerName, modelName) {
  const exec = currentUser ? currentUser.name : 'Team';
  const model = modelName || '';
  const text = 'Hi ' + customerName + ', This is ' + exec + '. Thanks for enquiring '
    + (model ? model + ' at ' : 'at ') + 'Vinay Automobiles. Please let us know if any further help is required.';
  window.location.href = 'https://wa.me/91' + mobileNo + '?text=' + encodeURIComponent(text);
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
  window.location.href = 'crm-quote.html';
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

// ── SEARCH MODAL ────────────────────────────

let searchDebounceTimer = null;

function openSearchModal() {
  document.getElementById('searchOverlay').classList.add('open');
  setTimeout(function() { document.getElementById('searchInput').focus(); }, 100);
}

function closeSearchModal() {
  document.getElementById('searchOverlay').classList.remove('open');
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '<div class="search-empty">🔍 Type to search customers or quotation numbers</div>';
}

function handleSearchOverlayClick(e) {
  if (e.target === document.getElementById('searchOverlay')) closeSearchModal();
}

function onSearchInput() {
  clearTimeout(searchDebounceTimer);
  const q = document.getElementById('searchInput').value.trim();
  if (q.length < 2) {
    document.getElementById('searchResults').innerHTML = '<div class="search-empty">🔍 Type to search customers or quotation numbers</div>';
    return;
  }
  searchDebounceTimer = setTimeout(doSearch, 400);
}

async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (q.length < 2) return;

  const container = document.getElementById('searchResults');
  container.innerHTML = '<div class="search-empty"><div class="spinner" style="width:24px;height:24px;border-width:3px;margin:0 auto 8px;display:block;"></div>Searching...</div>';

  try {
    const response = await API.searchCRMLeads(q);
    if (!response.success) {
      container.innerHTML = '<div class="search-empty">' + response.message + '</div>';
      return;
    }
    renderSearchResults(response.leads || [], response.quotation);
  } catch(e) {
    container.innerHTML = '<div class="search-empty">Error searching. Try again.</div>';
  }
}

function renderSearchResults(leads, quotation) {
  const container = document.getElementById('searchResults');
  container.innerHTML = '';

  if (quotation) {
    const qCard = document.createElement('div');
    qCard.className = 'search-quot-card';
    qCard.innerHTML = `
      <div class="search-quot-title">📄 Quotation Found</div>
      <div class="search-quot-row"><strong>${quotation.quotNo}</strong> · ${quotation.date}</div>
      <div class="search-quot-row">👤 ${quotation.customerName} · 🏍️ ${quotation.model} ${quotation.variant || ''}</div>
      <div class="search-quot-row">💰 ₹${Number(quotation.total||0).toLocaleString('en-IN')} · Generated by ${quotation.generatedBy}</div>
      ${quotation.leadId ? '<button onclick="viewLeadDetails(\'' + quotation.leadId + '\');closeSearchModal();" style="margin-top:8px;width:100%;padding:8px;background:#667eea;color:white;border:none;border-radius:7px;font-weight:700;cursor:pointer;">Open Lead →</button>' : ''}
    `;
    container.appendChild(qCard);
  }

  if (leads.length === 0 && !quotation) {
    container.innerHTML = '<div class="search-empty">No results found. Try a different name or mobile.</div>';
    return;
  }

  leads.forEach(function(lead) {
    const statusColors = {
      'Hot Lead': '#fff3e0::#e65100', 'New': '#e3f2fd::#1565c0',
      'Interested': '#e8f5e9::#2e7d32', 'Negotiating': '#f3e5f5::#6a1b9a',
      'Contacted': '#fce4ec::#880e4f', 'Cold Lead': '#eceff1::#546e7a',
      'Lost': '#ffebee::#c62828', 'Converted': '#e8f5e9::#2e7d32'
    };
    const [bg, fg] = (statusColors[lead.status] || '#f5f5f5::#333').split('::');

    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.onclick = function() { viewLeadDetails(lead.leadId); closeSearchModal(); };
    item.innerHTML = `
      <div class="search-result-name">${escHtml(lead.customerName)}</div>
      <div class="search-result-meta">📱 ${lead.mobileNo || '-'} · 🏍️ ${lead.model || '-'}</div>
      <span class="search-result-status" style="background:${bg};color:${fg};">${lead.status || 'Available'}</span>
      ${lead.assignedTo ? '<span style="font-size:11px;color:#aaa;margin-left:6px;">👤 ' + lead.assignedTo + '</span>' : ''}
    `;
    container.appendChild(item);
  });
}

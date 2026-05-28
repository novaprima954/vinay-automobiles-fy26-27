// ==========================================
// CRM SPA  v5
// ==========================================

let currentUser = null;
let dashboardData = null;
let myLeadsAll = [];       // full list from server
let myLeadsFiltered = [];  // after source filter
let currentMyLeadsSourceFilter = 'all';
let currentMyLeadsStatusFilter = 'all';
let poolLeadsCache = [];
let currentFollowupFilter = 'overdue';
let currentFollowupSourceFilter = 'all';  // 'all' | 'walkin' | 'other'
let followupData = { overdue: [], today: [], week: [] };
let selectedNoteType = '';
let selectedStatusChange = '';
let allExecutives = [];   // for admin assign

document.addEventListener('DOMContentLoaded', async function() {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  currentUser = session.user;
  document.getElementById('currentUser').textContent = currentUser.name;

  // Show admin tab if admin
  if (currentUser.role === 'admin') {
    document.getElementById('navAdmin').style.display = '';
    document.getElementById('adminAnalyticsSection').style.display = '';
  }

  await loadDashboard();
});

// ── TAB SWITCHING ──────────────────────────

function switchTab(tab) {
  // Hide all
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const tabMap = {
    dashboard: ['dashboardTab', 'navDashboard'],
    followups:  ['followupsTab', 'navFollowups'],
    pool:       ['poolTab',      'navPool'],
    myLeads:    ['myLeadsTab',   'navMyLeads'],
    admin:      ['adminTab',     'navAdmin'],
  };

  const [contentId, navId] = tabMap[tab] || tabMap.dashboard;
  document.getElementById(contentId).classList.add('active');
  const navEl = document.getElementById(navId);
  if (navEl) navEl.classList.add('active');

  // Lazy loads
  if (tab === 'followups' && dashboardData) renderFollowups(currentFollowupFilter);
  if (tab === 'pool') loadPool();
  if (tab === 'myLeads') loadMyLeads();
  if (tab === 'admin' && currentUser.role === 'admin') loadAdmin();

  window.scrollTo(0, 0);
}

// ── DASHBOARD ──────────────────────────────

async function loadDashboard() {
  try {
    const cached = localStorage.getItem('crm_dash_v5');
    if (cached) {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < 90000) {
        dashboardData = data;
        displayDashboard(data);
        _bgRefreshDashboard();
        return;
      }
    }
  } catch(e) {}

  try {
    const response = await API.getCRMDashboard();
    if (response.success) {
      dashboardData = response.dashboard;
      try { localStorage.setItem('crm_dash_v5', JSON.stringify({ data: dashboardData, ts: Date.now() })); } catch(e) {}
      displayDashboard(dashboardData);
    } else {
      showMessage(response.message || 'Error loading dashboard', 'error');
    }
  } catch(e) {
    showMessage('Error loading dashboard', 'error');
  }
}

async function _bgRefreshDashboard() {
  try {
    const response = await API.getCRMDashboard();
    if (response.success) {
      dashboardData = response.dashboard;
      try { localStorage.setItem('crm_dash_v5', JSON.stringify({ data: dashboardData, ts: Date.now() })); } catch(e) {}
      displayDashboard(dashboardData);
    }
  } catch(e) {}
}

function displayDashboard(data) {
  document.getElementById('overdueCount').textContent = data.overdueCount || 0;
  document.getElementById('weekCount').textContent = (data.urgentCount || 0) + (data.weekFollowUps || 0);
  document.getElementById('availableCount').textContent = data.available || 0;
  document.getElementById('convertedCount').textContent = data.converted || 0;

  // Overdue badge on nav
  const badge = document.getElementById('overdueNavBadge');
  if (data.overdueCount > 0) {
    badge.textContent = data.overdueCount > 99 ? '99+' : data.overdueCount;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }

  // Today's urgent
  const urgentSection = document.getElementById('urgentSection');
  const urgentList = document.getElementById('urgentList');
  const urgent = data.urgentFollowUps || [];
  if (urgent.length > 0) {
    document.getElementById('todayBadge').textContent = urgent.length;
    urgentList.innerHTML = urgent.map(l => followupCardHtml(l, 'today')).join('');
    urgentSection.style.display = '';
  } else {
    urgentSection.style.display = 'none';
  }

  // Sync followup data from dashboard
  followupData.overdue = data.overdueLeads || [];
  followupData.today   = data.urgentFollowUps || [];
  followupData.week    = data.weekFollowUpLeads || [];

  document.getElementById('fc_overdue').textContent = followupData.overdue.length;
  document.getElementById('fc_today').textContent   = followupData.today.length;
  document.getElementById('fc_week').textContent    = followupData.week.length;
}

// ── FOLLOW-UPS ─────────────────────────────

function setFollowupFilter(filter, el) {
  currentFollowupFilter = filter;
  document.querySelectorAll('#followupTypeFilter .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderFollowups(filter);
}

function setFollowupSourceFilter(filter, el) {
  currentFollowupSourceFilter = filter;
  document.querySelectorAll('#followupSourceFilter .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderFollowups(currentFollowupFilter);
}

function renderFollowups(filter) {
  const list = document.getElementById('followupsList');
  let leads = followupData[filter] || [];

  // Apply source sub-filter
  if (currentFollowupSourceFilter === 'walkin') {
    leads = leads.filter(l => l.source && l.source.toLowerCase().includes('walk'));
  } else if (currentFollowupSourceFilter === 'other') {
    leads = leads.filter(l => !l.source || !l.source.toLowerCase().includes('walk'));
  }

  if (leads.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-title">All clear!</div><div class="empty-sub">No ${filter} follow-ups</div></div>`;
    return;
  }

  list.innerHTML = leads.map(l => followupCardHtml(l, filter)).join('');
}

function followupCardHtml(lead, type) {
  const badge = type === 'overdue'
    ? `<span class="followup-date-badge overdue">${lead.daysOverdue || 0}d overdue</span>`
    : type === 'today'
    ? `<span class="followup-date-badge today">Today</span>`
    : `<span class="followup-date-badge week">${lead.followUpDate || ''}</span>`;

  const meta = [lead.model, lead.source, lead.assignedTo].filter(Boolean).map(esc).join(' · ');

  return `<div class="followup-card ${type}" style="flex-direction:column;gap:8px;cursor:default;">
    <div style="display:flex;align-items:center;gap:12px;width:100%;" onclick="openLead('${lead.leadId}')" style="cursor:pointer;">
      <div class="followup-info">
        <div class="followup-name">${esc(lead.customerName)}</div>
        <div class="followup-meta">${meta}</div>
        ${lead.mobileNo ? `<div class="followup-meta">📱 ${esc(lead.mobileNo)}</div>` : ''}
      </div>
      ${badge}
    </div>
    <div style="display:flex;gap:8px;width:100%;">
      <button class="btn-act btn-call-act" style="flex:1;padding:8px;" onclick="callAndLog('${esc(lead.mobileNo || '')}','${lead.leadId}')">📞 Call</button>
      <button class="btn-act btn-log-act"  style="flex:1;padding:8px;" onclick="openLogSheet('${lead.leadId}')">📝 Log</button>
      <button class="btn-act btn-edit-act" style="flex:1;padding:8px;" onclick="openLead('${lead.leadId}')">Details</button>
    </div>
  </div>`;
}

function findCachedLead(leadId) {
  for (const l of myLeadsAll)         if (l.leadId === leadId) return l;
  for (const l of poolLeadsCache)     if (l.leadId === leadId) return l;
  for (const arr of [followupData.overdue, followupData.today, followupData.week])
    for (const l of arr)              if (l.leadId === leadId) return l;
  return null;
}

// ── POOL LEADS ─────────────────────────────

async function loadPool() {
  const container = document.getElementById('poolLeads');
  const loading = document.getElementById('poolLoading');
  loading.style.display = '';
  container.innerHTML = '';

  try {
    const response = await API.getAvailableLeads();
    loading.style.display = 'none';
    if (!response.success) { container.innerHTML = errorHtml(response.message); return; }

    poolLeadsCache = response.leads || [];
    renderPool();
  } catch(e) {
    loading.style.display = 'none';
    container.innerHTML = errorHtml('Error loading pool leads');
  }
}

function renderPool() {
  const container = document.getElementById('poolLeads');
  if (poolLeadsCache.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">Pool is empty</div><div class="empty-sub">All social media leads have been claimed</div></div>`;
    return;
  }

  container.innerHTML = poolLeadsCache.map(l => `
    <div class="lead-card" style="border-left-color:#9C27B0;">
      <div class="lead-top">
        <div class="lead-name">${esc(l.customerName)}</div>
        <div class="lead-badges">
          <span class="status-pill pill-pool">Pool</span>
          ${agingBadgeHtml(l.agingDays)}
        </div>
      </div>
      <div class="lead-info">
        <div class="lead-info-row">📱 ${esc(l.mobileNo)}</div>
        <div class="lead-info-row">🚗 ${esc(l.model)}</div>
        <div class="lead-info-row"><span class="social-badge">📲 ${esc(l.source)}</span></div>
        <div class="lead-info-row" style="color:#aaa;font-size:12px;">Added by ${esc(l.createdBy || '')} · ${esc(l.createdDate || '')}</div>
      </div>
      <div class="lead-actions">
        <button class="btn-act btn-call-act" onclick="callPoolLead('${esc(l.mobileNo || '')}','${l.leadId}')">📞 Call</button>
        <button class="btn-act btn-edit-act" onclick="openLead('${l.leadId}')">Details</button>
      </div>
    </div>
  `).join('');
}

async function claimLead(leadId, name) {
  if (!confirm(`Claim lead for ${name}?`)) return;
  try {
    const r = await API.claimLead(leadId);
    if (r.success) {
      showMessage('Lead claimed — check My Leads', 'success');
      loadPool();
      _bgRefreshDashboard();
    } else {
      showMessage(r.message || 'Error claiming lead', 'error');
    }
  } catch(e) {
    showMessage('Error claiming lead', 'error');
  }
}

// ── MY LEADS ───────────────────────────────

async function loadMyLeads() {
  const loading = document.getElementById('myLeadsLoading');
  loading.style.display = '';

  try {
    const response = await API.getMyLeads();
    loading.style.display = 'none';
    if (!response.success) { document.getElementById('myLeads').innerHTML = errorHtml(response.message); return; }

    myLeadsAll = response.leads || [];
    updateMyLeadsCounts();
    applyMyLeadsFilters();
  } catch(e) {
    loading.style.display = 'none';
    document.getElementById('myLeads').innerHTML = errorHtml('Error loading leads');
  }
}

function updateMyLeadsCounts() {
  const social = myLeadsAll.filter(l => l.isSocial).length;
  const mine   = myLeadsAll.filter(l => !l.isSocial).length;
  document.getElementById('cnt_all').textContent    = myLeadsAll.length;
  document.getElementById('cnt_mine').textContent   = mine;
  document.getElementById('cnt_social').textContent = social;
}

function setMyLeadsFilter(ftype, el) {
  currentMyLeadsSourceFilter = ftype;
  document.querySelectorAll('#myLeadsSourceFilter .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  applyMyLeadsFilters();
}

function filterMyLeadsByStatus(st, el) {
  currentMyLeadsStatusFilter = st;
  document.querySelectorAll('#myLeadsStatusFilter .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  applyMyLeadsFilters();
}

function applyMyLeadsFilters() {
  let leads = myLeadsAll;

  if (currentMyLeadsSourceFilter === 'social') leads = leads.filter(l => l.isSocial);
  else if (currentMyLeadsSourceFilter === 'mine') leads = leads.filter(l => !l.isSocial);

  if (currentMyLeadsStatusFilter !== 'all') {
    leads = leads.filter(l => l.status === currentMyLeadsStatusFilter);
  }

  myLeadsFiltered = leads;
  renderMyLeads();
}

function renderMyLeads() {
  const container = document.getElementById('myLeads');
  if (myLeadsFiltered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No leads</div><div class="empty-sub">No leads match the current filter</div></div>`;
    return;
  }

  container.innerHTML = myLeadsFiltered.map(l => leadCardHtml(l)).join('');
}

function leadCardHtml(lead) {
  const stClass = statusClass(lead.status);
  const overdueClass = lead.isOverdue ? ' overdue-left' : '';
  const overdueBadge = lead.isOverdue ? `<span class="overdue-badge">⚠️ ${lead.daysOverdue}d overdue</span>` : '';
  const socialBadge = lead.isSocial ? `<span class="social-badge">📲 ${esc(lead.source)}</span>` : '';

  return `<div class="lead-card ${stClass}${overdueClass}">
    <div class="lead-top">
      <div class="lead-name">${esc(lead.customerName)}</div>
      <div class="lead-badges">
        <span class="status-pill ${pillClass(lead.status)}">${esc(lead.status)}</span>
        ${overdueBadge}
        ${agingBadgeHtml(lead.agingDays)}
      </div>
    </div>
    <div class="lead-info">
      <div class="lead-info-row">📱 ${esc(lead.mobileNo)}</div>
      <div class="lead-info-row">🚗 ${esc(lead.model)}</div>
      ${lead.followUpDate ? `<div class="lead-info-row">📅 Follow-up: ${esc(lead.followUpDate)}</div>` : ''}
      ${socialBadge ? `<div class="lead-info-row">${socialBadge}</div>` : ''}
      ${lead.assignedTo && currentUser.role === 'admin' ? `<div class="lead-info-row" style="color:#888;font-size:12px;">👤 ${esc(lead.assignedTo)}</div>` : ''}
    </div>
    <div class="lead-actions">
      <button class="btn-act btn-call-act" onclick="callLead('${esc(lead.mobileNo)}')">📞 Call</button>
      <button class="btn-act btn-log-act" onclick="openLogSheet('${lead.leadId}')">📝 Log</button>
      <button class="btn-act btn-edit-act" onclick="openLead('${lead.leadId}')">Details</button>
    </div>
  </div>`;
}

// ── ADMIN TAB ──────────────────────────────

async function loadAdmin() {
  const container = document.getElementById('adminContent');
  const loading = document.getElementById('adminLoading');
  loading.style.display = '';
  container.innerHTML = '';

  try {
    const [leadsResp, analyticsResp] = await Promise.all([
      API.getAllLeads(),
      API.getCRMAnalytics()
    ]);

    loading.style.display = 'none';

    // Build executive list for assign
    if (leadsResp.success) {
      const execSet = new Set();
      (leadsResp.leads || []).forEach(l => { if (l.assignedTo) execSet.add(l.assignedTo); });
      allExecutives = Array.from(execSet);
    }

    let html = '';

    // All Leads table (collapsed by status)
    if (leadsResp.success) {
      const leads = leadsResp.leads || [];
      const statusOrder = ['New','Contacted','Interested','Converted','Lost',''];
      const grouped = {};
      statusOrder.forEach(s => grouped[s] = []);
      leads.forEach(l => {
        const st = l.status || '';
        if (grouped[st]) grouped[st].push(l);
        else grouped[''].push(l);
      });

      html += `<div style="padding:12px 16px 8px;font-size:14px;font-weight:800;color:#333;">All Leads (${leads.length})</div>`;
      statusOrder.forEach(st => {
        const group = grouped[st] || [];
        if (group.length === 0) return;
        const label = st || 'Pool';
        html += `<div style="padding:6px 16px;font-size:12px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;">${label} (${group.length})</div>`;
        html += group.map(l => adminLeadCardHtml(l)).join('');
      });
    }

    // Analytics
    if (analyticsResp.success) {
      const a = analyticsResp.analytics;

      if (a.bySource && a.bySource.length > 0) {
        html += `<div class="analytics-card">
          <div class="analytics-card-title">📲 By Source</div>
          <table class="analytics-table">
            <thead><tr><th>Source</th><th>Total</th><th>Conv</th><th>Conv%</th></tr></thead>
            <tbody>${a.bySource.map(s => `<tr>
              <td>${esc(s.source)}</td>
              <td>${s.total}</td>
              <td>${s.converted}</td>
              <td><span class="conv-rate">${s.convRate}%</span>
                <div class="conv-bar"><div class="conv-bar-fill" style="width:${s.convRate}%"></div></div>
              </td></tr>`).join('')}
            </tbody>
          </table>
        </div>`;
      }

      if (a.byExecutive && a.byExecutive.length > 0) {
        html += `<div class="analytics-card">
          <div class="analytics-card-title">👥 By Executive</div>
          <table class="analytics-table">
            <thead><tr><th>Executive</th><th>Total</th><th>Conv</th><th>Overdue</th><th>Conv%</th></tr></thead>
            <tbody>${a.byExecutive.map(e => `<tr>
              <td>${esc(e.executive)}</td>
              <td>${e.total}</td>
              <td>${e.converted}</td>
              <td>${e.overdue > 0 ? `<span style="color:#ef5350;font-weight:700;">${e.overdue}</span>` : e.overdue}</td>
              <td><span class="conv-rate">${e.convRate}%</span></td></tr>`).join('')}
            </tbody>
          </table>
        </div>`;
      }

      if (a.lostReasons && a.lostReasons.length > 0) {
        html += `<div class="analytics-card">
          <div class="analytics-card-title">❌ Lost Reasons</div>
          ${a.lostReasons.map(r => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f5f5f5;font-size:14px;">
            <span>${esc(r.reason)}</span>
            <span style="font-weight:700;color:#ef5350;">${r.count}</span>
          </div>`).join('')}
        </div>`;
      }
    }

    container.innerHTML = html;
  } catch(e) {
    loading.style.display = 'none';
    container.innerHTML = errorHtml('Error loading admin data');
  }
}

function adminLeadCardHtml(lead) {
  return `<div class="lead-card ${statusClass(lead.status)}" style="margin-bottom:8px;">
    <div class="lead-top">
      <div class="lead-name">${esc(lead.customerName)}</div>
      <div class="lead-badges">
        <span class="status-pill ${pillClass(lead.status)}">${esc(lead.status || 'Pool')}</span>
        ${lead.isOverdue ? '<span class="overdue-badge">Overdue</span>' : ''}
      </div>
    </div>
    <div class="lead-info">
      <div class="lead-info-row">📱 ${esc(lead.mobileNo)} &nbsp;🚗 ${esc(lead.model)}</div>
      <div class="lead-info-row">👤 ${esc(lead.assignedTo || 'Unassigned')} &nbsp;${lead.isSocial ? `<span class="social-badge">📲 ${esc(lead.source)}</span>` : ''}</div>
    </div>
    <div class="lead-actions">
      <button class="btn-act btn-edit-act" onclick="openLead('${lead.leadId}')">Details</button>
      <button class="btn-act btn-log-act" onclick="openAssignSheet('${lead.leadId}')">Assign</button>
    </div>
  </div>`;
}

async function loadAnalytics() {
  const container = document.getElementById('analyticsContent');
  const btn = document.getElementById('analyticsRefreshBtn');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><div>Loading analytics...</div></div>';
  if (btn) btn.disabled = true;

  try {
    const r = await API.getCRMAnalytics();
    if (btn) btn.disabled = false;
    if (!r.success) { container.innerHTML = errorHtml(r.message); return; }

    const a = r.analytics;
    let html = '';

    if (a.bySource && a.bySource.length > 0) {
      html += `<div class="analytics-card">
        <div class="analytics-card-title">📲 By Source</div>
        <table class="analytics-table">
          <thead><tr><th>Source</th><th>Total</th><th>Conv</th><th>Conv%</th></tr></thead>
          <tbody>${a.bySource.map(s => `<tr>
            <td>${esc(s.source)}</td><td>${s.total}</td><td>${s.converted}</td>
            <td><span class="conv-rate">${s.convRate}%</span>
              <div class="conv-bar"><div class="conv-bar-fill" style="width:${s.convRate}%"></div></div>
            </td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }

    if (a.byExecutive && a.byExecutive.length > 0) {
      html += `<div class="analytics-card">
        <div class="analytics-card-title">👥 By Executive</div>
        <table class="analytics-table">
          <thead><tr><th>Executive</th><th>Total</th><th>Conv</th><th>Overdue</th><th>Conv%</th></tr></thead>
          <tbody>${a.byExecutive.map(e => `<tr>
            <td>${esc(e.executive)}</td><td>${e.total}</td><td>${e.converted}</td>
            <td>${e.overdue > 0 ? `<span style="color:#ef5350;font-weight:700;">${e.overdue}</span>` : e.overdue}</td>
            <td><span class="conv-rate">${e.convRate}%</span></td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }

    if (a.lostReasons && a.lostReasons.length > 0) {
      html += `<div class="analytics-card">
        <div class="analytics-card-title">❌ Lost Reasons</div>
        ${a.lostReasons.map(r => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f5f5f5;font-size:14px;">
          <span>${esc(r.reason)}</span>
          <span style="font-weight:700;color:#ef5350;">${r.count}</span>
        </div>`).join('')}
      </div>`;
    }

    container.innerHTML = html || '<div style="padding:20px;color:#aaa;text-align:center;">No analytics data yet</div>';
  } catch(e) {
    if (btn) btn.disabled = false;
    container.innerHTML = errorHtml('Error loading analytics');
  }
}

// ── LEAD DETAIL ────────────────────────────

async function openLead(leadId) {
  openSheet('detailSheet');

  // Show cached basic info instantly while we fetch the full record
  const cached = findCachedLead(leadId);
  if (cached) {
    document.getElementById('detailSheetBody').innerHTML = `
      <div class="lead-detail-header">
        <button class="sheet-close" style="float:right;" onclick="closeSheet('detailSheet')">✕</button>
        <div class="lead-detail-name">${esc(cached.customerName)}</div>
        <div class="lead-detail-meta">
          <span class="status-pill ${pillClass(cached.status)}">${esc(cached.status || 'Pool')}</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-row"><span class="detail-label">Mobile</span><span class="detail-value">${esc(cached.mobileNo || '')}</span></div>
        <div class="detail-row"><span class="detail-label">Model</span><span class="detail-value">${esc(cached.model || '')}</span></div>
        <div class="detail-row"><span class="detail-label">Source</span><span class="detail-value">${esc(cached.source || '')}</span></div>
      </div>
      <div class="loading" style="padding:20px;"><div class="spinner"></div><div>Loading interactions...</div></div>`;
  } else {
    document.getElementById('detailSheetBody').innerHTML = `<div class="loading"><div class="spinner"></div><div>Loading...</div></div>`;
  }

  try {
    const r = await API.getLeadDetails(leadId);
    if (!r.success) { document.getElementById('detailSheetBody').innerHTML = errorHtml(r.message); return; }
    renderLeadDetail(r.lead);
  } catch(e) {
    document.getElementById('detailSheetBody').innerHTML = errorHtml('Error loading lead');
  }
}

function renderLeadDetail(lead) {
  const isAdmin = currentUser.role === 'admin';
  const isOwner = isAdmin || lead.assignedTo === currentUser.name;

  const interactions = (lead.interactions || []).map(i => `
    <div class="interaction-item">
      <span class="interaction-type">${esc(i.type)}</span>
      ${i.note ? `<div class="interaction-note">${esc(i.note)}</div>` : ''}
      <div class="interaction-meta">${esc(i.datetime)} · ${esc(i.by)}</div>
    </div>
  `).join('') || '<div style="color:#aaa;font-size:13px;padding:8px 0;">No interactions yet</div>';

  const quotations = (lead.quotations || []).map(q => `
    <div class="quotation-item" style="display:flex;align-items:center;gap:10px;">
      <div style="flex:1;">
        <div class="quotation-no">${esc(q.quotNo)}</div>
        <div class="quotation-meta">${esc(q.model)} · ₹${Number(q.totalAmount||0).toLocaleString('en-IN')} · ${esc(q.createdDate)}</div>
      </div>
      <a href="crm-quote.html?leadId=${lead.leadId}" style="font-size:12px;font-weight:700;color:#667eea;text-decoration:none;white-space:nowrap;padding:4px 10px;border:1.5px solid #667eea;border-radius:8px;">
        🔁 Reprint
      </a>
    </div>
  `).join('') || '<div style="color:#aaa;font-size:13px;padding:8px 0;">No quotations yet</div>';

  const actionBtns = isOwner && lead.status !== 'Converted' && lead.status !== 'Lost' ? `
    <div style="display:flex;gap:8px;padding:14px 18px;border-top:1px solid #f0f0f0;">
      <button class="btn-act btn-call-act" style="flex:1;" onclick="callLead('${esc(lead.mobileNo)}')">📞 Call</button>
      <button class="btn-act btn-log-act" style="flex:1;" onclick="closeSheet('detailSheet');openLogSheet('${lead.leadId}')">📝 Log</button>
      <a class="btn-act btn-quot-act" href="crm-quote.html?leadId=${lead.leadId}" style="flex:1;text-decoration:none;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">📄 Quote</a>
    </div>
    ${lead.status !== 'Converted' ? `<div style="padding:0 18px 14px;">
      <button class="btn-act" style="width:100%;background:linear-gradient(135deg,#66BB6A,#388E3C);color:white;padding:11px;" onclick="convertLead('${lead.leadId}','${esc(lead.customerName)}')">✅ Convert to Sale</button>
    </div>` : ''}
  ` : '';

  const adminAssign = isAdmin ? `
    <div style="padding:0 18px 14px;">
      <button class="btn-act btn-edit-act" style="width:100%;" onclick="openAssignSheet('${lead.leadId}')">👤 Assign to Executive</button>
    </div>
  ` : '';

  document.getElementById('detailSheetBody').innerHTML = `
    <div class="lead-detail-header">
      <button class="sheet-close" style="float:right;" onclick="closeSheet('detailSheet')">✕</button>
      <div class="lead-detail-name">${esc(lead.customerName)}</div>
      <div class="lead-detail-meta">
        <span class="status-pill ${pillClass(lead.status)}" style="display:inline-block;margin-right:6px;">${esc(lead.status || 'Pool')}</span>
        ${lead.isSocial ? `<span class="social-badge">📲 ${esc(lead.source)}</span>` : ''}
        ${lead.isOverdue ? `<span class="overdue-badge" style="display:inline-block;margin-left:4px;">⚠️ ${lead.daysOverdue}d overdue</span>` : ''}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Contact</div>
      <div class="detail-row"><span class="detail-label">Mobile</span><span class="detail-value">${esc(lead.mobileNo)}</span></div>
      ${lead.email ? `<div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${esc(lead.email)}</span></div>` : ''}
      ${lead.address ? `<div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">${esc(lead.address)}</span></div>` : ''}
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Lead Info</div>
      <div class="detail-row"><span class="detail-label">Model</span><span class="detail-value">${esc(lead.model)}</span></div>
      <div class="detail-row"><span class="detail-label">Source</span><span class="detail-value">${esc(lead.source)}</span></div>
      <div class="detail-row"><span class="detail-label">Assigned</span><span class="detail-value">${esc(lead.assignedTo || 'Pool')}</span></div>
      ${lead.expectedDate ? `<div class="detail-row"><span class="detail-label">Exp. Date</span><span class="detail-value">${esc(lead.expectedDate)}</span></div>` : ''}
      ${lead.followUpDate ? `<div class="detail-row"><span class="detail-label">Follow-up</span><span class="detail-value">${esc(lead.followUpDate)}</span></div>` : ''}
      ${lead.lostReason ? `<div class="detail-row"><span class="detail-label">Lost Reason</span><span class="detail-value" style="color:#ef5350;">${esc(lead.lostReason)}</span></div>` : ''}
      <div class="detail-row"><span class="detail-label">Created</span><span class="detail-value">${esc(lead.createdDate)} by ${esc(lead.createdBy)}</span></div>
    </div>

    ${actionBtns}
    ${adminAssign}

    <div class="detail-section">
      <div class="detail-section-title">Quotations</div>
      ${quotations}
    </div>

    <div class="detail-section" style="padding-bottom:20px;">
      <div class="detail-section-title">Interaction History</div>
      ${interactions}
    </div>
  `;
}

async function convertLead(leadId, name) {
  if (!confirm(`Convert ${name} to sale? This will mark the lead as Converted.`)) return;
  try {
    const r = await API.convertLeadToSale(leadId);
    if (r.success) {
      closeSheet('detailSheet');
      showMessage('Lead converted to sale!', 'success');
      _bgRefreshDashboard();
      loadMyLeads();
    } else {
      showMessage(r.message || 'Error', 'error');
    }
  } catch(e) {
    showMessage('Error converting lead', 'error');
  }
}

// ── LOG INTERACTION SHEET ──────────────────

function openLogSheet(leadId) {
  document.getElementById('logLeadId').value = leadId;
  selectedNoteType = '';
  selectedStatusChange = '';

  document.querySelectorAll('.note-type-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('lostReasonSection').style.display = 'none';
  document.getElementById('otherNoteSection').style.display = 'none';
  document.getElementById('statusChangeRow').style.display = 'none';
  document.getElementById('followupDateRow').style.display = '';
  document.getElementById('logFollowUpDate').value = '';
  document.getElementById('lostReasonText').value = '';
  document.getElementById('otherNoteText').value = '';
  document.getElementById('logSubmitBtn').disabled = true;

  document.querySelectorAll('#statusBtns .status-btn').forEach(b => b.classList.remove('active'));

  openSheet('logSheet');
}

function selectNoteType(el, type) {
  selectedNoteType = type;
  document.querySelectorAll('.note-type-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');

  document.getElementById('lostReasonSection').style.display  = type === 'Lost' ? '' : 'none';
  document.getElementById('otherNoteSection').style.display   = type === 'Other' ? '' : 'none';
  document.getElementById('followupDateRow').style.display    = type === 'Lost' ? 'none' : '';
  document.getElementById('statusChangeRow').style.display    = (type !== 'Lost' && type !== 'Other') ? '' : 'none';

  document.getElementById('logSubmitBtn').disabled = false;
}

function selectStatus(el) {
  selectedStatusChange = el.getAttribute('data-st');
  document.querySelectorAll('#statusBtns .status-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

async function submitLog() {
  const leadId = document.getElementById('logLeadId').value;
  if (!selectedNoteType) { alert('Please select an interaction type'); return; }

  let note = '';
  if (selectedNoteType === 'Lost') {
    note = document.getElementById('lostReasonText').value.trim();
    if (!note) { alert('Please enter a lost reason'); return; }
  } else if (selectedNoteType === 'Other') {
    note = document.getElementById('otherNoteText').value.trim();
  }

  const followUpDate = document.getElementById('logFollowUpDate').value || null;

  // If status selected, update status first
  const btn = document.getElementById('logSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    // Log interaction
    const r = await API.logCRMInteraction(leadId, selectedNoteType, note, followUpDate);
    if (!r.success) { showMessage(r.message || 'Error', 'error'); btn.disabled = false; btn.textContent = 'Save Log'; return; }

    // Update status if selected
    if (selectedStatusChange) {
      await API.updateLead(leadId, { status: selectedStatusChange, followUpDate: followUpDate || undefined });
    }

    closeSheet('logSheet');
    showMessage('Logged successfully', 'success');
    _bgRefreshDashboard();

    // Refresh current tab
    if (document.getElementById('myLeadsTab').classList.contains('active')) loadMyLeads();
    if (document.getElementById('followupsTab').classList.contains('active')) renderFollowups(currentFollowupFilter);
  } catch(e) {
    showMessage('Error saving log', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Log';
  }
}

// ── ADMIN ASSIGN ───────────────────────────

function openAssignSheet(leadId) {
  document.getElementById('assignLeadId').value = leadId;
  const select = document.getElementById('assignSelect');
  select.innerHTML = '<option value="">-- Select Executive --</option>' +
    allExecutives.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
  openSheet('assignSheet');
}

async function submitAssign() {
  const leadId = document.getElementById('assignLeadId').value;
  const exec = document.getElementById('assignSelect').value;
  if (!exec) { alert('Please select an executive'); return; }

  try {
    const r = await API.assignLead(leadId, exec);
    if (r.success) {
      closeSheet('assignSheet');
      showMessage('Lead assigned to ' + exec, 'success');
      if (document.getElementById('adminTab').classList.contains('active')) loadAdmin();
    } else {
      showMessage(r.message || 'Error', 'error');
    }
  } catch(e) {
    showMessage('Error assigning lead', 'error');
  }
}

// ── SEARCH ─────────────────────────────────

let searchTimer = null;

function openSearchModal() {
  document.getElementById('searchOverlay').classList.add('open');
  setTimeout(() => document.getElementById('searchInput').focus(), 100);
}

function closeSearchModal() {
  document.getElementById('searchOverlay').classList.remove('open');
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '<div class="search-empty">🔍 Type to search</div>';
}

function handleSearchOverlayClick(e) {
  if (e.target === document.getElementById('searchOverlay')) closeSearchModal();
}

function onSearchInput() {
  clearTimeout(searchTimer);
  const q = document.getElementById('searchInput').value.trim();
  if (q.length < 2) {
    document.getElementById('searchResults').innerHTML = '<div class="search-empty">🔍 Type at least 2 characters</div>';
    return;
  }
  searchTimer = setTimeout(() => doSearch(q), 350);
}

async function doSearch(q) {
  document.getElementById('searchResults').innerHTML = '<div class="search-empty">Searching...</div>';
  try {
    const r = await API.searchCRMLeads(q);
    if (!r.success) { document.getElementById('searchResults').innerHTML = '<div class="search-empty">Error searching</div>'; return; }

    const leads = r.leads || [];
    const quotMatches = r.quotationMatches || [];

    if (leads.length === 0 && quotMatches.length === 0) {
      document.getElementById('searchResults').innerHTML = '<div class="search-empty">No results found</div>';
      return;
    }

    let html = '';

    if (quotMatches.length > 0) {
      html += `<div style="padding:6px 16px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Quotations</div>`;
      html += quotMatches.map(q => `
        <div class="search-result-item" onclick="closeSearchModal();openLead('${q.leadId}')">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:8px;background:#f0f4ff;color:#667eea;">📄 ${esc(q.quotNo)}</span>
            <span class="search-result-name" style="font-size:14px;">${esc(q.customerName)}</span>
          </div>
          <div class="search-result-meta">🚗 ${esc(q.model)} · ₹${Number(q.totalAmount||0).toLocaleString('en-IN')} · ${esc(q.createdDate)}</div>
        </div>`).join('');
    }

    if (leads.length > 0) {
      if (quotMatches.length > 0) html += `<div style="padding:6px 16px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Leads</div>`;
      html += leads.map(l => `
        <div class="search-result-item" onclick="closeSearchModal();openLead('${l.leadId}')">
          <div class="search-result-name">${esc(l.customerName)}</div>
          <div class="search-result-meta">📱 ${esc(l.mobileNo)} · 🚗 ${esc(l.model)}</div>
          <span class="status-pill ${pillClass(l.status)}" style="display:inline-block;margin-top:4px;">${esc(l.status || 'Pool')}</span>
          ${l.assignedTo ? `<span style="font-size:11px;color:#aaa;margin-left:6px;">· ${esc(l.assignedTo)}</span>` : ''}
        </div>`).join('');
    }

    document.getElementById('searchResults').innerHTML = html;
  } catch(e) {
    document.getElementById('searchResults').innerHTML = '<div class="search-empty">Error searching</div>';
  }
}

// ── SHEET HELPERS ──────────────────────────

function openSheet(id) {
  document.getElementById(id).classList.add('open');
}

function closeSheet(id) {
  document.getElementById(id).classList.remove('open');
}

function handleSheetOverlayClick(e, id) {
  if (e.target === document.getElementById(id)) closeSheet(id);
}

// ── UTILITIES ──────────────────────────────

function goToAddLead() {
  window.location.href = 'crm-add.html';
}

function goBack() {
  window.location.href = 'home.html';
}

function callLead(mobile) {
  window.location.href = 'tel:' + mobile;
}

// Call + immediately open log sheet (for followup cards)
function callAndLog(mobile, leadId) {
  if (mobile) window.location.href = 'tel:' + mobile;
  openLogSheet(leadId);
}

// For pool leads: auto-claim then call + log
async function callPoolLead(mobile, leadId) {
  if (mobile) window.location.href = 'tel:' + mobile;
  openLogSheet(leadId);
  // Silently claim in background
  try {
    const r = await API.claimLead(leadId);
    if (r.success) {
      showMessage('Lead claimed to you — log your interaction', 'success');
      setTimeout(() => loadPool(), 1500);
    }
  } catch(e) {}
}

function showMessage(text, type) {
  const el = document.getElementById('statusMessage');
  el.textContent = text;
  el.className = 'message ' + type;
  el.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function statusClass(status) {
  const m = { New:'st-new', Contacted:'st-contacted', Interested:'st-interested', Lost:'st-lost', Converted:'st-converted' };
  return m[status] || '';
}

function pillClass(status) {
  const m = { New:'pill-new', Contacted:'pill-contacted', Interested:'pill-interested', Lost:'pill-lost', Converted:'pill-converted' };
  return m[status] || 'pill-pool';
}

function agingBadgeHtml(days) {
  if (!days || days <= 3) return '';
  const cls = days > 14 ? 'danger' : days > 7 ? 'warn' : '';
  return `<span class="aging-badge ${cls}">${days}d</span>`;
}

function errorHtml(msg) {
  return `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Error</div><div class="empty-sub">${esc(msg || 'Something went wrong')}</div></div>`;
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

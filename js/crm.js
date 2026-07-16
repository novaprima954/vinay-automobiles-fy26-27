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
let currentFollowupSearch = '';
let currentMyLeadsSearch  = '';
let currentAllLeadsSearch = '';
let followupData = { overdue: [], today: [], week: [] };
let selectedNoteType = '';
let selectedStatusChange = '';
let allExecutives = [];   // for admin assign

// All Leads tab state
let allLeadsAll = [];
let allLeadsFiltered = [];
let currentAllLeadsStatusFilter = 'all';
let currentAllLeadsSourceFilter = 'all';
let currentAllLeadsExecFilter   = 'all';

// Pool claim — must submit log before lead is claimed
let pendingPoolClaimLeadId = null;

// Race-condition guard for openLead: only render the most-recently requested lead
let _openLeadToken = 0;

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

  // All Leads tab visible for all roles except financier
  const navAllLeads = document.getElementById('navAllLeads');
  if (navAllLeads && currentUser.role !== 'financier') navAllLeads.style.display = '';

  // Financier role — adjust UI and load their dashboard
  if (currentUser.role === 'financier') {
    const bulkWaBtn = document.querySelector('#myLeadsTab button[onclick="openBulkWaModal()"]');
    if (bulkWaBtn) bulkWaBtn.parentElement.style.display = 'none';
    _setupFinancierUI();
    await loadFinancierDashboard();
    return;
  }

  // Admin visiting Financier CRM view (via ?view=financier from home)
  if (currentUser.role === 'admin' && new URLSearchParams(window.location.search).get('view') === 'financier') {
    setTimeout(() => switchTab('admin'), 300);
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
    allLeads:   ['allLeadsTab',  'navAllLeads'],
    admin:      ['adminTab',     'navAdmin'],
  };

  const [contentId, navId] = tabMap[tab] || tabMap.dashboard;
  document.getElementById(contentId).classList.add('active');
  const navEl = document.getElementById(navId);
  if (navEl) navEl.classList.add('active');

  // Widen container for admin tab so call report table columns fit
  const crmContainer = document.querySelector('.crm-container');
  if (crmContainer) {
    if (tab === 'admin') crmContainer.classList.add('admin-wide');
    else crmContainer.classList.remove('admin-wide');
  }

  // Lazy loads
  if (tab === 'followups') {
    if (currentUser.role === 'financier') renderFinancierFollowups(currentFollowupFilter);
    else if (dashboardData) renderFollowups(currentFollowupFilter);
  }
  if (tab === 'pool'     && currentUser.role !== 'financier') loadPool();
  if (tab === 'myLeads') {
    if (currentUser.role === 'financier') loadFinancierLeads();
    else loadMyLeads();
  }
  // All Leads is load-on-demand (see the "Load List" button in the tab) — no auto-load here.
  if (tab === 'admin') {
    if (currentUser.role === 'admin') loadAdmin();
    else if (currentUser.role === 'financier') {
      // Show financier's own analytics in the admin tab
      const container = document.getElementById('finAnalyticsContent');
      if (container && container.querySelector('button')) loadFinancierAnalytics();
    }
  }

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
  if (currentUser && currentUser.role === 'financier') {
    try { const r = await API.getFinancierDashboard(); if (r.success) _displayFinancierDashboard(r.dashboard); } catch(e) {}
    return;
  }
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

function filterFollowupsByName() {
  const el = document.getElementById('followupSearch');
  currentFollowupSearch = el ? el.value : '';
  renderFollowups(currentFollowupFilter);
}

function _nameMatch(lead, query) {
  if (!query) return true;
  const q = String(query).toLowerCase().trim();
  if (!q) return true;
  const name  = String(lead.customerName || '').toLowerCase();
  const phone = String(lead.mobileNo || '');
  return name.includes(q) || phone.includes(q);
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

  // Apply name search
  if (currentFollowupSearch) leads = leads.filter(l => _nameMatch(l, currentFollowupSearch));

  if (leads.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-title">All clear!</div><div class="empty-sub">No ${filter} follow-ups${currentFollowupSearch ? ' matching "' + currentFollowupSearch + '"' : ''}</div></div>`;
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
  for (const l of myLeadsAll)          if (l.leadId === leadId) return l;
  for (const l of poolLeadsCache)      if (l.leadId === leadId) return l;
  for (const l of financierLeadsAll)   if (l.leadId === leadId) return l;
  for (const arr of [followupData.overdue, followupData.today, followupData.week])
    for (const l of arr)               if (l.leadId === leadId) return l;
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

function filterMyLeadsByName() {
  const el = document.getElementById('myLeadsSearch');
  currentMyLeadsSearch = el ? el.value : '';
  applyMyLeadsFilters();
}

function applyMyLeadsFilters() {
  let leads = myLeadsAll;

  if (currentMyLeadsSourceFilter === 'social') leads = leads.filter(l => l.isSocial);
  else if (currentMyLeadsSourceFilter === 'mine') leads = leads.filter(l => !l.isSocial);

  if (currentMyLeadsStatusFilter !== 'all') {
    leads = leads.filter(l => l.status === currentMyLeadsStatusFilter);
  }

  if (currentMyLeadsSearch) leads = leads.filter(l => _nameMatch(l, currentMyLeadsSearch));

  // Newest leads first
  leads = leads.slice().sort((a, b) => (b.createdDate || '').localeCompare(a.createdDate || ''));

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

// ── FINANCIER ROLE ─────────────────────────

let financierDashData    = null;
let financierLeadsAll    = [];
let financierLeadsFiltered = [];
let currentFinLoanFilter = 'all';
let financierUsers       = [];  // cached list for dropdowns

function _setupFinancierUI() {
  // Hide tabs not relevant to financier
  ['navPool','navAllLeads','navAdmin'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  // Rename My Leads nav label
  const myLbl = document.querySelector('#navMyLeads .nav-label');
  if (myLbl) myLbl.textContent = 'My Leads';
  // Hide source filter rows — show loan status filter instead
  ['myLeadsSourceFilter','myLeadsStatusFilter'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  // Move loan filter into my leads tab
  const finFilter = document.getElementById('finLoanStatusFilter');
  const myLeadsTab = document.getElementById('myLeadsTab');
  if (finFilter && myLeadsTab) { finFilter.style.display = ''; myLeadsTab.insertBefore(finFilter, myLeadsTab.firstChild); }
  // Show "Analytics" tab for financier (reuse navAdmin element, renamed)
  const navAdmin = document.getElementById('navAdmin');
  if (navAdmin) {
    navAdmin.style.display = '';
    const adminIcon  = navAdmin.querySelector('.nav-icon');
    const adminLabel = navAdmin.querySelector('.nav-label');
    if (adminIcon)  adminIcon.textContent  = '📊';
    if (adminLabel) adminLabel.textContent = 'Analytics';
  }
  // Hide FAB add-lead (financier doesn't add leads)
  const fab = document.querySelector('.fab');
  if (fab) fab.style.display = 'none';
  // Update dashboard labels for financier
  const labels = {
    'Overdue': document.querySelector('.stat-card.overdue .stat-card-label'),
    'Today': document.querySelector('.stat-card.urgent .stat-card-label'),
    'Pool': document.querySelector('.stat-card.available .stat-card-label'),
    'Disbursed': document.querySelector('.stat-card.converted .stat-card-label')
  };
  if (document.querySelector('.stat-card.overdue .stat-card-label'))   document.querySelector('.stat-card.overdue .stat-card-label').textContent   = 'Overdue';
  if (document.querySelector('.stat-card.urgent .stat-card-label'))    document.querySelector('.stat-card.urgent .stat-card-label').textContent    = 'Due Today';
  if (document.querySelector('.stat-card.available .stat-card-label')) document.querySelector('.stat-card.available .stat-card-label').textContent = 'Under Process';
  if (document.querySelector('.stat-card.converted .stat-card-label')) document.querySelector('.stat-card.converted .stat-card-label').textContent = 'Disbursed (Month)';
  if (document.querySelector('.stat-card.available .stat-card-icon'))  document.querySelector('.stat-card.available .stat-card-icon').textContent  = '⏳';
  if (document.querySelector('.stat-card.converted .stat-card-icon'))  document.querySelector('.stat-card.converted .stat-card-icon').textContent  = '💰';
}

async function loadFinancierDashboard() {
  try {
    const r = await API.getFinancierDashboard();
    if (!r.success) { showMessage(r.message || 'Error loading dashboard', 'error'); return; }
    financierDashData = r.dashboard;
    _displayFinancierDashboard(r.dashboard);
  } catch(e) { showMessage('Error loading dashboard', 'error'); }
}

function _displayFinancierDashboard(d) {
  // Update stat card labels (handled by _setupFinancierUI) then fill values
  document.getElementById('overdueCount').textContent   = d.overdueCount      || 0;
  document.getElementById('weekCount').textContent      = d.todayCount         || 0;
  document.getElementById('availableCount').textContent = d.underProcess       || 0;
  document.getElementById('convertedCount').textContent = d.disbursedThisMonth || 0;

  const badge = document.getElementById('overdueNavBadge');
  if (d.overdueCount > 0) { badge.textContent = d.overdueCount > 99 ? '99+' : d.overdueCount; badge.style.display = ''; }
  else badge.style.display = 'none';

  // Today's urgent
  const urgentSection = document.getElementById('urgentSection');
  const urgentList    = document.getElementById('urgentList');
  const urgent = d.todayLeads || [];
  if (urgent.length > 0) {
    document.getElementById('todayBadge').textContent = urgent.length;
    urgentList.innerHTML = urgent.map(l => followupCardHtml(l, 'today')).join('');
    urgentSection.style.display = '';
  } else { urgentSection.style.display = 'none'; }

  // Sync for follow-ups tab
  followupData.overdue = d.overdueLeads || [];
  followupData.today   = d.todayLeads   || [];
  followupData.week    = d.weekLeads    || [];

  document.getElementById('fc_overdue').textContent = followupData.overdue.length;
  document.getElementById('fc_today').textContent   = followupData.today.length;
  document.getElementById('fc_week').textContent    = followupData.week.length;
}

function renderFinancierFollowups(filter) {
  financierDashData ? renderFollowups(filter) : loadFinancierDashboard();
}

// ── Financier: My Finance Leads tab ──────

async function loadFinancierLeads() {
  const loading   = document.getElementById('myLeadsLoading');
  loading.style.display = '';
  try {
    const r = await API.getFinancierLeads();
    loading.style.display = 'none';
    if (!r.success) { document.getElementById('myLeads').innerHTML = errorHtml(r.message); return; }
    financierLeadsAll = r.leads || [];
    currentFinLoanFilter = 'all';
    document.querySelectorAll('#finLoanStatusFilter .filter-chip').forEach(c => c.classList.remove('active'));
    const first = document.querySelector('#finLoanStatusFilter .filter-chip');
    if (first) first.classList.add('active');
    applyFinancierLeadsFilter();
  } catch(e) {
    loading.style.display = 'none';
    document.getElementById('myLeads').innerHTML = errorHtml('Error loading leads');
  }
}

function setFinancierLoanFilter(filter, el) {
  currentFinLoanFilter = filter;
  document.querySelectorAll('#finLoanStatusFilter .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  applyFinancierLeadsFilter();
}

function applyFinancierLeadsFilter() {
  let leads = financierLeadsAll;
  if (currentFinLoanFilter !== 'all') leads = leads.filter(l => (l.loanStatus || 'New') === currentFinLoanFilter);
  financierLeadsFiltered = leads;
  renderFinancierLeads();
}

function renderFinancierLeads() {
  const container = document.getElementById('myLeads');
  if (financierLeadsFiltered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No leads</div><div class="empty-sub">No finance leads match this filter</div></div>`;
    return;
  }
  container.innerHTML = financierLeadsFiltered.map(l => financierLeadCardHtml(l)).join('');
}

function financierLeadCardHtml(lead) {
  const loanSt = lead.loanStatus || 'New';
  const loanColor = { 'New':'#9E9E9E','Called':'#2196F3','Applied':'#FF9800','Under Process':'#9C27B0','Approved':'#4CAF50','Disbursed':'#388E3C','Rejected':'#ef5350','Not Interested':'#ef5350' }[loanSt] || '#9E9E9E';
  return `<div class="lead-card" style="border-left-color:${loanColor};">
    <div class="lead-top">
      <div class="lead-name">${esc(lead.customerName)}</div>
      <div class="lead-badges">
        <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:8px;background:${loanColor}22;color:${loanColor};">${esc(loanSt)}</span>
        ${agingBadgeHtml(lead.agingDays)}
      </div>
    </div>
    <div class="lead-info">
      <div class="lead-info-row">📱 ${esc(lead.mobileNo)} &nbsp;🚗 ${esc(lead.model || '—')}</div>
      <div class="lead-info-row">👤 ${esc(lead.assignedTo || 'Pool')} &nbsp;📅 ${esc(lead.followUpDate || '—')}</div>
      ${lead.loanAmount > 0 ? `<div class="lead-info-row">💰 Loan: ₹${lead.loanAmount.toLocaleString('en-IN')} &nbsp;📆 ${lead.tenure || '—'}m</div>` : ''}
    </div>
    <div class="lead-actions">
      <button class="btn-act btn-call-act"  onclick="callAndLog('${esc(lead.mobileNo || '')}','${lead.leadId}')">📞 Call</button>
      <button class="btn-act btn-log-act"   onclick="openLogSheet('${lead.leadId}')">📝 Log</button>
      <button class="btn-act" style="flex:1;background:linear-gradient(135deg,#11998e,#38ef7d);color:white;border:none;border-radius:8px;padding:8px;font-size:12px;font-weight:700;cursor:pointer;"
        onclick="openFinanceSheet('${lead.leadId}')">🏦 Finance</button>
      <button class="btn-act btn-edit-act"  onclick="openLead('${lead.leadId}')">Details</button>
    </div>
  </div>`;
}

// ── Finance Details Sheet (financier fills in) ──

function openFinanceSheet(leadId) {
  const lead = _findFinancierLead(leadId) || findCachedLead(leadId) || {};
  document.getElementById('finLeadId').value           = leadId;
  document.getElementById('finLoanStatus').value       = lead.loanStatus           || 'New';
  document.getElementById('finScheme').value           = lead.financeScheme        || '';
  document.getElementById('finDownPayment').value      = lead.downPayment          || '';
  document.getElementById('finLoanAmount').value       = lead.loanAmount           || '';
  document.getElementById('finEMI').value              = lead.emi                  || '';
  document.getElementById('finTenure').value           = lead.tenure               || '';
  const finFuEl = document.getElementById('finFollowUpDate');
  if (finFuEl) { finFuEl.value = lead.financierFollowUpDate || ''; _setFollowUpDateLimits('finFollowUpDate'); }
  openSheet('financeSheet');
}

function _findFinancierLead(leadId) {
  return financierLeadsAll.find(l => l.leadId === leadId) || null;
}

async function submitFinanceDetails() {
  const leadId = document.getElementById('finLeadId').value;
  const btn    = document.getElementById('finSubmitBtn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const finFuEl = document.getElementById('finFollowUpDate');
    const data = {
      loanStatus:           document.getElementById('finLoanStatus').value,
      financeScheme:        document.getElementById('finScheme').value.trim(),
      downPayment:          Number(document.getElementById('finDownPayment').value) || 0,
      loanAmount:           Number(document.getElementById('finLoanAmount').value)  || 0,
      emi:                  Number(document.getElementById('finEMI').value)         || 0,
      tenure:               Number(document.getElementById('finTenure').value)      || 0,
      financierFollowUpDate: finFuEl ? finFuEl.value : ''
    };
    const r = await API.updateFinanceDetails(leadId, data);
    if (r.success) {
      closeSheet('financeSheet');
      showMessage(r.autoConverted ? '💰 Disbursed — lead converted to Sale!' : 'Finance details saved', 'success');
      if (currentUser.role === 'financier') loadFinancierLeads();
      else if (document.getElementById('myLeadsTab').classList.contains('active')) loadMyLeads();
      _bgRefreshDashboard();
    } else { showMessage(r.message || 'Error saving', 'error'); }
  } catch(e) { showMessage('Error: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Save'; }
}

// ── Assign Financier Sheet (sales exec uses) ──

async function openAssignFinancierSheet(leadId) {
  document.getElementById('assignFinLeadId').value = leadId;
  const sel = document.getElementById('assignFinSelect');
  sel.innerHTML = '<option value="">-- Select Financier --</option>';
  try {
    if (financierUsers.length === 0) {
      const r = await API.getFinancierUsers();
      if (r.success) financierUsers = r.financiers || [];
    }
    financierUsers.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.name; opt.textContent = f.name;
      sel.appendChild(opt);
    });
  } catch(e) {}
  openSheet('assignFinSheet');
}

async function submitAssignFinancier() {
  const leadId    = document.getElementById('assignFinLeadId').value;
  const financier = document.getElementById('assignFinSelect').value;
  if (!financier) { alert('Please select a financier'); return; }
  try {
    const r = await API.updateLead(leadId, { financierAssigned: financier });
    if (r.success) {
      closeSheet('assignFinSheet');
      showMessage('Lead assigned to ' + financier, 'success');
      if (document.getElementById('myLeadsTab').classList.contains('active')) loadMyLeads();
    } else { showMessage(r.message || 'Error', 'error'); }
  } catch(e) { showMessage('Error assigning', 'error'); }
}

// ── Financier Analytics (admin + financier) ──

// Month multiselect dropdown (All Months + checkbox list, mirrors js/financier.js pattern)
let selectedFinAnalyticsMonths = []; // [] = All Months

function _buildFinAnalyticsMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    months.push({ value, label });
  }
  return months;
}

function initFinAnalyticsMonthDropdown() {
  const panel = document.getElementById('finAnalyticsMonthDropdownPanel');
  if (!panel || panel.dataset.built) return;
  panel.dataset.built = '1';

  const months = _buildFinAnalyticsMonthOptions();
  let html = '<label style="display:flex;align-items:center;gap:8px;padding:7px 14px;cursor:pointer;font-size:13px;font-weight:700;color:#333;border-bottom:1px solid #eee;margin-bottom:2px;">' +
    '<input type="checkbox" id="finAnalyticsMonthAll" checked onchange="onFinAnalyticsMonthAllChange()"> All Months</label>';
  html += months.map(m =>
    '<label style="display:flex;align-items:center;gap:8px;padding:6px 14px;cursor:pointer;font-size:13px;color:#444;">' +
    '<input type="checkbox" class="fin-analytics-month-cb" value="' + m.value + '" onchange="onFinAnalyticsMonthCbChange()"> ' + m.label + '</label>'
  ).join('');
  panel.innerHTML = html;
}

function toggleFinAnalyticsMonthDropdown() {
  initFinAnalyticsMonthDropdown();
  const panel = document.getElementById('finAnalyticsMonthDropdownPanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', function(e) {
  const container = document.getElementById('finAnalyticsMonthMultiselect');
  const panel = document.getElementById('finAnalyticsMonthDropdownPanel');
  if (container && panel && panel.style.display === 'block' && !container.contains(e.target)) {
    panel.style.display = 'none';
  }
});

function onFinAnalyticsMonthAllChange() {
  const allCb = document.getElementById('finAnalyticsMonthAll');
  if (allCb.checked) {
    document.querySelectorAll('.fin-analytics-month-cb').forEach(cb => cb.checked = false);
  }
  _applyFinAnalyticsMonthSelection();
}

function onFinAnalyticsMonthCbChange() {
  const checked = Array.from(document.querySelectorAll('.fin-analytics-month-cb')).filter(cb => cb.checked);
  document.getElementById('finAnalyticsMonthAll').checked = checked.length === 0;
  _applyFinAnalyticsMonthSelection();
}

function _applyFinAnalyticsMonthSelection() {
  const checked = Array.from(document.querySelectorAll('.fin-analytics-month-cb')).filter(cb => cb.checked);
  selectedFinAnalyticsMonths = checked.map(cb => cb.value);

  const labelEl = document.getElementById('finAnalyticsMonthToggleLabel');
  if (labelEl) {
    labelEl.textContent = selectedFinAnalyticsMonths.length === 0 ? 'All Months' :
      (selectedFinAnalyticsMonths.length === 1 ? checked[0].parentElement.textContent.trim() : selectedFinAnalyticsMonths.length + ' months selected');
  }
  loadFinancierAnalytics();
}

async function loadFinancierAnalytics() {
  const container = document.getElementById('finAnalyticsContent');
  const btn = document.getElementById('finAnalyticsRefreshBtn');
  if (!container) return;
  container.innerHTML = '<div class="loading" style="padding:20px;"><div class="spinner"></div><div>Loading...</div></div>';
  if (btn) btn.disabled = true;
  try {
    const r = await API.getFinancierAnalytics(selectedFinAnalyticsMonths.join(','));
    if (btn) btn.disabled = false;
    if (!r.success) { container.innerHTML = errorHtml(r.message); return; }

    let html = '';

    // My Stats (for financier role)
    if (currentUser.role === 'financier' && r.myStats) {
      const s = r.myStats;
      html += `<div class="analytics-card">
        <div class="analytics-card-title">📊 My Performance</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px;">
          ${[['Total','📋',s.total,'#667eea'],['Disbursed','💰',s.disbursed,'#388E3C'],['This Month','🗓',s.disbursedMonth,'#11998e'],
             ['Applied','📄',s.applied,'#FF9800'],['Under Process','⏳',s.underProcess,'#9C27B0'],['Rejected','❌',s.rejected,'#ef5350']]
            .map(([l,ic,v,c]) => `<div style="text-align:center;background:#f8f9fa;border-radius:8px;padding:10px 6px;">
              <div style="font-size:18px;">${ic}</div><div style="font-size:20px;font-weight:800;color:${c};">${v}</div>
              <div style="font-size:10px;color:#888;">${l}</div></div>`).join('')}
        </div></div>`;
    }

    // Per-financier table (admin)
    if (currentUser.role === 'admin' && r.financiers && r.financiers.length > 0) {
      html += `<div class="analytics-card">
        <div class="analytics-card-title">🏦 Financier Performance</div>
        <table class="analytics-table">
          <thead><tr><th>Financier</th><th>Total</th><th>Applied</th><th>Process</th><th>Disbursed</th><th>Conv%</th></tr></thead>
          <tbody>${r.financiers.map(f => `<tr>
            <td style="font-weight:700;">${esc(f.financier)}</td>
            <td>${f.total}</td><td>${f.applied}</td><td>${f.underProcess}</td>
            <td><span style="color:#388E3C;font-weight:800;">${f.disbursed}</span>${f.disbursedMonth > 0 ? ` <span style="font-size:10px;color:#11998e;">(${f.disbursedMonth} this mo.)</span>` : ''}</td>
            <td><span class="conv-rate">${f.convRate}%</span></td></tr>`).join('')}
          </tbody></table></div>`;
    }

    // Exec → Financier referral matrix
    if (r.execReferrals && r.execReferrals.length > 0) {
      const allFins = [...new Set(r.execReferrals.flatMap(e => Object.keys(e.referrals)))];
      html += `<div class="analytics-card">
        <div class="analytics-card-title">👥 Executive Referrals</div>
        <div style="overflow-x:auto;">
        <table class="analytics-table">
          <thead><tr><th>Executive</th>${allFins.map(f => `<th style="font-size:10px;">${esc(f)}</th>`).join('')}<th>Total</th></tr></thead>
          <tbody>${r.execReferrals.map(e => {
            const total = Object.values(e.referrals).reduce((s,v) => s+v, 0);
            return `<tr><td style="font-weight:700;">${esc(e.executive)}</td>${allFins.map(f => `<td>${e.referrals[f] || '—'}</td>`).join('')}<td><strong>${total}</strong></td></tr>`;
          }).join('')}</tbody></table></div></div>`;
    }

    container.innerHTML = html || '<div style="padding:20px;color:#aaa;text-align:center;">No financier data yet</div>';
  } catch(e) {
    if (btn) btn.disabled = false;
    container.innerHTML = errorHtml('Error loading analytics');
  }
}

// ── Executive-wise Analysis (admin) ──

const ENQUIRY_TYPE_OPTIONS = ['Walk-in', 'Phone Call', 'Social Media', 'Referral', 'Website', 'Other'];
let selectedExecAnalysisTypes = []; // [] = All Enquiry Types

function initExecAnalysisTypeDropdown() {
  const panel = document.getElementById('execAnalysisTypeDropdownPanel');
  if (!panel || panel.dataset.built) return;
  panel.dataset.built = '1';

  let html = '<label style="display:flex;align-items:center;gap:8px;padding:7px 14px;cursor:pointer;font-size:13px;font-weight:700;color:#333;border-bottom:1px solid #eee;margin-bottom:2px;">' +
    '<input type="checkbox" id="execAnalysisTypeAll" checked onchange="onExecAnalysisTypeAllChange()"> All Enquiry Types</label>';
  html += ENQUIRY_TYPE_OPTIONS.map(t =>
    '<label style="display:flex;align-items:center;gap:8px;padding:6px 14px;cursor:pointer;font-size:13px;color:#444;">' +
    '<input type="checkbox" class="exec-analysis-type-cb" value="' + t + '" onchange="onExecAnalysisTypeCbChange()"> ' + t + '</label>'
  ).join('');
  panel.innerHTML = html;
}

function toggleExecAnalysisTypeDropdown() {
  initExecAnalysisTypeDropdown();
  const panel = document.getElementById('execAnalysisTypeDropdownPanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', function(e) {
  const container = document.getElementById('execAnalysisTypeMultiselect');
  const panel = document.getElementById('execAnalysisTypeDropdownPanel');
  if (container && panel && panel.style.display === 'block' && !container.contains(e.target)) {
    panel.style.display = 'none';
  }
});

function onExecAnalysisTypeAllChange() {
  const allCb = document.getElementById('execAnalysisTypeAll');
  if (allCb.checked) {
    document.querySelectorAll('.exec-analysis-type-cb').forEach(cb => cb.checked = false);
  }
  _applyExecAnalysisTypeSelection();
}

function onExecAnalysisTypeCbChange() {
  const checked = Array.from(document.querySelectorAll('.exec-analysis-type-cb')).filter(cb => cb.checked);
  document.getElementById('execAnalysisTypeAll').checked = checked.length === 0;
  _applyExecAnalysisTypeSelection();
}

function _applyExecAnalysisTypeSelection() {
  const checked = Array.from(document.querySelectorAll('.exec-analysis-type-cb')).filter(cb => cb.checked);
  selectedExecAnalysisTypes = checked.map(cb => cb.value);

  const labelEl = document.getElementById('execAnalysisTypeToggleLabel');
  if (labelEl) {
    labelEl.textContent = selectedExecAnalysisTypes.length === 0 ? 'All Enquiry Types' :
      (selectedExecAnalysisTypes.length === 1 ? selectedExecAnalysisTypes[0] : selectedExecAnalysisTypes.length + ' types selected');
  }
}

async function loadExecutiveWiseAnalysis() {
  const container = document.getElementById('execAnalysisContent');
  const btn = document.getElementById('execAnalysisBtn');
  if (!container) return;

  const fromDate = (document.getElementById('execAnalysisFromDate') || {}).value || '';
  const toDate   = (document.getElementById('execAnalysisToDate')   || {}).value || '';

  container.innerHTML = '<div class="loading" style="padding:20px;"><div class="spinner"></div><div>Loading...</div></div>';
  if (btn) btn.disabled = true;

  try {
    const r = await API.getExecutiveWiseAnalysis(fromDate, toDate, selectedExecAnalysisTypes.join(','));
    if (btn) btn.disabled = false;
    if (!r.success) { container.innerHTML = errorHtml(r.message); return; }

    const rows = r.data || [];
    if (rows.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#aaa;text-align:center;">No data for this period</div>';
      return;
    }

    container.innerHTML = `<div class="analytics-card">
      <table class="analytics-table">
        <thead><tr>
          <th>Executive</th><th>Enquiry</th><th>Calls</th><th>Brochure</th><th>Quotation</th><th>Conversion</th><th>Conv%</th>
        </tr></thead>
        <tbody>${rows.map(row => `<tr>
          <td style="font-weight:700;">${esc(row.executive)}</td>
          <td>${row.totalEnquiry}</td>
          <td>${row.totalCalls}</td>
          <td>${row.totalBrochure}</td>
          <td>${row.totalQuotation}</td>
          <td><span style="color:#388E3C;font-weight:800;">${row.totalConversion}</span></td>
          <td><span class="conv-rate">${row.conversionRate}%</span></td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  } catch(e) {
    if (btn) btn.disabled = false;
    container.innerHTML = errorHtml('Error loading executive analysis');
  }
}

// ── Bulk WhatsApp (My Leads) ──

const BULK_WA_SOURCE_OPTIONS = ['Walk-in', 'Phone Call', 'Social Media', 'Referral', 'Website', 'Other'];
let selectedBulkWaModels = [];   // [] = All Models
let selectedBulkWaSources = [];  // [] = All Sources
let bulkWaCandidates = [];       // full matched list from last search
let bulkWaModelOptions = [];     // distinct models loaded from backend

function openBulkWaModal() {
  document.getElementById('bulkWaModal').style.display = 'block';
  document.getElementById('bulkWaResultsSection').style.display = 'none';
  document.getElementById('bulkWaResultSummary').innerHTML = '';
  initBulkWaModelDropdown();
  initBulkWaSourceDropdown();
  loadBulkWaTemplates();
}

function closeBulkWaModal() {
  document.getElementById('bulkWaModal').style.display = 'none';
}

async function initBulkWaModelDropdown() {
  const panel = document.getElementById('bulkWaModelDropdownPanel');
  if (!panel || panel.dataset.built) return;
  panel.dataset.built = '1';

  panel.innerHTML = '<div style="padding:10px 14px;color:#999;font-size:12px;">Loading…</div>';
  try {
    const r = await API.getBulkWhatsAppFilterOptions();
    bulkWaModelOptions = (r.success && r.models) ? r.models : [];
  } catch(e) { bulkWaModelOptions = []; }

  let html = '<label style="display:flex;align-items:center;gap:8px;padding:7px 14px;cursor:pointer;font-size:13px;font-weight:700;color:#333;border-bottom:1px solid #eee;margin-bottom:2px;">' +
    '<input type="checkbox" id="bulkWaModelAll" checked onchange="onBulkWaModelAllChange()"> All Models</label>';
  html += bulkWaModelOptions.map(m =>
    '<label style="display:flex;align-items:center;gap:8px;padding:6px 14px;cursor:pointer;font-size:13px;color:#444;">' +
    '<input type="checkbox" class="bulk-wa-model-cb" value="' + esc(m) + '" onchange="onBulkWaModelCbChange()"> ' + esc(m) + '</label>'
  ).join('');
  panel.innerHTML = html;
}

function initBulkWaSourceDropdown() {
  const panel = document.getElementById('bulkWaSourceDropdownPanel');
  if (!panel || panel.dataset.built) return;
  panel.dataset.built = '1';

  let html = '<label style="display:flex;align-items:center;gap:8px;padding:7px 14px;cursor:pointer;font-size:13px;font-weight:700;color:#333;border-bottom:1px solid #eee;margin-bottom:2px;">' +
    '<input type="checkbox" id="bulkWaSourceAll" checked onchange="onBulkWaSourceAllChange()"> All Sources</label>';
  html += BULK_WA_SOURCE_OPTIONS.map(s =>
    '<label style="display:flex;align-items:center;gap:8px;padding:6px 14px;cursor:pointer;font-size:13px;color:#444;">' +
    '<input type="checkbox" class="bulk-wa-source-cb" value="' + s + '" onchange="onBulkWaSourceCbChange()"> ' + s + '</label>'
  ).join('');
  panel.innerHTML = html;
}

function toggleBulkWaModelDropdown() {
  const panel = document.getElementById('bulkWaModelDropdownPanel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function toggleBulkWaSourceDropdown() {
  const panel = document.getElementById('bulkWaSourceDropdownPanel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', function(e) {
  const mCont = document.getElementById('bulkWaModelMultiselect');
  const mPanel = document.getElementById('bulkWaModelDropdownPanel');
  if (mCont && mPanel && mPanel.style.display === 'block' && !mCont.contains(e.target)) mPanel.style.display = 'none';

  const sCont = document.getElementById('bulkWaSourceMultiselect');
  const sPanel = document.getElementById('bulkWaSourceDropdownPanel');
  if (sCont && sPanel && sPanel.style.display === 'block' && !sCont.contains(e.target)) sPanel.style.display = 'none';
});

function onBulkWaModelAllChange() {
  const allCb = document.getElementById('bulkWaModelAll');
  if (allCb.checked) document.querySelectorAll('.bulk-wa-model-cb').forEach(cb => cb.checked = false);
  _applyBulkWaModelSelection();
}

function onBulkWaModelCbChange() {
  const checked = Array.from(document.querySelectorAll('.bulk-wa-model-cb')).filter(cb => cb.checked);
  document.getElementById('bulkWaModelAll').checked = checked.length === 0;
  _applyBulkWaModelSelection();
}

function _applyBulkWaModelSelection() {
  const checked = Array.from(document.querySelectorAll('.bulk-wa-model-cb')).filter(cb => cb.checked);
  selectedBulkWaModels = checked.map(cb => cb.value);
  const labelEl = document.getElementById('bulkWaModelToggleLabel');
  if (labelEl) {
    labelEl.textContent = selectedBulkWaModels.length === 0 ? 'All Models' :
      (selectedBulkWaModels.length === 1 ? selectedBulkWaModels[0] : selectedBulkWaModels.length + ' models selected');
  }
}

function onBulkWaSourceAllChange() {
  const allCb = document.getElementById('bulkWaSourceAll');
  if (allCb.checked) document.querySelectorAll('.bulk-wa-source-cb').forEach(cb => cb.checked = false);
  _applyBulkWaSourceSelection();
}

function onBulkWaSourceCbChange() {
  const checked = Array.from(document.querySelectorAll('.bulk-wa-source-cb')).filter(cb => cb.checked);
  document.getElementById('bulkWaSourceAll').checked = checked.length === 0;
  _applyBulkWaSourceSelection();
}

function _applyBulkWaSourceSelection() {
  const checked = Array.from(document.querySelectorAll('.bulk-wa-source-cb')).filter(cb => cb.checked);
  selectedBulkWaSources = checked.map(cb => cb.value);
  const labelEl = document.getElementById('bulkWaSourceToggleLabel');
  if (labelEl) {
    labelEl.textContent = selectedBulkWaSources.length === 0 ? 'All Sources' :
      (selectedBulkWaSources.length === 1 ? selectedBulkWaSources[0] : selectedBulkWaSources.length + ' sources selected');
  }
}

async function loadBulkWaTemplates() {
  const sel = document.getElementById('bulkWaTemplateSelect');
  if (!sel) return;
  try {
    const r = await API.getBulkWhatsAppTemplates();
    const templates = (r.success && r.templates) ? r.templates : [];
    sel.innerHTML = '<option value="">-- Select Template --</option>' +
      templates.map(t => '<option value="' + t.templateKey + '">' + esc(t.label) + '</option>').join('');
  } catch(e) {
    sel.innerHTML = '<option value="">-- Select Template --</option>';
  }
}

async function findBulkWaCandidates() {
  const btn = document.getElementById('bulkWaFindBtn');
  const fromDate = document.getElementById('bulkWaFromDate').value;
  const toDate   = document.getElementById('bulkWaToDate').value;
  const notPurchased = document.getElementById('bulkWaNotPurchased').checked ? 'yes' : '';

  btn.disabled = true;
  btn.textContent = '⏳ Searching…';

  try {
    const r = await API.getBulkWhatsAppCandidates({
      fromDate, toDate,
      models:  selectedBulkWaModels.join(',')  || 'all',
      sources: selectedBulkWaSources.join(',') || 'all',
      notPurchased
    });
    btn.disabled = false;
    btn.textContent = '🔍 Find Customers';

    if (!r.success) { showMessage(r.message || 'Search failed', 'error'); return; }

    bulkWaCandidates = r.leads || [];
    document.getElementById('bulkWaResultsSection').style.display = 'block';
    document.getElementById('bulkWaMatchCount').textContent = bulkWaCandidates.length;
    document.getElementById('bulkWaSelectAll').checked = true;
    document.getElementById('bulkWaResultSummary').innerHTML = '';
    document.getElementById('bulkWaProgress').style.display = 'none';

    const listEl = document.getElementById('bulkWaCustomerList');
    if (bulkWaCandidates.length === 0) {
      listEl.innerHTML = '<div style="padding:16px;color:#999;font-size:13px;text-align:center;">No customers match this filter</div>';
      return;
    }
    listEl.innerHTML = bulkWaCandidates.map((c, idx) =>
      '<label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #f3f3f3;cursor:pointer;font-size:13px;">' +
      '<input type="checkbox" class="bulk-wa-cust-cb" value="' + idx + '" checked>' +
      '<span style="flex:1;"><strong>' + esc(c.customerName) + '</strong><br>' +
      '<span style="color:#888;font-size:11px;">' + esc(c.mobileNo) + ' · ' + esc(c.model || '—') + ' · ' + esc(c.assignedTo || 'Pool') + '</span></span>' +
      '</label>'
    ).join('');
  } catch(e) {
    btn.disabled = false;
    btn.textContent = '🔍 Find Customers';
    showMessage('Search failed', 'error');
  }
}

function toggleBulkWaSelectAll() {
  const checked = document.getElementById('bulkWaSelectAll').checked;
  document.querySelectorAll('.bulk-wa-cust-cb').forEach(cb => cb.checked = checked);
}

async function sendBulkWaMessages() {
  const templateKey = document.getElementById('bulkWaTemplateSelect').value;
  if (!templateKey) { showMessage('Please select a message template', 'error'); return; }

  const selectedIdx = Array.from(document.querySelectorAll('.bulk-wa-cust-cb')).filter(cb => cb.checked).map(cb => parseInt(cb.value));
  if (selectedIdx.length === 0) { showMessage('Select at least one customer', 'error'); return; }

  const selectedLeads = selectedIdx.map(i => bulkWaCandidates[i]);
  const leadIds = selectedLeads.map(l => l.leadId);

  const sendBtn = document.getElementById('bulkWaSendBtn');
  sendBtn.disabled = true;
  sendBtn.textContent = '⏳ Sending…';

  const progressEl = document.getElementById('bulkWaProgress');
  const progressText = document.getElementById('bulkWaProgressText');
  const progressBar = document.getElementById('bulkWaProgressBar');
  progressEl.style.display = 'block';

  const BATCH_SIZE = 20;
  let sentCount = 0, failCount = 0;
  const failedNames = [];

  for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
    const batch = leadIds.slice(i, i + BATCH_SIZE);
    progressText.textContent = 'Sending ' + Math.min(i + BATCH_SIZE, leadIds.length) + ' of ' + leadIds.length + '…';
    progressBar.style.width = Math.round((i / leadIds.length) * 100) + '%';

    try {
      const r = await API.sendBulkWhatsAppBatch(batch, templateKey);
      if (r.success && r.results) {
        r.results.forEach(res => {
          if (res.success) sentCount++;
          else { failCount++; failedNames.push(res.customerName || res.leadId); }
        });
      } else {
        failCount += batch.length;
      }
    } catch(e) {
      failCount += batch.length;
    }
  }

  progressBar.style.width = '100%';
  progressText.textContent = 'Done';
  sendBtn.disabled = false;
  sendBtn.textContent = '📤 Send WhatsApp to Selected';

  const summaryEl = document.getElementById('bulkWaResultSummary');
  summaryEl.innerHTML =
    '<div style="color:#166534;font-weight:700;">✅ Sent: ' + sentCount + '</div>' +
    (failCount > 0 ? '<div style="color:#dc3545;font-weight:700;margin-top:4px;">❌ Failed: ' + failCount +
      (failedNames.length ? ' (' + failedNames.slice(0, 5).map(esc).join(', ') + (failedNames.length > 5 ? '…' : '') + ')' : '') + '</div>' : '');
}

// ── ALL LEADS TAB ──────────────────────────

async function loadAllLeads() {
  const container = document.getElementById('allLeadsContent');
  const loading   = document.getElementById('allLeadsLoading');
  if (!container) return;
  loading.style.display = '';
  container.innerHTML   = '';

  try {
    const isAdmin = currentUser.role === 'admin';
    const response = isAdmin ? await API.getAllLeads() : await API.getMyLeads();
    loading.style.display = 'none';
    if (!response.success) { container.innerHTML = errorHtml(response.message); return; }

    allLeadsAll = response.leads || [];
    currentAllLeadsStatusFilter = 'all';
    currentAllLeadsSourceFilter = 'all';
    currentAllLeadsExecFilter   = 'all';

    // Reset filter chips UI
    document.querySelectorAll('#allLeadsStatusFilter .filter-chip').forEach(c => c.classList.remove('active'));
    const firstSt = document.querySelector('#allLeadsStatusFilter .filter-chip');
    if (firstSt) firstSt.classList.add('active');

    // Build executive list for exec filter (admin only)
    if (isAdmin) {
      const execSet = new Set();
      allLeadsAll.forEach(l => { if (l.assignedTo) execSet.add(l.assignedTo); });
      allExecutives = Array.from(execSet).sort();
      const execFilter = document.getElementById('allLeadsExecFilter');
      if (execFilter) {
        execFilter.style.display = '';
        const execSel = document.getElementById('allLeadsExecSelect');
        if (execSel) {
          execSel.innerHTML = '<option value="all">All Executives</option>' +
            allExecutives.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
        }
      }
    }

    applyAllLeadsFilters();
  } catch(e) {
    loading.style.display = 'none';
    container.innerHTML = errorHtml('Error loading leads');
  }
}

function setAllLeadsStatusFilter(filter, el) {
  currentAllLeadsStatusFilter = filter;
  document.querySelectorAll('#allLeadsStatusFilter .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  applyAllLeadsFilters();
}

function setAllLeadsSourceFilter(filter, el) {
  currentAllLeadsSourceFilter = filter;
  document.querySelectorAll('#allLeadsSourceFilter .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  applyAllLeadsFilters();
}

function setAllLeadsExecFilter() {
  const sel = document.getElementById('allLeadsExecSelect');
  currentAllLeadsExecFilter = sel ? sel.value : 'all';
  applyAllLeadsFilters();
}

function filterAllLeadsByName() {
  const el = document.getElementById('allLeadsSearch');
  currentAllLeadsSearch = el ? el.value : '';
  applyAllLeadsFilters();
}

function applyAllLeadsFilters() {
  let leads = allLeadsAll;

  if (currentAllLeadsStatusFilter !== 'all') {
    leads = leads.filter(l => (l.status || 'Pool') === currentAllLeadsStatusFilter);
  }
  if (currentAllLeadsSourceFilter === 'walkin') {
    leads = leads.filter(l => l.source && l.source.toLowerCase().includes('walk'));
  } else if (currentAllLeadsSourceFilter === 'other') {
    leads = leads.filter(l => !l.source || !l.source.toLowerCase().includes('walk'));
  }
  if (currentAllLeadsExecFilter !== 'all') {
    leads = leads.filter(l => l.assignedTo === currentAllLeadsExecFilter);
  }
  const fromEl = document.getElementById('allLeadsFromDate');
  const toEl   = document.getElementById('allLeadsToDate');
  const fromDate = fromEl && fromEl.value ? fromEl.value : '';
  const toDate   = toEl   && toEl.value   ? toEl.value   : '';
  if (fromDate || toDate) {
    leads = leads.filter(l => {
      if (!l.createdDate) return true;
      if (fromDate && l.createdDate < fromDate) return false;
      if (toDate   && l.createdDate > toDate)   return false;
      return true;
    });
  }
  if (currentAllLeadsSearch) leads = leads.filter(l => _nameMatch(l, currentAllLeadsSearch));

  const sortEl = document.getElementById('allLeadsSort');
  const sortBy = sortEl ? sortEl.value : 'createdDesc';
  leads = leads.slice().sort((a, b) => {
    if (sortBy === 'createdAsc')  return (a.createdDate || '').localeCompare(b.createdDate || '');
    if (sortBy === 'createdDesc') return (b.createdDate || '').localeCompare(a.createdDate || '');
    if (sortBy === 'nameAsc')     return (a.customerName || '').localeCompare(b.customerName || '');
    if (sortBy === 'nameDesc')    return (b.customerName || '').localeCompare(a.customerName || '');
    if (sortBy === 'agingDesc')   return (b.agingDays || 0) - (a.agingDays || 0);
    return 0;
  });

  allLeadsFiltered = leads;
  renderAllLeads();
}

function clearAllLeadsDateFilter() {
  const fromEl = document.getElementById('allLeadsFromDate');
  const toEl   = document.getElementById('allLeadsToDate');
  if (fromEl) fromEl.value = '';
  if (toEl)   toEl.value   = '';
  applyAllLeadsFilters();
}

function renderAllLeads() {
  const container = document.getElementById('allLeadsContent');
  if (!container) return;

  // Summary line
  const total = allLeadsAll.length;
  const shown = allLeadsFiltered.length;
  const converted = allLeadsFiltered.filter(l => l.status === 'Converted').length;
  const overdue    = allLeadsFiltered.filter(l => l.isOverdue).length;

  let html = `<div style="display:flex;gap:10px;padding:10px 16px 0;flex-wrap:wrap;">
    <span style="font-size:12px;color:#888;">Showing <strong>${shown}</strong> of <strong>${total}</strong> leads</span>
    ${converted > 0 ? `<span style="font-size:12px;color:#66BB6A;font-weight:700;">✅ ${converted} converted</span>` : ''}
    ${overdue > 0   ? `<span style="font-size:12px;color:#ef5350;font-weight:700;">⚠️ ${overdue} overdue</span>` : ''}
  </div>`;

  if (allLeadsFiltered.length === 0) {
    html += `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No leads</div><div class="empty-sub">No leads match the current filter</div></div>`;
    container.innerHTML = html;
    return;
  }

  html += allLeadsFiltered.map(l => allLeadCardHtml(l)).join('');
  container.innerHTML = html;
}

function allLeadCardHtml(lead) {
  const stClass = statusClass(lead.status);
  const overdueClass = lead.isOverdue ? ' overdue-left' : '';
  const overdueBadge = lead.isOverdue ? `<span class="overdue-badge">⚠️ ${lead.daysOverdue}d overdue</span>` : '';

  return `<div class="lead-card ${stClass}${overdueClass}">
    <div class="lead-top">
      <div class="lead-name">${esc(lead.customerName)}</div>
      <div class="lead-badges">
        <span class="status-pill ${pillClass(lead.status)}">${esc(lead.status || 'Pool')}</span>
        ${overdueBadge}
        ${agingBadgeHtml(lead.agingDays)}
      </div>
    </div>
    <div class="lead-info">
      <div class="lead-info-row">📱 ${esc(lead.mobileNo)} &nbsp;🚗 ${esc(lead.model)}</div>
      <div class="lead-info-row">📲 ${esc(lead.source || '—')} &nbsp;👤 ${esc(lead.assignedTo || 'Pool')}</div>
      ${lead.followUpDate ? `<div class="lead-info-row">📅 Follow-up: ${esc(lead.followUpDate)}</div>` : ''}
      <div class="lead-info-row" style="color:#aaa;font-size:11px;">📅 Added: ${esc(lead.createdDate || '')}</div>
    </div>
    <div class="lead-actions">
      <button class="btn-act btn-call-act" onclick="callLead('${esc(lead.mobileNo)}')">📞 Call</button>
      <button class="btn-act btn-log-act"  onclick="openLogSheet('${lead.leadId}')">📝 Log</button>
      <button class="btn-act btn-edit-act" onclick="openLead('${lead.leadId}')">Details</button>
    </div>
  </div>`;
}

// ── ADMIN TAB ──────────────────────────────

function _todayISOStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

async function loadAdmin() {
  // Pre-fill calls report dates to today if not already set
  const fromEl = document.getElementById('callsFromDate');
  const toEl   = document.getElementById('callsToDate');
  const today  = _todayISOStr();
  if (fromEl && !fromEl.value) fromEl.value = today;
  if (toEl   && !toEl.value)   toEl.value   = today;
  const container = document.getElementById('adminContent');
  const loading = document.getElementById('adminLoading');
  loading.style.display = '';
  container.innerHTML = '';

  try {
    const analyticsResp = await API.getCRMAnalytics();

    loading.style.display = 'none';

    // Build executive list for assign (from analytics, no full-leads fetch needed here)
    if (analyticsResp.success && analyticsResp.analytics.byExecutive) {
      allExecutives = analyticsResp.analytics.byExecutive.map(e => e.executive);
    }

    let html = '';

    // All Leads — load-on-demand (avoids fetching/rendering the entire CRM_Leads sheet on every admin tab open)
    html += `<div style="padding:12px 16px 8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-size:14px;font-weight:800;color:#333;">All Leads</div>
        <button onclick="loadAdminLeadsList()" id="adminLeadsLoadBtn"
          style="background:#f0f4ff;color:#667eea;border:2px solid #667eea;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;">
          📋 Load List
        </button>
      </div>
      <div class="filter-row" id="adminLeadsStatusFilter" style="display:none;">
        <div class="filter-chip active" onclick="setAdminLeadsStatusFilter('all',this)">All</div>
        <div class="filter-chip" onclick="setAdminLeadsStatusFilter('New',this)">New</div>
        <div class="filter-chip" onclick="setAdminLeadsStatusFilter('Contacted',this)">Contacted</div>
        <div class="filter-chip" onclick="setAdminLeadsStatusFilter('Interested',this)">Interested</div>
        <div class="filter-chip" onclick="setAdminLeadsStatusFilter('Converted',this)">✅ Converted</div>
        <div class="filter-chip" onclick="setAdminLeadsStatusFilter('Lost',this)">❌ Lost</div>
        <div class="filter-chip" onclick="setAdminLeadsStatusFilter('Pool',this)">Pool</div>
      </div>
      <div id="adminLeadsListContent"></div>
    </div>`;

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

async function loadAdminFinancierAnalytics() {
  // Called lazily when admin clicks the Financier Analytics section
  await loadFinancierAnalytics();
}

// ── Admin tab: "All Leads" list (load-on-demand, with status filter) ──

let _adminLeadsAll = [];
let _adminLeadsStatusFilter = 'all';

async function loadAdminLeadsList() {
  const btn = document.getElementById('adminLeadsLoadBtn');
  const listEl = document.getElementById('adminLeadsListContent');
  const filterRow = document.getElementById('adminLeadsStatusFilter');
  if (!listEl) return;

  btn.disabled = true;
  btn.textContent = '⏳ Loading…';
  listEl.innerHTML = '<div style="padding:16px;color:#999;font-size:13px;text-align:center;">Loading…</div>';

  try {
    const r = await API.getAllLeads();
    btn.disabled = false;
    btn.textContent = '🔄 Refresh';

    if (!r.success) { listEl.innerHTML = errorHtml(r.message); return; }

    _adminLeadsAll = r.leads || [];
    _adminLeadsStatusFilter = 'all';
    if (filterRow) {
      filterRow.style.display = '';
      filterRow.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      const firstChip = filterRow.querySelector('.filter-chip');
      if (firstChip) firstChip.classList.add('active');
    }

    // Refresh executive list for assign, now that the full lead set is available
    const execSet = new Set();
    _adminLeadsAll.forEach(l => { if (l.assignedTo) execSet.add(l.assignedTo); });
    if (execSet.size > 0) allExecutives = Array.from(execSet);

    renderAdminLeadsList();
  } catch(e) {
    btn.disabled = false;
    btn.textContent = '🔄 Refresh';
    listEl.innerHTML = errorHtml('Error loading leads');
  }
}

function setAdminLeadsStatusFilter(filter, el) {
  _adminLeadsStatusFilter = filter;
  const filterRow = document.getElementById('adminLeadsStatusFilter');
  if (filterRow) {
    filterRow.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  }
  renderAdminLeadsList();
}

function renderAdminLeadsList() {
  const listEl = document.getElementById('adminLeadsListContent');
  if (!listEl) return;

  const leads = _adminLeadsStatusFilter === 'all'
    ? _adminLeadsAll
    : _adminLeadsAll.filter(l => (l.status || 'Pool') === _adminLeadsStatusFilter);

  if (leads.length === 0) {
    listEl.innerHTML = '<div style="padding:16px;color:#999;font-size:13px;text-align:center;">No leads match this filter</div>';
    return;
  }

  listEl.innerHTML = `<div style="padding:6px 0;font-size:12px;color:#888;">Showing ${leads.length} of ${_adminLeadsAll.length} leads</div>` +
    leads.map(l => adminLeadCardHtml(l)).join('');
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
  const container  = document.getElementById('analyticsContent');
  const btn        = document.getElementById('analyticsRefreshBtn');
  const monthSel   = document.getElementById('analyticsMonthFilter');
  const monthFilter = monthSel ? monthSel.value : 'all';

  container.innerHTML = '<div class="loading"><div class="spinner"></div><div>Loading analytics...</div></div>';
  if (btn) btn.disabled = true;

  try {
    const r = await API.getCRMAnalytics(monthFilter);
    if (btn) btn.disabled = false;
    if (!r.success) { container.innerHTML = errorHtml(r.message); return; }

    const a = r.analytics;

    // Populate month dropdown on first load
    if (monthSel && monthSel.options.length <= 1 && a.availableMonths) {
      a.availableMonths.forEach(function(m) {
        const opt = document.createElement('option');
        opt.value = m;
        const [y, mo] = m.split('-');
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        opt.textContent = (months[parseInt(mo)-1] || mo) + ' ' + y;
        monthSel.appendChild(opt);
      });
      if (monthFilter !== 'all') monthSel.value = monthFilter;
    }

    let html = '';

    // ── Totals summary ─────────────────────────────────────────────────
    if (a.totals) {
      const t = a.totals;
      const convRate = t.total > 0 ? Math.round(t.converted * 100 / t.total) : 0;
      html += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:12px 16px 4px;">
        ${[['Total Leads','📋',t.total,'#667eea'],['Converted','✅',t.converted,'#388E3C'],
           ['Active','🔄',t.active,'#FF9800'],['Lost','❌',t.lost,'#ef5350']]
          .map(([l,ic,v,c]) => `<div style="background:white;border-radius:10px;padding:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
            <div style="font-size:18px;">${ic}</div>
            <div style="font-size:22px;font-weight:800;color:${c};">${v}</div>
            <div style="font-size:11px;color:#888;">${l}</div></div>`).join('')}
      </div>
      <div style="padding:4px 16px 8px;font-size:13px;color:#555;text-align:center;">
        Overall conversion rate: <strong style="color:#667eea;">${convRate}%</strong>
      </div>`;
    }

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

// ── CALLS REPORT ───────────────────────────

let _callsReportData = [];   // all loaded calls, for client-side filtering

async function loadCallsReport() {
  const container = document.getElementById('callsReportContent');
  const btn       = document.getElementById('callsReportBtn');
  if (!container) return;

  const fromDate = document.getElementById('callsFromDate').value;
  const toDate   = document.getElementById('callsToDate').value;
  if (!fromDate || !toDate) { showMessage('Select both From and To dates', 'error'); return; }

  container.innerHTML = '<div class="loading" style="padding:20px;"><div class="spinner"></div><div>Loading calls...</div></div>';
  if (btn) btn.disabled = true;

  try {
    const r = await API.getCallsReport(fromDate, toDate);
    if (btn) btn.disabled = false;
    if (!r.success) { container.innerHTML = errorHtml(r.message); return; }

    _callsReportData = r.calls || [];

    // Build executive filter list
    const execSel = document.getElementById('callsExecFilter');
    if (execSel) {
      const execs = [...new Set(_callsReportData.map(c => c.by).filter(Boolean))].sort();
      execSel.innerHTML = '<option value="">All Executives</option>' +
        execs.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
    }
    document.getElementById('callsTypeFilter').value = '';
    const filtersEl = document.getElementById('callsFilters');
    if (filtersEl) filtersEl.style.display = _callsReportData.length > 0 ? 'flex' : 'none';

    applyCallsFilters();
  } catch(e) {
    if (btn) btn.disabled = false;
    container.innerHTML = errorHtml('Error loading calls');
  }
}

function applyCallsFilters() {
  const container  = document.getElementById('callsReportContent');
  const execFilter = (document.getElementById('callsExecFilter')  || {}).value || '';
  const typeFilter = (document.getElementById('callsTypeFilter')   || {}).value || '';

  let calls = _callsReportData;

  if (execFilter) calls = calls.filter(c => c.by === execFilter);
  if (typeFilter) {
    calls = calls.filter(c => {
      const t = (c.type || '').toLowerCase();
      if (typeFilter === 'called')       return t.includes('called');
      if (typeFilter === 'whatsapp')     return t.includes('whatsapp') && !t.includes('bulk');
      if (typeFilter === 'bulkwhatsapp') return t.includes('bulk') && t.includes('whatsapp');
      if (typeFilter === 'brochure')     return t.includes('brochure');
      if (typeFilter === 'quotation')    return t.includes('quotation');
      if (typeFilter === 'finance')    return t.includes('finance');
      if (typeFilter === 'visit')      return t.includes('visit') || t.includes('showroom');
      return true;
    });
  }

  if (calls.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📵</div><div class="empty-title">No interactions</div><div class="empty-sub">No interactions match the filter</div></div>`;
    return;
  }

  let html = `<div style="padding:8px 0 4px;font-size:12px;color:#888;font-weight:700;">${calls.length} interaction${calls.length !== 1 ? 's' : ''}</div>
  <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
    <table class="analytics-table" style="min-width:820px;font-size:12px;">
      <thead>
        <tr>
          <th style="white-space:nowrap;">Date &amp; Time</th>
          <th>Customer</th>
          <th>Mobile</th>
          <th>Model</th>
          <th>Type</th>
          <th>Notes</th>
          <th>Executive</th>
          <th>Financier</th>
          <th style="white-space:nowrap;text-align:center;">Accel.</th>
          <th style="white-space:nowrap;">Follow-up</th>
        </tr>
      </thead>
      <tbody>
        ${calls.map(c => `<tr>
          <td style="white-space:nowrap;color:#888;font-size:11px;">${esc(c.datetime)}</td>
          <td style="font-weight:700;white-space:nowrap;">
            <span style="color:#667eea;cursor:pointer;text-decoration:underline;" onclick="openLead('${c.leadId}')">${esc(c.customerName)}</span>
          </td>
          <td style="white-space:nowrap;">
            <a href="tel:${esc(c.mobile)}" style="color:#4CAF50;font-weight:700;text-decoration:none;">${esc(c.mobile)}</a>
          </td>
          <td style="font-size:11px;">${esc(c.model || '—')}</td>
          <td><span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:8px;background:${callTypeColor(c.type)}22;color:${callTypeColor(c.type)};white-space:nowrap;">${esc(c.type)}</span></td>
          <td style="font-size:12px;color:#444;font-style:${c.note ? 'italic' : 'normal'};max-width:180px;">${c.note ? esc(c.note) : '<span style="color:#ccc;">—</span>'}</td>
          <td style="font-size:11px;white-space:nowrap;">${esc(c.by)}</td>
          <td style="font-size:11px;white-space:nowrap;color:${c.financierAssigned ? '#444' : '#ccc'};">${c.financierAssigned ? esc(c.financierAssigned) : '—'}</td>
          <td style="text-align:center;font-size:14px;font-weight:700;">${c.punchedInAccelerator ? '<span style="color:#4CAF50;">✓</span>' : '<span style="color:#ccc;">✗</span>'}</td>
          <td style="font-size:11px;white-space:nowrap;${c.followUpDate ? 'color:#667eea;font-weight:700;' : 'color:#ccc;'}">${c.followUpDate ? esc(c.followUpDate) : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
  container.innerHTML = html;
}

function callTypeColor(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('answered'))    return '#4CAF50';
  if (t.includes('no answer'))   return '#ef5350';
  if (t.includes('whatsapp'))    return '#25D366';
  if (t.includes('visit'))       return '#FF7043';
  if (t.includes('quotation'))   return '#667eea';
  return '#9E9E9E';
}

// ── LEAD DETAIL ────────────────────────────

async function openLead(leadId) {
  const myToken = ++_openLeadToken;  // each click gets a unique token
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
    if (_openLeadToken !== myToken) return;  // a newer lead was clicked — discard this result
    if (!r.success) { document.getElementById('detailSheetBody').innerHTML = errorHtml(r.message); return; }
    renderLeadDetail(r.lead);
  } catch(e) {
    if (_openLeadToken === myToken)
      document.getElementById('detailSheetBody').innerHTML = errorHtml('Error loading lead');
  }
}

function renderLeadDetail(lead) {
  const isAdmin      = currentUser.role === 'admin';
  const isFinancier  = currentUser.role === 'financier';
  const isOwner      = isAdmin || lead.assignedTo === currentUser.name ||
                       (isFinancier && lead.financierAssigned === currentUser.name);

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
      <a href="crm-quote.html?leadId=${lead.leadId}&quotNo=${esc(q.quotNo)}" style="font-size:12px;font-weight:700;color:#667eea;text-decoration:none;white-space:nowrap;padding:4px 10px;border:1.5px solid #667eea;border-radius:8px;">
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
    <div style="padding:0 18px 14px;display:flex;gap:8px;">
      <button class="btn-act btn-edit-act" style="flex:1;" onclick="openAssignSheet('${lead.leadId}')">👤 Assign Exec</button>
      <button class="btn-act" style="flex:1;background:linear-gradient(135deg,#11998e,#38ef7d);color:white;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;"
        onclick="openAssignFinancierSheet('${lead.leadId}')">🏦 Assign Financier</button>
    </div>
  ` : '';

  // Finance section
  const hasFinance = lead.financierAssigned || lead.loanStatus;
  const loanColor  = {'Applied':'#FF9800','Under Process':'#9C27B0','Approved':'#4CAF50','Disbursed':'#388E3C','Rejected':'#ef5350'}[lead.loanStatus] || '#9E9E9E';
  const financeSection = hasFinance ? `
    <div class="detail-section">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div class="detail-section-title">🏦 Finance Details</div>
        ${(isAdmin || isFinancier) && lead.financierAssigned ? `<button class="btn-act" style="padding:5px 12px;font-size:12px;background:#f0f9ff;color:#11998e;border:1.5px solid #11998e;border-radius:8px;cursor:pointer;font-weight:700;"
          onclick="openFinanceSheet('${lead.leadId}')">✏️ Update</button>` : ''}
      </div>
      ${lead.financierAssigned ? `<div class="detail-row"><span class="detail-label">Financier</span><span class="detail-value" style="font-weight:800;">${esc(lead.financierAssigned)}</span></div>` : ''}
      ${lead.loanStatus ? `<div class="detail-row"><span class="detail-label">Loan Status</span><span class="detail-value"><span style="font-weight:700;color:${loanColor};">${esc(lead.loanStatus)}</span></span></div>` : ''}
      ${lead.financeScheme ? `<div class="detail-row"><span class="detail-label">Scheme</span><span class="detail-value">${esc(lead.financeScheme)}</span></div>` : ''}
      ${lead.downPayment > 0            ? `<div class="detail-row"><span class="detail-label">Down Payment</span><span class="detail-value">₹${lead.downPayment.toLocaleString('en-IN')}</span></div>` : ''}
      ${lead.loanAmount > 0             ? `<div class="detail-row"><span class="detail-label">Loan Amount</span><span class="detail-value">₹${lead.loanAmount.toLocaleString('en-IN')}</span></div>` : ''}
      ${lead.emi > 0                    ? `<div class="detail-row"><span class="detail-label">EMI</span><span class="detail-value">₹${lead.emi.toLocaleString('en-IN')}/month</span></div>` : ''}
      ${lead.tenure > 0                 ? `<div class="detail-row"><span class="detail-label">Tenure</span><span class="detail-value">${lead.tenure} months</span></div>` : ''}
      ${lead.financierFollowUpDate      ? `<div class="detail-row"><span class="detail-label" style="color:#11998e;">📅 Follow-up</span><span class="detail-value" style="color:#11998e;font-weight:700;">${esc(lead.financierFollowUpDate)}</span></div>` : ''}
    </div>` : '';

  // Assign financier button — shown to the owning sales exec only when no real financier is
  // assigned yet (blank, or 'No Finance' picked at quotation time — that should still allow
  // assigning a real financier later). Hidden once a real financier is assigned, same as before.
  const noRealFinancier = !lead.financierAssigned || lead.financierAssigned === 'No Finance';
  const assignFinBtn = !isAdmin && currentUser.role === 'sales' && lead.assignedTo === currentUser.name && noRealFinancier ? `
    <div style="padding:0 18px 10px;">
      <button class="btn-act" style="width:100%;background:#f0f9ff;color:#11998e;border:1.5px solid #11998e;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;"
        onclick="openAssignFinancierSheet('${lead.leadId}')">🏦 Assign Financier</button>
    </div>` : '';

  document.getElementById('detailSheetBody').innerHTML = `
    <div class="lead-detail-header">
      <button class="sheet-close" style="float:right;" onclick="closeSheet('detailSheet')">✕</button>
      <div class="lead-detail-name">${esc(lead.customerName)}</div>
      <div class="lead-detail-meta">
        <span class="status-pill ${pillClass(lead.status)}" style="display:inline-block;margin-right:6px;">${esc(lead.status || 'Pool')}</span>
        ${lead.isSocial ? `<span class="social-badge">📲 ${esc(lead.source)}</span>` : ''}
        ${lead.isOverdue ? `<span class="overdue-badge" style="display:inline-block;margin-left:4px;">⚠️ ${lead.daysOverdue}d overdue</span>` : ''}
        ${lead.punchedInAccelerator ? `<span style="display:inline-block;margin-left:4px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;background:#e8f5e9;color:#2e7d32;">🚀 Accelerator</span>` : ''}
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
    ${assignFinBtn}
    ${financeSection}

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

function openLogSheet(leadId, isPoolClaim) {
  pendingPoolClaimLeadId = isPoolClaim ? leadId : null;

  document.getElementById('logLeadId').value = leadId;
  selectedNoteType = '';
  selectedStatusChange = '';
  _setFollowUpDateLimits('logFollowUpDate');

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

  // Show correct interaction type list + follow-up label
  const salesTypes   = document.getElementById('salesLogTypes');
  const financeTypes = document.getElementById('financeLogTypes');
  const isFinancier  = currentUser && currentUser.role === 'financier';
  if (salesTypes)   salesTypes.style.display   = isFinancier ? 'none' : '';
  if (financeTypes) financeTypes.style.display  = isFinancier ? ''     : 'none';
  // Rename follow-up date label based on role
  const fuLabel = document.querySelector('#followupDateRow label');
  if (fuLabel) fuLabel.textContent = isFinancier ? 'Finance Follow-up Date' : 'Next Follow-up Date';

  // Show/hide pool-claim notice
  const poolNotice = document.getElementById('poolClaimNotice');
  if (poolNotice) poolNotice.style.display = isPoolClaim ? '' : 'none';

  openSheet('logSheet');
}

function selectNoteType(el, type) {
  selectedNoteType = type;
  document.querySelectorAll('.note-type-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');

  document.getElementById('lostReasonSection').style.display  = type === 'Lost' ? '' : 'none';
  document.getElementById('otherNoteSection').style.display   = type !== 'Lost' ? '' : 'none'; // show for ALL except Lost
  document.getElementById('followupDateRow').style.display    = type === 'Lost' ? 'none' : '';
  document.getElementById('statusChangeRow').style.display    = (type !== 'Lost') ? '' : 'none';

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
  } else {
    note = document.getElementById('otherNoteText').value.trim();
    if (!note) { alert('Please enter interaction notes — what was discussed?'); return; }
  }

  const followUpDate = document.getElementById('logFollowUpDate').value || null;
  // Follow-up date is mandatory for all types except Lost
  if (selectedNoteType !== 'Lost' && !followUpDate) {
    alert('Please select a next follow-up date');
    return;
  }

  const btn = document.getElementById('logSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    // If pool claim: claim lead first, then log
    if (pendingPoolClaimLeadId) {
      btn.textContent = 'Claiming...';
      const cr = await API.claimLead(pendingPoolClaimLeadId);
      if (!cr.success) {
        showMessage(cr.message || 'Could not claim lead', 'error');
        btn.disabled = false; btn.textContent = 'Save Log';
        return;
      }
      showMessage('Lead claimed — saving interaction...', 'info');
    }

    // Log interaction
    const r = await API.logCRMInteraction(leadId, selectedNoteType, note, followUpDate);
    if (!r.success) { showMessage(r.message || 'Error', 'error'); btn.disabled = false; btn.textContent = 'Save Log'; return; }

    // Update status if selected
    if (selectedStatusChange) {
      await API.updateLead(leadId, { status: selectedStatusChange, followUpDate: followUpDate || undefined });
    }

    const wasClaim = !!pendingPoolClaimLeadId;
    closeSheet('logSheet');  // also clears pendingPoolClaimLeadId

    showMessage(wasClaim ? '✅ Lead claimed & interaction logged!' : '✅ Logged successfully', 'success');
    _bgRefreshDashboard();

    // Refresh current tab
    if (document.getElementById('myLeadsTab').classList.contains('active')) loadMyLeads();
    if (document.getElementById('followupsTab').classList.contains('active')) renderFollowups(currentFollowupFilter);
    if (document.getElementById('poolTab').classList.contains('active')) loadPool();
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
  if (id === 'logSheet') pendingPoolClaimLeadId = null;
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

// For pool leads: dial, then open log sheet — claim happens ONLY after log is submitted
function callPoolLead(mobile, leadId) {
  if (mobile) window.location.href = 'tel:' + mobile;
  openLogSheet(leadId, true);  // isPoolClaim = true
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

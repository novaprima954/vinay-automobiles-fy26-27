// ==========================================
// DASHBOARD PAGE LOGIC
// ==========================================

let currentUser = null;
let currentSessionId = null;
let currentFilter = 'month'; // Default to 'This Month'
let dashboardData = null;
let discountUnlocked = false; // persists within session so filter changes don't re-lock
let discountExcludeApache = false;         // Apache toggle state (admin)
let lastDiscountData = null;               // cached discount data for re-render on toggle (admin)
let discountExcludeApacheAccounts = false; // Apache toggle state (accounts)
let lastAccountsDiscountData = null;       // cached discount data for accounts

document.addEventListener('DOMContentLoaded', async function() {
  console.log('=== DASHBOARD PAGE ===');
  
  // Check authentication
  const session = SessionManager.getSession();
  
  if (!session) {
    console.log('❌ No session - redirecting to login');
    window.location.href = 'index.html';
    return;
  }
  
  currentUser = session.user;
  currentSessionId = session.sessionId;
  console.log('✅ User:', currentUser.name, '| Role:', currentUser.role);

  // Set dynamic month name on filter button (e.g. "April 2026")
  setMonthBtnLabel('month');

  // Load dashboard
  await loadDashboard();
});

/**
 * Load dashboard based on user role
 */
async function loadDashboard() {
  showLoading(true);
  
  try {
    let response;
    
    if (currentUser.role === 'sales') {
      response = await API.getSalesDashboard(currentFilter);
      if (response.success) {
        renderSalesDashboard(response.dashboard);
      }
    } else if (currentUser.role === 'accounts') {
      response = await API.getAccountsDashboard(currentSessionId, currentFilter);
      if (response.success) {
        renderAccountsDashboard(response.dashboard);
      }
    } else if (currentUser.role === 'accessories') {
      response = await API.getAccessoriesDashboard(currentFilter);
      if (response.success) {
        renderAccessoriesDashboard(response.dashboard);
      }
    } else if (currentUser.role === 'admin') {
      response = await API.getAdminDashboard(currentFilter);
      if (response.success) {
        renderAdminDashboard(response.dashboard);
      }
    } else {
      showMessage('Dashboard not available for your role', 'error');
    }
    
    if (!response || !response.success) {
      showMessage(response?.message || 'Error loading dashboard', 'error');
    }
    
    showLoading(false);
    
  } catch (error) {
    console.error('Dashboard error:', error);
    showMessage('Error loading dashboard', 'error');
    showLoading(false);
  }
}

/**
 * Render Sales Dashboard
 */
function renderSalesDashboard(data) {
  dashboardData = data;
  document.getElementById('dashboardTitle').textContent = '📊 My Performance';
  
  const content = document.getElementById('dashboardContent');
  content.innerHTML = `
    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card blue">
        <div class="stat-icon">🛒</div>
        <div class="stat-label">My Sales</div>
        <div class="stat-value">${data.mySales}</div>
      </div>
      
      <div class="stat-card green">
        <div class="stat-icon">✅</div>
        <div class="stat-label">Completed</div>
        <div class="stat-value">${data.myCompletedSales}</div>
      </div>
      
      <div class="stat-card purple">
        <div class="stat-icon">🏆</div>
        <div class="stat-label">My Rank</div>
        <div class="stat-value">#${data.myRank}/${data.totalExecutives}</div>
      </div>
    </div>

    <!-- Target Progress -->
    <div class="section">
      <div class="section-header">🎯 Target Progress — This Month</div>
      ${data.target > 0 ? `
        <div class="progress-container">
          <div class="progress-label">
            <span>${data.myCompletedSalesThisMonth} completed / ${data.target} target</span>
            <span style="font-weight:700; color:${data.targetProgress >= 100 ? '#4CAF50' : '#667eea'};">${data.targetProgress}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(data.targetProgress, 100)}%; background: ${data.targetProgress >= 100 ? 'linear-gradient(90deg,#4CAF50,#45a049)' : 'linear-gradient(90deg,#667eea,#764ba2)'};"></div>
          </div>
          <div style="margin-top: 8px; font-size: 13px; color: #666;">
            ${data.target - data.myCompletedSalesThisMonth > 0
              ? (data.target - data.myCompletedSalesThisMonth) + ' more needed to hit target'
              : '🎉 Target achieved!'}
            &nbsp;·&nbsp; ${data.myTotalSalesThisMonth} bookings this month
          </div>
        </div>
      ` : '<div class="empty-state">No target set for this month</div>'}
    </div>

    <!-- Model Breakdown -->
    <div class="section">
      <div class="section-header">🏍️ My Models Sold (Completed Sales)</div>
      ${data.modelBreakdown && data.modelBreakdown.length > 0 ? `
        <div class="accessories-grid">
          ${data.modelBreakdown.map(model => `
            <div class="accessory-item">
              <div class="accessory-name">${model.model}</div>
              <div class="accessory-count">${model.count}</div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="empty-state">No completed sales yet</div>'}
    </div>

    <!-- Monthly Trend -->
    ${data.monthlyTrend && data.monthlyTrend.length > 0 ? `
    <div class="section">
      <div class="section-header">📈 Monthly Trend (Last 6 Months)</div>
      <div style="margin-top: 15px;">
        ${data.monthlyTrend.map(month => `
          <div style="margin-bottom: 12px;">
            <div class="progress-label">
              <span style="font-weight: 600;">${month.month}</span>
              <span style="font-weight: 700; color: #667eea;">${month.count} sales</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${month.percentage}%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Daily Bookings vs Retail Sales (current / selected month) -->
    ${data.dailyTrend && data.dailyTrend.some(function(d){return (d.bookings||d.count||0)>0;}) ? `
    <div class="section">
      <div class="section-header">📅 Daily Activity — This Month</div>
      <!-- Legend -->
      <div style="display:flex;gap:16px;font-size:12px;color:#666;margin-bottom:10px;">
        <span><span style="display:inline-block;width:12px;height:12px;background:#81C784;border-radius:3px;vertical-align:middle;margin-right:4px;"></span>Bookings</span>
        <span><span style="display:inline-block;width:12px;height:12px;background:#667eea;border-radius:3px;vertical-align:middle;margin-right:4px;"></span>Retail Sales</span>
      </div>
      <div>
        ${(function(){
          var todayDate = new Date().getDate();
          var maxB = Math.max.apply(null, data.dailyTrend.map(function(d){ return d.bookings || d.count || 0; })) || 1;
          return data.dailyTrend.map(function(d){
            var bookings = d.bookings !== undefined ? d.bookings : (d.count || 0);
            var sales    = d.sales    !== undefined ? d.sales    : 0;
            var bPct = Math.round((bookings / maxB) * 100);
            var sPct = Math.round((sales    / maxB) * 100);
            var isToday = d.day === todayDate;
            var hasAny  = bookings > 0;
            return '<div style="display:flex;align-items:center;margin-bottom:5px;">' +
              '<div style="width:24px;font-size:11px;color:' + (isToday?'#667eea':'#aaa') + ';font-weight:' + (isToday?'700':'400') + ';text-align:right;margin-right:8px;">' + d.day + '</div>' +
              '<div style="flex:1;position:relative;background:#f0f0f0;border-radius:4px;height:16px;overflow:hidden;">' +
                (bookings > 0 ? '<div style="position:absolute;left:0;top:0;width:' + bPct + '%;height:100%;background:#81C784;border-radius:4px;"></div>' : '') +
                (sales    > 0 ? '<div style="position:absolute;left:0;top:0;width:' + sPct + '%;height:100%;background:#667eea;border-radius:4px;opacity:0.9;"></div>' : '') +
              '</div>' +
              '<div style="width:36px;font-size:11px;font-weight:600;color:#333;text-align:right;margin-left:6px;">' +
                (hasAny ? '<span style="color:#4CAF50;">' + bookings + '</span>' + (sales > 0 ? '/<span style="color:#667eea;">' + sales + '</span>' : '') : '') +
              '</div>' +
            '</div>';
          }).join('');
        })()}
      </div>
    </div>
    ` : ''}

    <!-- Pending Tasks -->
    <div class="section">
      <div class="section-header">⚠️ Pending Tasks</div>
      ${(data.dmsPending > 0 || data.insurancePending > 0 || data.rtoPending > 0 || data.accessoriesPending > 0) ? `
        ${data.dmsPending > 0 ? `
          <div class="list-item" onclick="showPendingDetails('dms', 'DMS')">
            <div class="list-item-main">
              <div class="list-item-title">DMS Pending</div>
              <div class="list-item-subtitle">${data.dmsPending} sales need DMS completion</div>
            </div>
            <span class="badge">${data.dmsPending}</span>
          </div>
        ` : ''}
        ${data.insurancePending > 0 ? `
          <div class="list-item" onclick="showPendingDetails('insurance', 'Insurance')">
            <div class="list-item-main">
              <div class="list-item-title">Insurance Pending</div>
              <div class="list-item-subtitle">${data.insurancePending} sales need insurance processing</div>
            </div>
            <span class="badge">${data.insurancePending}</span>
          </div>
        ` : ''}
        ${data.rtoPending > 0 ? `
          <div class="list-item" onclick="showPendingDetails('rto', 'RTO')">
            <div class="list-item-main">
              <div class="list-item-title">RTO Pending</div>
              <div class="list-item-subtitle">${data.rtoPending} sales need RTO registration</div>
            </div>
            <span class="badge">${data.rtoPending}</span>
          </div>
        ` : ''}
        ${data.accessoriesPending > 0 ? `
          <div class="list-item" onclick="showPendingDetails('accessories', 'Accessories')">
            <div class="list-item-main">
              <div class="list-item-title">Accessories Pending Fitting</div>
              <div class="list-item-subtitle">${data.accessoriesPending} sales need accessories</div>
            </div>
            <span class="badge">${data.accessoriesPending}</span>
          </div>
        ` : ''}
      ` : '<div class="empty-state">No pending tasks ✅</div>'}
    </div>

    <!-- My Accessories -->
    <div class="section">
      <div class="section-header">🔩 My Accessories Count (Completed Sales)</div>
      <div class="accessories-grid">
        <div class="accessory-item" onclick="showAccessoryBreakdown('guard', 'Guard')">
          <div class="accessory-name">Guard</div>
          <div class="accessory-count">${data.myAccessories.guard}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('gripcover', 'Grip Cover')">
          <div class="accessory-name">Grip Cover</div>
          <div class="accessory-count">${data.myAccessories.grip}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('helmet', 'Helmet')">
          <div class="accessory-name">Helmet</div>
          <div class="accessory-count">${data.myAccessories.helmet}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('seatcover', 'Seat Cover')">
          <div class="accessory-name">Seat Cover</div>
          <div class="accessory-count">${data.myAccessories.seatCover}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('matin', 'Matin')">
          <div class="accessory-name">Matin</div>
          <div class="accessory-count">${data.myAccessories.matin}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('tankcover', 'Tank Cover')">
          <div class="accessory-name">Tank Cover</div>
          <div class="accessory-count">${data.myAccessories.tankCover}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('handlehook', 'Handle Hook')">
          <div class="accessory-name">Handle Hook</div>
          <div class="accessory-count">${data.myAccessories.handleHook}</div>
        </div>
      </div>
    </div>

    <!-- Team Comparison -->
    <div class="section">
      <div class="section-header">📊 Executive Comparison (Completed Sales)</div>
      ${data.teamComparison.map((exec, index) => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">
              ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
              ${exec.executive}
              ${exec.executive === currentUser.name ? ' (You)' : ''}
            </div>
            <div class="list-item-subtitle">Total: ${exec.totalSales} sales</div>
          </div>
          <div class="list-item-value">${exec.completedSales}</div>
        </div>
      `).join('')}
    </div>

    <!-- My Delivered Sales (Account Check: Yes) -->
    <div class="section">
      <div class="section-header">📋 My Delivered Sales (Account Check: Yes)</div>
      <div id="myExecDetailContent"><div style="text-align:center;padding:20px;color:#999;">⏳ Loading...</div></div>
    </div>

    <!-- My Full Accessories -->
    <div class="section">
      <div class="section-header">🎯 My Full Accessories</div>
      <div id="myFullAccContent"><div style="text-align:center;padding:20px;color:#999;">⏳ Loading...</div></div>
    </div>
  `;

  content.style.display = 'block';
  loadMyExecDetail();
  loadFullAccessoriesAnalysis('myFullAccContent');
}

/**
 * Render Accounts Dashboard
 */
function renderAccountsDashboard(data) {
  dashboardData = data;
  document.getElementById('dashboardTitle').textContent = '💰 Accounts Dashboard';
  
  const content = document.getElementById('dashboardContent');
  content.innerHTML = `
    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card green">
        <div class="stat-icon">✅</div>
        <div class="stat-label">Checked: Yes</div>
        <div class="stat-value">${data.accountCheckYes}</div>
      </div>
      
      <div class="stat-card red">
        <div class="stat-icon">❌</div>
        <div class="stat-label">Checked: No</div>
        <div class="stat-value">${data.accountCheckNo}</div>
      </div>
      
      <div class="stat-card orange">
        <div class="stat-icon">⚪</div>
        <div class="stat-label">Blank</div>
        <div class="stat-value">${data.accountCheckBlank}</div>
      </div>
    </div>

    <!-- Executive-wise Completed Sales -->
    <div class="section">
      <div class="section-header">👥 Executive-wise Sales (Account Check: Yes)</div>
      ${data.executiveSales && data.executiveSales.length > 0 ? data.executiveSales.map((exec, index) => `
        <div style="border-bottom:1px solid #f0f0f0;">
          <div class="list-item" onclick="toggleExecutiveDetail('${exec.executive}', 'acctExecDetail_${index}', this)" style="cursor:pointer;border-bottom:none;">
            <div class="list-item-main">
              <div class="list-item-title">
                ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
                ${exec.executive}
              </div>
              <div class="list-item-subtitle">🎯 Full Acc: ${exec.fullAccessories || 0} | Tap for detail</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:18px;font-weight:700;color:#667eea;">${exec.completedSales}</span>
              <span class="execChevron" style="color:#999;font-size:12px;transition:transform 0.2s;">▼</span>
            </div>
          </div>
          <div id="acctExecDetail_${index}" style="display:none;"></div>
        </div>
      `).join('') : '<div class="empty-state">No completed sales</div>'}
    </div>

    <!-- Executive-wise Accessories -->
    <div class="section">
      <div class="section-header">🔩 Executive-wise Accessories (Account Check: Yes)</div>
      ${data.executiveAccessories && data.executiveAccessories.length > 0 ? data.executiveAccessories.map((exec, index) => `
        <div class="list-item" onclick="showExecutiveModels('${exec.executive}', 'accessories')">
          <div class="list-item-main">
            <div class="list-item-title">
              ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
              ${exec.executive}
            </div>
            <div class="list-item-subtitle">Click to see accessory breakdown</div>
          </div>
          <div class="list-item-value">${exec.totalAccessories}</div>
        </div>
      `).join('') : '<div class="empty-state">No accessories data</div>'}
    </div>

    <!-- Today's Work -->
    ${data.todaysWork && data.todaysWork.length > 0 ? `
    <div class="section">
      <div class="section-header">📅 Today's Work (${data.todaysWork.length})</div>
      ${data.todaysWork.map(record => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${record.customerName}</div>
            <div class="list-item-subtitle">Receipt: ${record.receiptNo} • ${record.mobileNo}</div>
          </div>
          <span class="badge">NEW</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Pending Reviews -->
    <div class="section">
      <div class="section-header">⏳ Pending Reviews (${data.pendingReviews ? data.pendingReviews.length : 0})</div>
      ${data.pendingReviews && data.pendingReviews.length > 0 ? data.pendingReviews.map(record => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${record.customerName}</div>
            <div class="list-item-subtitle">Receipt: ${record.receiptNo} • ${record.mobileNo}</div>
          </div>
          <span class="badge">${record.daysAgo}d ago</span>
        </div>
      `).join('') : '<div class="empty-state">All caught up! ✅</div>'}
    </div>

    <!-- Discount by Executive (async load) -->
    <div class="section" id="acctDiscountSection">
      <div class="section-header">💸 Discount by Executive</div>
      <div id="acctDiscountContent"><div style="text-align:center;padding:20px;color:#999;">⏳ Loading...</div></div>
    </div>

    <!-- Full Accessories by Executive (async load) -->
    <div class="section" id="acctFullAccSection">
      <div class="section-header">🎯 Full Accessories by Executive</div>
      <div id="acctFullAccContent"><div style="text-align:center;padding:20px;color:#999;">⏳ Loading...</div></div>
    </div>

    <!-- AD Sales from Inventory (async load) -->
    <div class="section" id="acctAdSaleSection">
      <div class="section-header">🤝 AD Sales</div>
      <div id="acctAdSaleContent"><div style="text-align:center;padding:20px;color:#999;">⏳ Loading...</div></div>
    </div>
  `;

  content.style.display = 'block';

  // Load async sections
  loadAccountsDiscountByExec();
  loadFullAccessoriesAnalysis('acctFullAccContent');
  loadAccountsAdSales();
}

/**
 * Toggle Apache filter on accounts discount exec table
 */
function toggleApacheFilterAccounts() {
  discountExcludeApacheAccounts = !discountExcludeApacheAccounts;
  if (lastAccountsDiscountData) renderAccountsDiscountExecTable(lastAccountsDiscountData);
}

/**
 * Render accounts discount exec table with Apache toggle
 */
function renderAccountsDiscountExecTable(d) {
  const container = document.getElementById('acctDiscountContent');
  if (!container) return;
  const fmt = function(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };
  const execData = discountExcludeApacheAccounts
    ? (d.byExecutiveNoApache || d.byExecutive || [])
    : (d.byExecutive || []);

  const rows = execData.length > 0 ? execData.map(function(e) {
    return '<tr style="border-bottom:1px solid #f0f0f0;">' +
      '<td style="padding:8px;font-weight:600;">' + e.executive + '</td>' +
      '<td style="padding:8px;text-align:right;">' + e.deals + '</td>' +
      '<td style="padding:8px;text-align:right;color:#dc3545;font-weight:600;">' + fmt(e.totalDiscount) + '</td>' +
      '<td style="padding:8px;text-align:right;">' + fmt(e.avgDiscount) + '</td>' +
      '<td style="padding:8px;text-align:right;">' + fmt(e.maxDiscount) + '</td>' +
      '</tr>';
  }).join('') : '<tr><td colspan="5" style="padding:15px;text-align:center;color:#999;">No discount data in this period</td></tr>';

  container.innerHTML =
    '<div style="margin-bottom:10px;">' +
      '<label onclick="toggleApacheFilterAccounts()" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;background:#f8f9fa;padding:4px 10px;border-radius:20px;border:1px solid #ddd;user-select:none;">' +
        '<span style="font-size:12px;color:#666;">Excl. Apache</span>' +
        '<div style="width:36px;height:20px;background:' + (discountExcludeApacheAccounts ? '#667eea' : '#ccc') + ';border-radius:10px;position:relative;flex-shrink:0;">' +
          '<div style="position:absolute;top:2px;left:' + (discountExcludeApacheAccounts ? '16' : '2') + 'px;width:16px;height:16px;background:white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>' +
        '</div>' +
      '</label>' +
    '</div>' +
    '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<thead><tr style="background:#f8f9fa;">' +
      '<th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6;">Executive</th>' +
      '<th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Deals</th>' +
      '<th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Total Disc</th>' +
      '<th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Avg</th>' +
      '<th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Max</th>' +
    '</tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';
}

/**
 * Load Discount by Executive for Accounts dashboard (no password, exec table only)
 */
async function loadAccountsDiscountByExec() {
  const container = document.getElementById('acctDiscountContent');
  if (!container) return;
  try {
    const response = await API.call('getDiscountAnalysis', { sessionId: currentSessionId, dateFilter: currentFilter });
    if (response.success) {
      lastAccountsDiscountData = response.data;
      renderAccountsDiscountExecTable(response.data);
    } else {
      container.innerHTML = '<div style="color:#dc3545;padding:15px;text-align:center;">⚠️ ' + (response.message || 'Failed to load') + '</div>';
    }
  } catch(e) {
    container.innerHTML = '<div style="color:#dc3545;padding:15px;">Error loading discount data</div>';
  }
}

/**
 * Load Full Accessories Detail (shared by admin + accounts dashboards)
 * containerId: 'adminFullAccContent' or 'acctFullAccContent'
 */
/**
 * Financier Commission Analysis — admin dashboard
 */
async function loadFinancierCommissionAnalysis() {
  const container = document.getElementById('adminFinCommContent');
  if (!container) return;
  try {
    const response = await API.call('getFinancierCommissionAnalysis', { sessionId: currentSessionId, dateFilter: currentFilter });
    if (response.success && response.data && response.data.length > 0) {
      const fmt = function(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };
      var html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">';
      html += '<thead><tr style="background:#f8f9fa;">';
      html += '<th style="padding:9px 12px;text-align:left;border-bottom:2px solid #dee2e6;">Financier</th>';
      html += '<th style="padding:9px 12px;text-align:right;border-bottom:2px solid #dee2e6;">Count</th>';
      html += '<th style="padding:9px 12px;text-align:right;border-bottom:2px solid #dee2e6;">Total Commission</th>';
      html += '<th style="padding:9px 12px;text-align:right;border-bottom:2px solid #dee2e6;">Total Grand Total</th>';
      html += '<th style="padding:9px 12px;text-align:right;border-bottom:2px solid #dee2e6;">Comm %</th>';
      html += '</tr></thead><tbody>';
      response.data.forEach(function(r) {
        var pct = r.commissionPct;
        var pctColor = pct >= 2 ? '#28a745' : pct >= 1 ? '#fd7e14' : '#dc3545';
        html += '<tr style="border-bottom:1px solid #f0f0f0;">';
        html += '<td style="padding:9px 12px;font-weight:600;">' + r.financier + '</td>';
        html += '<td style="padding:9px 12px;text-align:right;color:#666;">' + r.count + '</td>';
        html += '<td style="padding:9px 12px;text-align:right;font-weight:600;color:#667eea;">' + fmt(r.totalCommission) + '</td>';
        html += '<td style="padding:9px 12px;text-align:right;">' + fmt(r.totalGrandTotal) + '</td>';
        html += '<td style="padding:9px 12px;text-align:right;font-weight:700;color:' + pctColor + ';">' + pct.toFixed(2) + '%</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      container.innerHTML = html;
    } else if (response.success) {
      container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">No financier commission data in this period</div>';
    } else {
      container.innerHTML = '<div style="color:#dc3545;padding:15px;text-align:center;">⚠️ ' + (response.message || 'Failed') + '</div>';
    }
  } catch(e) {
    container.innerHTML = '<div style="color:#dc3545;padding:15px;">Error loading data</div>';
  }
}

async function loadFullAccessoriesAnalysis(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const response = await API.call('getFullAccessoriesDetail', { sessionId: currentSessionId, dateFilter: currentFilter });
    if (response.success) {
      renderFullAccessoriesAnalysis(container, response.data);
    } else {
      container.innerHTML = '<div style="color:#dc3545;padding:15px;text-align:center;">⚠️ ' + (response.message || 'Failed') + '</div>';
    }
  } catch(e) {
    container.innerHTML = '<div style="color:#dc3545;padding:15px;">Error loading data</div>';
  }
}

function renderFullAccessoriesAnalysis(container, data) {
  if (!data || data.length === 0) {
    container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;font-size:13px;">No full accessories sales in this period</div>';
    return;
  }

  var html = '';
  data.forEach(function(exec, idx) {
    var detailId = 'fullAccDetail_' + idx;
    html += '<div style="border-bottom:1px solid #f0f0f0;">';
    html += '<div onclick="toggleFullAccDetail(\'' + detailId + '\', this)" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;cursor:pointer;">';
    html += '<div>';
    html += '<div style="font-weight:700;font-size:14px;color:#333;">' + exec.executive + '</div>';
    html += '<div style="font-size:12px;color:#666;margin-top:2px;">🎯 Full Accessories: ' + exec.count + ' customers</div>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<span style="background:#28a745;color:white;font-size:13px;font-weight:700;padding:4px 10px;border-radius:12px;">' + exec.count + '</span>';
    html += '<span class="fullAccChevron" style="color:#999;font-size:12px;transition:transform 0.2s;">▼</span>';
    html += '</div></div>';

    // Collapsible customer list
    html += '<div id="' + detailId + '" style="display:none;background:#f9fafe;padding:0 16px 14px;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
    html += '<thead><tr style="background:#eef1fb;">';
    html += '<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Date</th>';
    html += '<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Customer</th>';
    html += '<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Model</th>';
    html += '<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Variant</th>';
    html += '</tr></thead><tbody>';
    exec.customers.forEach(function(c) {
      html += '<tr style="border-bottom:1px solid #f0f0f0;">';
      html += '<td style="padding:5px 8px;border:1px solid #ddd;white-space:nowrap;">' + (c.date || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #ddd;font-weight:600;">' + (c.customerName || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #ddd;">' + (c.model || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #ddd;">' + (c.variant || '') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
  });

  container.innerHTML = html;
}

function toggleFullAccDetail(id, rowEl) {
  var detail = document.getElementById(id);
  var chevron = rowEl.querySelector('.fullAccChevron');
  if (!detail) return;
  var open = detail.style.display !== 'none';
  detail.style.display = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
}

/**
 * Load AD Sales from Inventory for Accounts dashboard
 */
async function loadAccountsAdSales() {
  const container = document.getElementById('acctAdSaleContent');
  if (!container) return;
  try {
    const response = await API.call('getInventoryAnalysis', { sessionId: currentSessionId, dateFilter: currentFilter });
    if (response.success) {
      const d = response.data;
      if (!d.adSale || d.adSale.length === 0) {
        container.innerHTML = '<div style="color:#999;text-align:center;padding:15px;">No AD Sales in this period</div>';
        return;
      }
      var adRows = d.adSale.map(function(ad) {
        var itemsHtml = ad.items.map(function(item) {
          return '<div style="display:flex;justify-content:space-between;padding:6px 0 6px 12px;border-bottom:1px solid #f5f5f5;font-size:13px;">' +
            '<span style="color:#555;">' + item.skuName + '</span>' +
            '<span style="font-weight:600;color:#667eea;">' + item.qty + ' units</span>' +
          '</div>';
        }).join('');
        var totalQty = ad.items.reduce(function(s, x) { return s + x.qty; }, 0);
        return '<div style="border:1px solid #e9ecef;border-radius:8px;margin-bottom:12px;overflow:hidden;">' +
          '<div style="background:#f8f9fa;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="font-weight:700;color:#333;font-size:14px;">🏪 ' + ad.adName + '</span>' +
            '<span style="font-size:12px;color:#666;">' + totalQty + ' total units</span>' +
          '</div>' +
          itemsHtml +
        '</div>';
      }).join('');
      container.innerHTML = adRows;
    } else {
      container.innerHTML = '<div style="color:#dc3545;padding:15px;text-align:center;">⚠️ ' + (response.message || 'Failed to load') + '</div>';
    }
  } catch(e) {
    container.innerHTML = '<div style="color:#dc3545;padding:15px;">Error loading AD sales data</div>';
  }
}

/**
 * Render Accessories Dashboard
 */
function renderAccessoriesDashboard(data) {
  dashboardData = data;
  document.getElementById('dashboardTitle').textContent = '🔧 Accessories Dashboard';
  
  const content = document.getElementById('dashboardContent');
  content.innerHTML = `
    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card green">
        <div class="stat-icon">✅</div>
        <div class="stat-label">Fitted</div>
        <div class="stat-value">${data.fitted}</div>
      </div>
      
      <div class="stat-card orange">
        <div class="stat-icon">⏳</div>
        <div class="stat-label">Pending</div>
        <div class="stat-value">${data.pending}</div>
      </div>
      
      <div class="stat-card red">
        <div class="stat-icon">🔧</div>
        <div class="stat-label">Issues</div>
        <div class="stat-value">${data.issues}</div>
      </div>
    </div>

    <!-- Average Fitting Time -->
    <div class="section">
      <div class="section-header">⏱️ Average Fitting Time</div>
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 48px; font-weight: 700; color: #667eea;">${data.avgFittingTime}</div>
        <div style="font-size: 14px; color: #666; margin-top: 5px;">days average</div>
        <div style="margin-top: 10px; font-size: 13px; color: ${data.avgFittingTime <= 2 ? '#4CAF50' : '#FF9800'};">
          Target: < 2 days ${data.avgFittingTime <= 2 ? '✅' : '⚠️'}
        </div>
      </div>
    </div>

    <!-- Overdue Fittings -->
    ${data.overdueList.length > 0 ? `
    <div class="section">
      <div class="section-header">⚠️ Overdue Fittings (${data.overdueList.length})</div>
      ${data.overdueList.map(record => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${record.customerName}</div>
            <div class="list-item-subtitle">Receipt: ${record.receiptNo}</div>
          </div>
          <span class="badge">${record.daysAgo}d</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Pending Deliveries -->
    <div class="section">
      <div class="section-header">📦 Pending Deliveries (${data.pendingList.length})</div>
      ${data.pendingList.length > 0 ? data.pendingList.map(record => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${record.customerName}</div>
            <div class="list-item-subtitle">
              ${record.model} • ${record.accessories}<br>
              Receipt: ${record.receiptNo}
            </div>
          </div>
          <span class="badge">${record.daysAgo}d</span>
        </div>
      `).join('') : '<div class="empty-state">All fitted! ✅</div>'}
    </div>
  `;
  
  content.style.display = 'block';
}

/**
 * Render Admin Dashboard
 */
function renderAdminDashboard(data) {
  dashboardData = data;
  document.getElementById('dashboardTitle').textContent = '📈 Admin Dashboard';

  const acc = data.accessories || {};
  const op = data.operatorStatus || {};

  const content = document.getElementById('dashboardContent');
  content.innerHTML = `
    <!-- Sales Overview -->
    <div class="section">
      <div class="section-header">📊 Sales Overview</div>
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon">📋</div>
          <div class="stat-label">Total Bookings</div>
          <div class="stat-value">${data.totalBookings != null ? data.totalBookings : '—'}</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">✅</div>
          <div class="stat-label">Total Sales</div>
          <div class="stat-value">${data.totalSales}</div>
        </div>
      </div>
    </div>

    <!-- Executive Comparison -->
    <div class="section">
      <div class="section-header">👥 By Executive (Account Check: Yes)</div>
      ${data.executiveList.map((exec, index) => `
        <div style="border-bottom:1px solid #f0f0f0;">
          <div class="list-item" onclick="toggleExecutiveDetail('${exec.executive}', 'adminExecDetail_${index}', this)" style="cursor:pointer;border-bottom:none;">
            <div class="list-item-main">
              <div class="list-item-title">
                ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
                ${exec.executive}
              </div>
              <div class="list-item-subtitle">Bookings: ${exec.totalSales} | 🎯 Full Acc: ${exec.fullAccessories || 0}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:18px;font-weight:700;color:#667eea;">${exec.completedSales}</span>
              <span class="execChevron" style="color:#999;font-size:12px;transition:transform 0.2s;">▼</span>
            </div>
          </div>
          <div id="adminExecDetail_${index}" style="display:none;"></div>
        </div>
      `).join('')}
    </div>

    <!-- Model-wise Sales -->
    ${data.modelBreakdown && data.modelBreakdown.length > 0 ? `
    <div class="section">
      <div class="section-header">🏍️ Model-wise Sales (Account Check: Yes)</div>
      <div class="accessories-grid">
        ${data.modelBreakdown.map(m => `
          <div class="accessory-item">
            <div class="accessory-name">${m.model}</div>
            <div class="accessory-count">${m.count}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Model + Variant Breakdown -->
    ${data.modelVariantBreakdown && data.modelVariantBreakdown.length > 0 ? `
    <div class="section">
      <div class="section-header">🔍 Model + Variant Breakdown</div>
      ${data.modelVariantBreakdown.map(m => `
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f0f4ff;border-radius:8px;border-left:4px solid #667eea;">
            <span style="font-weight:700;color:#333;">${m.model}</span>
            <span style="font-weight:700;color:#667eea;font-size:16px;">${m.total}</span>
          </div>
          ${m.variants.map(v => {
            const pct = Math.round((v.count / m.total) * 100);
            return `<div style="display:flex;align-items:center;padding:5px 12px 5px 24px;gap:8px;">
              <span style="font-size:12px;color:#777;">↳</span>
              <span style="flex:1;font-size:13px;color:#444;">${v.variant}</span>
              <div style="width:80px;background:#f0f0f0;border-radius:4px;height:8px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:#a5b4fc;border-radius:4px;"></div>
              </div>
              <span style="font-size:13px;font-weight:600;color:#333;min-width:20px;text-align:right;">${v.count}</span>
            </div>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Accounts Status -->
    <div class="section">
      <div class="section-header">💰 Accounts Status</div>
      <div class="stats-grid">
        <div class="stat-card green">
          <div class="stat-icon">✅</div>
          <div class="stat-label">Done</div>
          <div class="stat-value">${data.accountsYes}</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">⏳</div>
          <div class="stat-label">Pending</div>
          <div class="stat-value">${data.accountsPending}</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon">❌</div>
          <div class="stat-label">Issues</div>
          <div class="stat-value">${data.accountsIssues}</div>
        </div>
      </div>
    </div>

    <!-- Accessories Status -->
    <div class="section">
      <div class="section-header">🔩 Accessories Status</div>
      <div class="stats-grid">
        <div class="stat-card green">
          <div class="stat-icon">✅</div>
          <div class="stat-label">Fitted</div>
          <div class="stat-value">${data.accessoriesFitted}</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">⏳</div>
          <div class="stat-label">Pending</div>
          <div class="stat-value">${data.accessoriesPending}</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon">🔧</div>
          <div class="stat-label">Issues</div>
          <div class="stat-value">${data.accessoriesIssues}</div>
        </div>
      </div>
    </div>

    <!-- Operator Status -->
    <div class="section">
      <div class="section-header">🏛️ Operator Status (of ${op.total || data.totalSales} sales)</div>
      <div class="stats-grid">
        <div class="stat-card ${op.dmsPending > 0 ? 'orange' : 'green'}">
          <div class="stat-icon">${op.dmsPending > 0 ? '⏳' : '✅'}</div>
          <div class="stat-label">DMS Pending</div>
          <div class="stat-value">${op.dmsPending != null ? op.dmsPending : '—'}</div>
        </div>
        <div class="stat-card ${op.vahanPending > 0 ? 'orange' : 'green'}">
          <div class="stat-icon">${op.vahanPending > 0 ? '⏳' : '✅'}</div>
          <div class="stat-label">Vahan Pending</div>
          <div class="stat-value">${op.vahanPending != null ? op.vahanPending : '—'}</div>
        </div>
        <div class="stat-card ${op.insurancePending > 0 ? 'orange' : 'green'}">
          <div class="stat-icon">${op.insurancePending > 0 ? '⏳' : '✅'}</div>
          <div class="stat-label">Insurance Pending</div>
          <div class="stat-value">${op.insurancePending != null ? op.insurancePending : '—'}</div>
        </div>
      </div>
    </div>

    <!-- Accessories Breakdown -->
    <div class="section">
      <div class="section-header">🔩 Accessories Breakdown (tap for model details)</div>
      <div class="accessories-grid">
        <div class="accessory-item" onclick="showAccessoryBreakdown('guard', 'Guard')">
          <div class="accessory-name">Guard</div>
          <div class="accessory-count">${acc.guard || 0}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('grip', 'Grip Cover')">
          <div class="accessory-name">Grip Cover</div>
          <div class="accessory-count">${acc.grip || 0}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('helmet', 'Helmet')">
          <div class="accessory-name">Helmet</div>
          <div class="accessory-count">${acc.helmet || 0}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('seatCover', 'Seat Cover')">
          <div class="accessory-name">Seat Cover</div>
          <div class="accessory-count">${acc.seatCover || 0}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('matin', 'Matin')">
          <div class="accessory-name">Matin</div>
          <div class="accessory-count">${acc.matin || 0}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('tankCover', 'Tank Cover')">
          <div class="accessory-name">Tank Cover</div>
          <div class="accessory-count">${acc.tankCover || 0}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('handleHook', 'Handle Hook')">
          <div class="accessory-name">Handle Hook</div>
          <div class="accessory-count">${acc.handleHook || 0}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('raincover', 'Rain Cover')">
          <div class="accessory-name">Rain Cover</div>
          <div class="accessory-count">${acc.rainCover || 0}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('buzzer', 'Buzzer')">
          <div class="accessory-name">Buzzer</div>
          <div class="accessory-count">${acc.buzzer || 0}</div>
        </div>
        <div class="accessory-item" onclick="showAccessoryBreakdown('backrest', 'Back Rest')">
          <div class="accessory-name">Back Rest</div>
          <div class="accessory-count">${acc.backRest || 0}</div>
        </div>
      </div>
    </div>

    <!-- CRM Overview -->
    <div class="section">
      <div class="section-header">👥 CRM Overview</div>
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon">📦</div>
          <div class="stat-label">New Leads</div>
          <div class="stat-value">${data.crmNewLeads}</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon">🔥</div>
          <div class="stat-label">Hot Leads</div>
          <div class="stat-value">${data.crmHotLeads}</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">✅</div>
          <div class="stat-label">Conversion Rate</div>
          <div class="stat-value">${data.crmConversionRate}%</div>
        </div>
      </div>
    </div>

    <!-- Stock In / Purchase Analysis (Admin Only) -->
    <div class="section" id="stockInSection">
      <div class="section-header">📥 Stock In Analysis</div>
      <div id="stockInContent"><div style="text-align:center;padding:20px;color:#999;">⏳ Loading...</div></div>
    </div>

    <!-- Full Accessories by Executive -->
    <div class="section" id="adminFullAccSection">
      <div class="section-header">🎯 Full Accessories by Executive</div>
      <div id="adminFullAccContent"><div style="text-align:center;padding:20px;color:#999;">⏳ Loading...</div></div>
    </div>

    <!-- Discount Analysis (Admin Only – Password Protected) -->
    <div class="section" id="discountSection">
      <div class="section-header">💸 Discount Analysis
        <span style="font-size:11px;background:#6c757d;color:white;padding:2px 7px;border-radius:10px;margin-left:8px;">Admin Only</span>
      </div>
      <div id="discountLockView">
        <div style="text-align:center;padding:25px 15px;">
          <div style="font-size:44px;margin-bottom:10px;">🔒</div>
          <div style="color:#666;margin-bottom:18px;font-size:14px;">This section is password protected</div>
          <input type="password" id="discountPwd" placeholder="Enter password"
            style="border:2px solid #ddd;border-radius:8px;padding:10px 15px;font-size:14px;width:200px;text-align:center;display:block;margin:0 auto 12px;outline:none;"
            onkeydown="if(event.key==='Enter') unlockDiscount()">
          <button onclick="unlockDiscount()"
            style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:600;cursor:pointer;">
            🔓 Unlock
          </button>
          <div id="discountPwdError" style="color:#dc3545;font-size:13px;margin-top:10px;display:none;">❌ Incorrect password</div>
        </div>
      </div>
      <div id="discountAnalysisContent" style="display:none;"></div>
    </div>

    <!-- Financier Commission Analysis (Admin Only) -->
    <div class="section" id="adminFinCommSection">
      <div class="section-header">💰 Financier Commission Analysis</div>
      <div id="adminFinCommContent"><div style="text-align:center;padding:20px;color:#999;">⏳ Loading...</div></div>
    </div>

    <!-- Inventory Analysis (Admin Only – same password unlock, no title) -->
    <div class="section" id="inventorySection">
      <div class="section-header">📦 Inventory Analysis
        <span style="font-size:11px;background:#6c757d;color:white;padding:2px 7px;border-radius:10px;margin-left:8px;">Admin Only</span>
      </div>
      <div id="inventoryLockView">
        <div style="text-align:center;padding:25px 15px;">
          <div style="font-size:44px;margin-bottom:10px;">🔒</div>
          <input type="password" id="inventoryPwd" placeholder="Enter password"
            style="border:2px solid #ddd;border-radius:8px;padding:10px 15px;font-size:14px;width:200px;text-align:center;display:block;margin:0 auto 12px;outline:none;"
            onkeydown="if(event.key==='Enter') unlockInventory()">
          <button onclick="unlockInventory()"
            style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:600;cursor:pointer;">
            🔓 Unlock
          </button>
          <div id="inventoryPwdError" style="color:#dc3545;font-size:13px;margin-top:10px;display:none;">❌ Incorrect password</div>
        </div>
      </div>
      <div id="inventoryAnalysisContent" style="display:none;"></div>
    </div>
  `;

  content.style.display = 'block';

  // Load Stock In analysis immediately (no password needed)
  loadStockInAnalysis();
  loadFullAccessoriesAnalysis('adminFullAccContent');
  loadFinancierCommissionAnalysis();

  // Auto-unlock if already authenticated in this session
  if (discountUnlocked) {
    document.getElementById('discountLockView').style.display = 'none';
    document.getElementById('discountAnalysisContent').style.display = 'block';
    loadDiscountAnalysis();

    document.getElementById('inventoryLockView').style.display = 'none';
    document.getElementById('inventoryAnalysisContent').style.display = 'block';
    loadInventoryAnalysis();
  }
}

/**
 * Unlock Discount Analysis (password check is client-side intentionally)
 */
function unlockDiscount() {
  const pwd = document.getElementById('discountPwd').value;
  if (pwd === 'advait55&') {
    discountUnlocked = true;
    document.getElementById('discountLockView').style.display = 'none';
    document.getElementById('discountAnalysisContent').style.display = 'block';
    loadDiscountAnalysis();
    // Also unlock inventory section (same password, same session flag)
    document.getElementById('inventoryLockView').style.display = 'none';
    document.getElementById('inventoryAnalysisContent').style.display = 'block';
    loadInventoryAnalysis();
  } else {
    const errEl = document.getElementById('discountPwdError');
    errEl.style.display = 'block';
    document.getElementById('discountPwd').value = '';
    setTimeout(function() { errEl.style.display = 'none'; }, 2500);
  }
}

/**
 * Unlock Inventory Analysis (same password & flag as discount)
 */
function unlockInventory() {
  const pwd = document.getElementById('inventoryPwd').value;
  if (pwd === 'advait55&') {
    discountUnlocked = true;
    document.getElementById('inventoryLockView').style.display = 'none';
    document.getElementById('inventoryAnalysisContent').style.display = 'block';
    loadInventoryAnalysis();
    // Also unlock discount section if still locked
    var discLock = document.getElementById('discountLockView');
    if (discLock && discLock.style.display !== 'none') {
      discLock.style.display = 'none';
      document.getElementById('discountAnalysisContent').style.display = 'block';
      loadDiscountAnalysis();
    }
  } else {
    const errEl = document.getElementById('inventoryPwdError');
    errEl.style.display = 'block';
    document.getElementById('inventoryPwd').value = '';
    setTimeout(function() { errEl.style.display = 'none'; }, 2500);
  }
}

/**
 * Fetch discount analysis data and render
 */
async function loadDiscountAnalysis() {
  const container = document.getElementById('discountAnalysisContent');
  container.innerHTML = '<div style="text-align:center;padding:25px;color:#999;">⏳ Loading discount data...</div>';
  try {
    const response = await API.call('getDiscountAnalysis', { sessionId: currentSessionId, dateFilter: currentFilter });
    if (response.success) {
      renderDiscountAnalysis(response.data);
    } else {
      container.innerHTML = '<div style="color:#dc3545;padding:15px;text-align:center;">⚠️ ' + (response.message || 'Failed to load') + '</div>';
    }
  } catch(e) {
    console.error('Discount analysis error:', e);
    container.innerHTML = '<div style="color:#dc3545;padding:15px;text-align:center;">Error loading discount data</div>';
  }
}

/**
 * Fetch and render Stock In (Purchase) Analysis
 */
async function loadStockInAnalysis() {
  const container = document.getElementById('stockInContent');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">⏳ Loading...</div>';
  try {
    const response = await API.call('getStockInAnalysis', { sessionId: currentSessionId, dateFilter: currentFilter });
    if (response.success) {
      renderStockInAnalysis(response.data);
    } else {
      container.innerHTML = '<div style="color:#dc3545;padding:15px;text-align:center;">⚠️ ' + (response.message || 'Failed to load') + '</div>';
    }
  } catch(e) {
    container.innerHTML = '<div style="color:#dc3545;padding:15px;text-align:center;">Error loading stock data</div>';
  }
}

/**
 * Render Stock In analysis
 */
function renderStockInAnalysis(d) {
  var container = document.getElementById('stockInContent');
  if (!container) return;

  if (!d.items || d.items.length === 0) {
    container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;font-size:13px;">No stock received in this period</div>';
    return;
  }

  var maxQty = Math.max.apply(null, d.items.map(function(x) { return x.qty; })) || 1;

  var rows = d.items.map(function(item) {
    var bp = Math.round((item.qty / maxQty) * 100);
    return '<div style="margin-bottom:10px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">' +
        '<span style="font-weight:600;">' + item.skuName + '</span>' +
        '<span style="background:#e8f5e9;color:#2e7d32;font-weight:700;padding:2px 8px;border-radius:10px;font-size:12px;">' + item.qty + ' units</span>' +
      '</div>' +
      '<div style="background:#f0f0f0;border-radius:6px;height:8px;overflow:hidden;">' +
        '<div style="width:' + bp + '%;height:100%;background:linear-gradient(90deg,#43a047,#2e7d32);border-radius:6px;"></div>' +
      '</div></div>';
  }).join('');

  container.innerHTML =
    '<div style="display:flex;gap:12px;margin-bottom:16px;">' +
      '<div style="flex:1;background:#e8f5e9;border-radius:8px;padding:10px 12px;text-align:center;">' +
        '<div style="font-size:11px;color:#555;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Total Units</div>' +
        '<div style="font-size:22px;font-weight:700;color:#2e7d32;">' + d.totalUnits + '</div>' +
      '</div>' +
      '<div style="flex:1;background:#e3f2fd;border-radius:8px;padding:10px 12px;text-align:center;">' +
        '<div style="font-size:11px;color:#555;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Transactions</div>' +
        '<div style="font-size:22px;font-weight:700;color:#1565c0;">' + d.totalTxns + '</div>' +
      '</div>' +
    '</div>' +
    rows;
}

/**
 * Fetch inventory analysis data and render
 */
async function loadInventoryAnalysis() {
  const container = document.getElementById('inventoryAnalysisContent');
  container.innerHTML = '<div style="text-align:center;padding:25px;color:#999;">⏳ Loading inventory data...</div>';
  try {
    const response = await API.call('getInventoryAnalysis', { sessionId: currentSessionId, dateFilter: currentFilter });
    if (response.success) {
      renderInventoryAnalysis(response.data);
    } else {
      container.innerHTML = '<div style="color:#dc3545;padding:15px;text-align:center;">⚠️ ' + (response.message || 'Failed to load') + '</div>';
    }
  } catch(e) {
    console.error('Inventory analysis error:', e);
    container.innerHTML = '<div style="color:#dc3545;padding:15px;text-align:center;">Error loading inventory data</div>';
  }
}

/**
 * Render inventory analysis: ISSUE, OTC Sale, AD Sale
 */
function renderInventoryAnalysis(d) {
  var container = document.getElementById('inventoryAnalysisContent');

  // --- ISSUE section ---
  var issueRows = '';
  if (d.issue && d.issue.length > 0) {
    var maxIssue = Math.max.apply(null, d.issue.map(function(x) { return x.qty; })) || 1;
    issueRows = d.issue.map(function(item) {
      var bp = Math.round((item.qty / maxIssue) * 100);
      return '<div style="margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">' +
          '<span style="font-weight:600;">' + item.skuName + '</span>' +
          '<span style="background:#e8f4fd;color:#1a73e8;font-weight:700;padding:2px 8px;border-radius:10px;font-size:12px;">' + item.qty + ' units</span>' +
        '</div>' +
        '<div style="background:#f0f0f0;border-radius:6px;height:8px;overflow:hidden;">' +
          '<div style="width:' + bp + '%;height:100%;background:linear-gradient(90deg,#4CAF50,#45a049);border-radius:6px;"></div>' +
        '</div></div>';
    }).join('');
  } else {
    issueRows = '<div style="color:#999;text-align:center;padding:15px;font-size:13px;">No ISSUE transactions in this period</div>';
  }

  // --- OTC Sale section ---
  var otcRows = '';
  if (d.otc && d.otc.length > 0) {
    var maxOtc = Math.max.apply(null, d.otc.map(function(x) { return x.qty; })) || 1;
    otcRows = d.otc.map(function(item) {
      var bp = Math.round((item.qty / maxOtc) * 100);
      return '<div style="margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">' +
          '<span style="font-weight:600;">' + item.skuName + '</span>' +
          '<span style="background:#fff3e0;color:#e65100;font-weight:700;padding:2px 8px;border-radius:10px;font-size:12px;">' + item.qty + ' units</span>' +
        '</div>' +
        '<div style="background:#f0f0f0;border-radius:6px;height:8px;overflow:hidden;">' +
          '<div style="width:' + bp + '%;height:100%;background:linear-gradient(90deg,#FF9800,#f57c00);border-radius:6px;"></div>' +
        '</div></div>';
    }).join('');
  } else {
    otcRows = '<div style="color:#999;text-align:center;padding:15px;font-size:13px;">No OTC Sales in this period</div>';
  }

  // --- AD Sale section ---
  var adRows = '';
  if (d.adSale && d.adSale.length > 0) {
    adRows = d.adSale.map(function(ad) {
      var itemsHtml = ad.items.map(function(item) {
        return '<div style="display:flex;justify-content:space-between;padding:6px 0 6px 12px;border-bottom:1px solid #f5f5f5;font-size:13px;">' +
          '<span style="color:#555;">' + item.skuName + '</span>' +
          '<span style="font-weight:600;color:#667eea;">' + item.qty + ' units</span>' +
        '</div>';
      }).join('');
      var totalQty = ad.items.reduce(function(s, x) { return s + x.qty; }, 0);
      return '<div style="border:1px solid #e9ecef;border-radius:8px;margin-bottom:12px;overflow:hidden;">' +
        '<div style="background:#f8f9fa;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-weight:700;color:#333;font-size:14px;">🏪 ' + ad.adName + '</span>' +
          '<span style="font-size:12px;color:#666;">' + totalQty + ' total units</span>' +
        '</div>' +
        itemsHtml +
      '</div>';
    }).join('');
  } else {
    adRows = '<div style="color:#999;text-align:center;padding:15px;font-size:13px;">No AD Sales in this period</div>';
  }

  // --- Executive OTC section ---
  var execOtcRows = '';
  if (d.otcByExecutive && d.otcByExecutive.length > 0) {
    execOtcRows = d.otcByExecutive.map(function(exec) {
      var itemsHtml = exec.items.map(function(item) {
        return '<div style="display:flex;justify-content:space-between;padding:6px 0 6px 12px;border-bottom:1px solid #f5f5f5;font-size:13px;">' +
          '<span style="color:#555;">' + item.skuName + '</span>' +
          '<span style="font-weight:600;color:#e65100;">' + item.qty + ' units</span>' +
        '</div>';
      }).join('');
      return '<div style="border:1px solid #e9ecef;border-radius:8px;margin-bottom:12px;overflow:hidden;">' +
        '<div style="background:#fff3e0;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-weight:700;color:#333;font-size:14px;">👤 ' + exec.executive + '</span>' +
          '<span style="font-size:12px;color:#666;">' + exec.total + ' total units</span>' +
        '</div>' +
        itemsHtml +
      '</div>';
    }).join('');
  } else {
    execOtcRows = '<div style="color:#999;text-align:center;padding:15px;font-size:13px;">No executive OTC data in this period</div>';
  }

  container.innerHTML = `
    <!-- ISSUE Section -->
    <div style="font-weight:700;color:#333;margin:10px 0 12px;font-size:14px;">📤 Stock Issued (ISSUE)</div>
    <div style="margin-bottom:20px;">${issueRows}</div>

    <hr style="border:none;border-top:2px solid #f0f0f0;margin:18px 0;">

    <!-- OTC Sale Section -->
    <div style="font-weight:700;color:#333;margin:0 0 12px;font-size:14px;">🛒 OTC Sales</div>
    <div style="margin-bottom:20px;">${otcRows}</div>

    <hr style="border:none;border-top:2px solid #f0f0f0;margin:18px 0;">

    <!-- Executive OTC Section -->
    <div style="font-weight:700;color:#333;margin:0 0 12px;font-size:14px;">🧑‍💼 OTC Sales by Executive</div>
    <div style="margin-bottom:20px;">${execOtcRows}</div>

    <hr style="border:none;border-top:2px solid #f0f0f0;margin:18px 0;">

    <!-- AD Sale Section -->
    <div style="font-weight:700;color:#333;margin:0 0 12px;font-size:14px;">🤝 AD Sales</div>
    <div>${adRows}</div>
  `;
}

/**
 * Toggle Apache filter on discount by executive table
 */
function toggleApacheFilter() {
  discountExcludeApache = !discountExcludeApache;
  if (lastDiscountData) renderDiscountAnalysis(lastDiscountData);
}

/**
 * Render all discount analysis sections
 */
function renderDiscountAnalysis(d) {
  lastDiscountData = d; // cache for toggle re-render
  const fmt  = function(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };
  const pct  = function(n) { return (Math.round(n * 10) / 10).toFixed(1) + '%'; };

  // Monthly trend max (for progress bars)
  const maxMonthDisc = d.monthly && d.monthly.length
    ? Math.max.apply(null, d.monthly.map(function(x) { return x.totalDiscount; })) || 1
    : 1;

  const monthlyHTML = (d.monthly && d.monthly.length > 1) ? `
    <div style="font-weight:700;color:#333;margin:20px 0 10px;font-size:14px;">📅 Monthly Discount Trend</div>
    ${d.monthly.map(function(m) {
      var bp = Math.round((m.totalDiscount / maxMonthDisc) * 100);
      return '<div style="margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">' +
          '<span style="font-weight:600;">' + m.month + '</span>' +
          '<span style="color:#dc3545;font-weight:600;">' + fmt(m.totalDiscount) + ' (' + m.count + ' deals)</span>' +
        '</div>' +
        '<div style="background:#f0f0f0;border-radius:6px;height:10px;overflow:hidden;">' +
          '<div style="width:' + bp + '%;height:100%;background:linear-gradient(90deg,#667eea,#764ba2);border-radius:6px;"></div>' +
        '</div></div>';
    }).join('')}
  ` : '';

  const bucketsHTML = [
    { label: 'No Discount (₹0)',   count: d.buckets.zero,   color: '#4CAF50' },
    { label: '₹1 – ₹1,000',        count: d.buckets.small,  color: '#2196F3' },
    { label: '₹1,001 – ₹1,500',    count: d.buckets.medium, color: '#FF9800' },
    { label: 'Above ₹1,500',       count: d.buckets.large,  color: '#F44336' }
  ].map(function(b) {
    var bp = d.totalDeals > 0 ? Math.round((b.count / d.totalDeals) * 100) : 0;
    return '<div style="margin-bottom:10px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">' +
        '<span>' + b.label + '</span>' +
        '<span style="font-weight:600;">' + b.count + ' deals (' + bp + '%)</span>' +
      '</div>' +
      '<div style="background:#f0f0f0;border-radius:6px;height:10px;overflow:hidden;">' +
        '<div style="width:' + bp + '%;height:100%;background:' + b.color + ';border-radius:6px;"></div>' +
      '</div></div>';
  }).join('');

  const modelRows = d.byModel.map(function(m) {
    return '<tr style="border-bottom:1px solid #f0f0f0;">' +
      '<td style="padding:8px;font-weight:600;">' + m.model + '</td>' +
      '<td style="padding:8px;text-align:right;">' + m.count + '</td>' +
      '<td style="padding:8px;text-align:right;color:#dc3545;font-weight:600;">' + fmt(m.totalDiscount) + '</td>' +
      '<td style="padding:8px;text-align:right;">' + fmt(m.avgDiscount) + '</td>' +
      '<td style="padding:8px;text-align:right;">' + fmt(m.maxDiscount) + '</td>' +
      '<td style="padding:8px;text-align:right;color:#856404;">' + pct(m.discountPct) + '</td>' +
      '</tr>';
  }).join('');

  const activeExecData = discountExcludeApache ? (d.byExecutiveNoApache || d.byExecutive) : d.byExecutive;
  const execRows = activeExecData.map(function(e) {
    return '<tr style="border-bottom:1px solid #f0f0f0;">' +
      '<td style="padding:8px;font-weight:600;">' + e.executive + '</td>' +
      '<td style="padding:8px;text-align:right;">' + e.deals + '</td>' +
      '<td style="padding:8px;text-align:right;color:#dc3545;font-weight:600;">' + fmt(e.totalDiscount) + '</td>' +
      '<td style="padding:8px;text-align:right;">' + fmt(e.avgDiscount) + '</td>' +
      '<td style="padding:8px;text-align:right;">' + fmt(e.maxDiscount) + '</td>' +
      '</tr>';
  }).join('');

  const top10Rows = d.top10.map(function(deal, i) {
    return '<tr style="border-bottom:1px solid #f0f0f0;">' +
      '<td style="padding:7px;color:#999;">' + (i + 1) + '</td>' +
      '<td style="padding:7px;white-space:nowrap;">' + deal.date + '</td>' +
      '<td style="padding:7px;font-weight:600;">' + deal.customer + '</td>' +
      '<td style="padding:7px;">' + deal.model + '</td>' +
      '<td style="padding:7px;">' + deal.executive + '</td>' +
      '<td style="padding:7px;text-align:right;color:#dc3545;font-weight:700;">' + fmt(deal.discount) + '</td>' +
      '<td style="padding:7px;text-align:right;">' + fmt(deal.finalPrice) + '</td>' +
      '</tr>';
  }).join('');

  const container = document.getElementById('discountAnalysisContent');
  container.innerHTML = `
    <!-- Summary Cards -->
    <div class="stats-grid" style="padding:0 0 5px;">
      <div class="stat-card purple" style="padding:15px 10px;">
        <div class="stat-icon" style="font-size:24px;">💸</div>
        <div class="stat-label">Total Discount</div>
        <div class="stat-value" style="font-size:16px;">${fmt(d.totalDiscount)}</div>
      </div>
      <div class="stat-card orange" style="padding:15px 10px;">
        <div class="stat-icon" style="font-size:24px;">📊</div>
        <div class="stat-label">Avg / Deal</div>
        <div class="stat-value" style="font-size:16px;">${fmt(d.avgDiscountPerDeal)}</div>
      </div>
      <div class="stat-card red" style="padding:15px 10px;">
        <div class="stat-icon" style="font-size:24px;">⬆️</div>
        <div class="stat-label">Max Discount</div>
        <div class="stat-value" style="font-size:16px;">${fmt(d.maxDiscount)}</div>
      </div>
      <div class="stat-card blue" style="padding:15px 10px;">
        <div class="stat-icon" style="font-size:24px;">🧾</div>
        <div class="stat-label">w/ Discount</div>
        <div class="stat-value" style="font-size:16px;">${d.dealsWithDiscount}/${d.totalDeals}</div>
      </div>
      <div class="stat-card green" style="padding:15px 10px;">
        <div class="stat-icon" style="font-size:24px;">💰</div>
        <div class="stat-label">Gross Revenue</div>
        <div class="stat-value" style="font-size:14px;">${fmt(d.totalGrossRevenue)}</div>
      </div>
      <div class="stat-card green" style="padding:15px 10px;">
        <div class="stat-icon" style="font-size:24px;">🏦</div>
        <div class="stat-label">Net Revenue</div>
        <div class="stat-value" style="font-size:14px;">${fmt(d.totalNetRevenue)}</div>
      </div>
    </div>

    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:10px 14px;margin:10px 0 15px;font-size:13px;color:#856404;">
      📉 Discount is <strong>${pct(d.discountPct)}</strong> of gross revenue &nbsp;|&nbsp;
      Avg per discounted deal: <strong>${fmt(d.avgDiscountPerDiscountedDeal)}</strong>
    </div>

    <!-- By Model -->
    <div style="font-weight:700;color:#333;margin:18px 0 10px;font-size:14px;">🏍️ Discount by Model</div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6;">Model</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Deals</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Total</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Avg</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Max</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Disc%</th>
        </tr></thead>
        <tbody>${modelRows}</tbody>
      </table>
    </div>

    <!-- By Executive -->
    <div style="display:flex;align-items:center;gap:10px;margin:20px 0 10px;flex-wrap:wrap;">
      <span style="font-weight:700;color:#333;font-size:14px;">👥 Discount by Executive</span>
      <label onclick="toggleApacheFilter()" style="display:flex;align-items:center;gap:6px;cursor:pointer;background:#f8f9fa;padding:4px 10px;border-radius:20px;border:1px solid #ddd;user-select:none;">
        <span style="font-size:12px;color:#666;">Excl. Apache</span>
        <div style="width:36px;height:20px;background:${discountExcludeApache ? '#667eea' : '#ccc'};border-radius:10px;position:relative;transition:background 0.2s;flex-shrink:0;">
          <div style="position:absolute;top:2px;left:${discountExcludeApache ? '16' : '2'}px;width:16px;height:16px;background:white;border-radius:50%;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>
        </div>
      </label>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6;">Executive</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Deals</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Total</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Avg</th>
          <th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">Max</th>
        </tr></thead>
        <tbody>${execRows}</tbody>
      </table>
    </div>

    <!-- Distribution -->
    <div style="font-weight:700;color:#333;margin:20px 0 10px;font-size:14px;">📊 Discount Distribution</div>
    ${bucketsHTML}

    <!-- Monthly Trend -->
    ${monthlyHTML}

    <!-- Top 10 Deals -->
    ${d.top10 && d.top10.length > 0 ? `
    <div style="font-weight:700;color:#333;margin:20px 0 10px;font-size:14px;">🏆 Top ${d.top10.length} Highest Discount Deals</div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="padding:7px;text-align:left;border-bottom:2px solid #dee2e6;">#</th>
          <th style="padding:7px;text-align:left;border-bottom:2px solid #dee2e6;">Date</th>
          <th style="padding:7px;text-align:left;border-bottom:2px solid #dee2e6;">Customer</th>
          <th style="padding:7px;text-align:left;border-bottom:2px solid #dee2e6;">Model</th>
          <th style="padding:7px;text-align:left;border-bottom:2px solid #dee2e6;">Executive</th>
          <th style="padding:7px;text-align:right;border-bottom:2px solid #dee2e6;">Discount</th>
          <th style="padding:7px;text-align:right;border-bottom:2px solid #dee2e6;">Final Price</th>
        </tr></thead>
        <tbody>${top10Rows}</tbody>
      </table>
    </div>
    ` : ''}
  `;
}

/**
 * Show accessory breakdown by model
 * Uses admin API for admin role, sales API for sales role
 */
async function showAccessoryBreakdown(type, name) {
  try {
    let response;
    if (currentUser && currentUser.role === 'admin') {
      response = await API.getAdminAccessoryBreakdown(type, currentFilter);
    } else {
      response = await API.getMyAccessoryBreakdown(type, currentFilter);
    }

    if (response.success && response.breakdown && response.breakdown.length > 0) {
      document.getElementById('modalTitle').textContent = name + ' - Model Breakdown';

      const modalContent = document.getElementById('modalContent');
      modalContent.innerHTML = response.breakdown.map(item => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${item.model}</div>
          </div>
          <div class="list-item-value">${item.count}</div>
        </div>
      `).join('');

      document.getElementById('accessoryModal').classList.add('active');
    } else {
      showMessage('No data available', 'error');
    }
  } catch (error) {
    console.error('Breakdown error:', error);
    showMessage('Error loading breakdown', 'error');
  }
}

/**
 * Show pending details (DMS, Insurance, RTO, Accessories)
 */
async function showPendingDetails(type, name) {
  try {
    const response = await API.getMyPendingDetails(type, currentFilter);
    
    if (response.success && response.pending && response.pending.length > 0) {
      document.getElementById('modalTitle').textContent = name + ' Pending';
      
      const modalContent = document.getElementById('modalContent');
      modalContent.innerHTML = response.pending.map(item => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${item.customerName}</div>
            <div class="list-item-subtitle">${item.model} • Receipt: ${item.receiptNo}</div>
          </div>
        </div>
      `).join('');
      
      document.getElementById('accessoryModal').classList.add('active');
    } else {
      showMessage('No pending items', 'error');
    }
  } catch (error) {
    console.error('Pending details error:', error);
    showMessage('Error loading pending details', 'error');
  }
}

/**
 * Toggle inline executive sales detail below the clicked row
 */
async function toggleExecutiveDetail(executive, detailId, rowEl) {
  const detail = document.getElementById(detailId);
  if (!detail) return;

  const chevron = rowEl.querySelector('.execChevron');

  // Toggle if already loaded
  if (detail.dataset.loaded === 'true') {
    const isOpen = detail.style.display !== 'none';
    detail.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
    return;
  }

  // Show loading
  detail.style.display = 'block';
  detail.innerHTML = '<div style="padding:10px 16px;text-align:center;color:#999;font-size:12px;">⏳ Loading...</div>';
  if (chevron) chevron.style.transform = 'rotate(180deg)';

  try {
    const response = await API.call('getExecutiveSalesDetail', {
      sessionId: currentSessionId,
      executiveName: executive,
      dateFilter: currentFilter
    });
    if (response.success && response.data && response.data.customers && response.data.customers.length > 0) {
      const customers = response.data.customers;
      var tableHtml = '<div style="background:#f9fafe;padding:8px 16px 14px;">';
      tableHtml += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
      tableHtml += '<thead><tr style="background:#eef1fb;">';
      tableHtml += '<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Del. Date</th>';
      tableHtml += '<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Customer</th>';
      tableHtml += '<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">Model</th>';
      tableHtml += '<th style="padding:6px 8px;text-align:center;border:1px solid #ddd;">Full Acc</th>';
      tableHtml += '</tr></thead><tbody>';
      customers.forEach(function(c) {
        var fa = c.fullAcc === 'Y';
        tableHtml += '<tr><td style="padding:5px 8px;border:1px solid #ddd;white-space:nowrap;">' + (c.date || '—') + '</td>';
        tableHtml += '<td style="padding:5px 8px;border:1px solid #ddd;font-weight:600;">' + (c.customerName || '') + '</td>';
        tableHtml += '<td style="padding:5px 8px;border:1px solid #ddd;">' + (c.model || '') + '</td>';
        tableHtml += '<td style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-weight:700;color:' + (fa ? '#28a745' : '#dc3545') + ';">' + (c.fullAcc || 'N') + '</td></tr>';
      });
      tableHtml += '</tbody></table></div>';
      detail.innerHTML = tableHtml;
    } else {
      detail.innerHTML = '<div style="padding:10px 16px;text-align:center;color:#999;font-size:12px;">No records found</div>';
    }
    detail.dataset.loaded = 'true';
  } catch(e) {
    detail.innerHTML = '<div style="padding:10px 16px;color:#dc3545;font-size:12px;">Error loading</div>';
    detail.dataset.loaded = 'true';
  }
}

/**
 * Load executive's own delivered sales detail (for executive role dashboard)
 */
async function loadMyExecDetail() {
  const container = document.getElementById('myExecDetailContent');
  if (!container) return;
  try {
    const response = await API.call('getExecutiveSalesDetail', {
      sessionId: currentSessionId,
      executiveName: currentUser.name,
      dateFilter: currentFilter
    });
    if (response.success && response.data && response.data.customers && response.data.customers.length > 0) {
      const customers = response.data.customers;
      var tableHtml = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">';
      tableHtml += '<thead><tr style="background:#eef1fb;">';
      tableHtml += '<th style="padding:7px 10px;text-align:left;border:1px solid #ddd;">Del. Date</th>';
      tableHtml += '<th style="padding:7px 10px;text-align:left;border:1px solid #ddd;">Customer</th>';
      tableHtml += '<th style="padding:7px 10px;text-align:left;border:1px solid #ddd;">Model</th>';
      tableHtml += '<th style="padding:7px 10px;text-align:center;border:1px solid #ddd;">Full Acc</th>';
      tableHtml += '</tr></thead><tbody>';
      customers.forEach(function(c) {
        var fa = c.fullAcc === 'Y';
        tableHtml += '<tr><td style="padding:6px 10px;border:1px solid #ddd;white-space:nowrap;">' + (c.date || '—') + '</td>';
        tableHtml += '<td style="padding:6px 10px;border:1px solid #ddd;font-weight:600;">' + (c.customerName || '') + '</td>';
        tableHtml += '<td style="padding:6px 10px;border:1px solid #ddd;">' + (c.model || '') + '</td>';
        tableHtml += '<td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:700;color:' + (fa ? '#28a745' : '#dc3545') + ';">' + (c.fullAcc || 'N') + '</td></tr>';
      });
      tableHtml += '</tbody></table></div>';
      container.innerHTML = tableHtml;
    } else if (response.success) {
      container.innerHTML = '<div class="empty-state">No delivered sales (Account Check: Yes) in this period</div>';
    } else {
      container.innerHTML = '<div style="color:#dc3545;padding:15px;text-align:center;">⚠️ ' + (response.message || 'Failed to load') + '</div>';
    }
  } catch(e) {
    container.innerHTML = '<div style="color:#dc3545;padding:15px;">Error loading data</div>';
  }
}

/**
 * Close modal
 */
function closeModal() {
  document.getElementById('accessoryModal').classList.remove('active');
}

/**
 * Set the month filter button label based on the filter value
 */
function setMonthBtnLabel(filter) {
  var btn = document.getElementById('monthFilterBtn');
  if (!btn) return;
  if (filter === 'month') {
    var now = new Date();
    btn.textContent = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  } else if (filter && filter.indexOf('month:') === 0) {
    var parts = filter.substring(6).split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    btn.textContent = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
}

/**
 * Open a floating month/year picker when the month filter button is clicked
 */
function openMonthPicker(event) {
  event.stopPropagation();

  // Remove any existing picker
  var existing = document.getElementById('monthPickerPopover');
  if (existing) { existing.remove(); return; }

  // Determine current selected month value for the input default
  var inputVal = '';
  if (currentFilter === 'month') {
    var now = new Date();
    inputVal = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  } else if (currentFilter && currentFilter.indexOf('month:') === 0) {
    inputVal = currentFilter.substring(6); // e.g. '2026-03'
  }

  var popover = document.createElement('div');
  popover.id = 'monthPickerPopover';
  popover.style.cssText = 'position:absolute;background:white;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.18);padding:16px 18px;z-index:500;min-width:220px;';

  // Position below the button
  var btn = document.getElementById('monthFilterBtn');
  var rect = btn.getBoundingClientRect();
  popover.style.top  = (rect.bottom + window.scrollY + 8) + 'px';
  popover.style.left = (rect.left  + window.scrollX)      + 'px';

  popover.innerHTML =
    '<div style="font-size:13px;font-weight:700;color:#333;margin-bottom:10px;">Select Month</div>' +
    '<input type="month" id="monthPickerInput" value="' + inputVal + '" ' +
      'style="border:2px solid #667eea;border-radius:8px;padding:8px 12px;font-size:14px;width:100%;box-sizing:border-box;outline:none;">' +
    '<div style="display:flex;gap:8px;margin-top:12px;">' +
      '<button onclick="applyMonthFilter()" ' +
        'style="flex:1;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;">' +
        'Apply' +
      '</button>' +
      '<button onclick="applyMonthFilter(\'current\')" ' +
        'style="flex:1;background:#f0f0f0;color:#333;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;">' +
        'Current' +
      '</button>' +
    '</div>';

  document.body.appendChild(popover);

  // Close on outside click
  setTimeout(function() {
    document.addEventListener('click', function closePicker(e) {
      if (!popover.contains(e.target)) {
        popover.remove();
        document.removeEventListener('click', closePicker);
      }
    });
  }, 50);
}

/**
 * Apply selected month from picker
 */
function applyMonthFilter(preset) {
  var popover = document.getElementById('monthPickerPopover');
  if (preset === 'current') {
    currentFilter = 'month';
    setMonthBtnLabel('month');
  } else {
    var input = document.getElementById('monthPickerInput');
    if (!input || !input.value) return;
    // input.value is 'YYYY-MM'
    var now = new Date();
    var curVal = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    if (input.value === curVal) {
      currentFilter = 'month';
    } else {
      currentFilter = 'month:' + input.value;
    }
    setMonthBtnLabel(currentFilter);
  }
  if (popover) popover.remove();

  // Mark month button active
  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('monthFilterBtn').classList.add('active');

  loadDashboard();
}

/**
 * Change date filter
 */
function changeFilter(filter) {
  currentFilter = filter;

  // Update active button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-filter') === filter) {
      btn.classList.add('active');
    }
  });

  // Reset month button label if switching to non-month filter
  if (filter !== 'month' && !(filter && filter.indexOf('month:') === 0)) {
    setMonthBtnLabel('month'); // reset label to current month name
  }

  // Reload dashboard
  loadDashboard();
}

/**
 * Show/hide loading state
 */
function showLoading(show) {
  document.getElementById('loadingState').style.display = show ? 'block' : 'none';
  document.getElementById('dashboardContent').style.display = show ? 'none' : 'block';
}

/**
 * Show message
 */
function showMessage(text, type) {
  const msgDiv = document.getElementById('statusMessage');
  msgDiv.textContent = text;
  msgDiv.className = 'message ' + type;
  msgDiv.style.display = 'block';
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  if (type === 'success') {
    setTimeout(() => {
      msgDiv.style.display = 'none';
    }, 3000);
  }
}

/**
 * Go back to home
 */
function goBack() {
  window.location.href = 'home.html';
}
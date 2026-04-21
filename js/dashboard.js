// ==========================================
// DASHBOARD PAGE LOGIC
// ==========================================

let currentUser = null;
let currentSessionId = null;
let currentFilter = 'month'; // Default to 'This Month'
let dashboardData = null;
let discountUnlocked = false; // persists within session so filter changes don't re-lock

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
  var monthBtn = document.getElementById('monthFilterBtn');
  if (monthBtn) {
    var now = new Date();
    monthBtn.textContent = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

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

    <!-- Daily Sales Trend (current month) -->
    ${data.dailyTrend && data.dailyTrend.some(function(d){return d.count>0;}) ? `
    <div class="section">
      <div class="section-header">📅 Daily Bookings — This Month</div>
      <div style="margin-top:10px;">
        ${(function(){
          var today = new Date().getDate();
          var max = Math.max.apply(null, data.dailyTrend.map(function(d){return d.count;})) || 1;
          return data.dailyTrend.map(function(d){
            var pct = Math.round((d.count / max) * 100);
            var isToday = d.day === today;
            var hasSale = d.count > 0;
            return '<div style="display:flex;align-items:center;margin-bottom:5px;">' +
              '<div style="width:24px;font-size:11px;color:' + (isToday?'#667eea':'#aaa') + ';font-weight:' + (isToday?'700':'400') + ';text-align:right;margin-right:8px;">' + d.day + '</div>' +
              '<div style="flex:1;background:#f0f0f0;border-radius:4px;height:16px;overflow:hidden;">' +
                (hasSale ? '<div style="width:' + pct + '%;height:100%;background:' + (isToday?'linear-gradient(90deg,#667eea,#764ba2)':'#81C784') + ';border-radius:4px;"></div>' : '') +
              '</div>' +
              '<div style="width:18px;font-size:11px;font-weight:600;color:#333;text-align:right;margin-left:6px;">' + (hasSale ? d.count : '') + '</div>' +
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
  `;
  
  content.style.display = 'block';
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
        <div class="list-item" onclick="showExecutiveModels('${exec.executive}', 'models')">
          <div class="list-item-main">
            <div class="list-item-title">
              ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
              ${exec.executive}
            </div>
            <div class="list-item-subtitle">Click to see model breakdown</div>
          </div>
          <div class="list-item-value">${exec.completedSales}</div>
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
  `;
  
  content.style.display = 'block';
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
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">
              ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
              ${exec.executive}
            </div>
            <div class="list-item-subtitle">Total bookings: ${exec.totalSales}</div>
          </div>
          <div class="list-item-value">${exec.completedSales}</div>
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

  container.innerHTML = `
    <!-- ISSUE Section -->
    <div style="font-weight:700;color:#333;margin:10px 0 12px;font-size:14px;">📤 Stock Issued (ISSUE)</div>
    <div style="margin-bottom:20px;">${issueRows}</div>

    <hr style="border:none;border-top:2px solid #f0f0f0;margin:18px 0;">

    <!-- OTC Sale Section -->
    <div style="font-weight:700;color:#333;margin:0 0 12px;font-size:14px;">🛒 OTC Sales</div>
    <div style="margin-bottom:20px;">${otcRows}</div>

    <hr style="border:none;border-top:2px solid #f0f0f0;margin:18px 0;">

    <!-- AD Sale Section -->
    <div style="font-weight:700;color:#333;margin:0 0 12px;font-size:14px;">🤝 AD Sales</div>
    <div>${adRows}</div>
  `;
}

/**
 * Render all discount analysis sections
 */
function renderDiscountAnalysis(d) {
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
    { label: '₹1,001 – ₹5,000',    count: d.buckets.medium, color: '#FF9800' },
    { label: '₹5,001 – ₹10,000',   count: d.buckets.large,  color: '#F44336' },
    { label: 'Above ₹10,000',      count: d.buckets.xlarge, color: '#9C27B0' }
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

  const execRows = d.byExecutive.map(function(e) {
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
    <div style="font-weight:700;color:#333;margin:20px 0 10px;font-size:14px;">👥 Discount by Executive</div>
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
 * Show executive models or accessories breakdown (for accounts dashboard)
 */
async function showExecutiveModels(executive, type) {
  try {
    const response = await API.getExecutiveBreakdown(executive, type, currentFilter);
    
    if (response.success && response.breakdown && response.breakdown.length > 0) {
      if (type === 'models') {
        document.getElementById('modalTitle').textContent = executive + ' - Models Sold';
      } else {
        document.getElementById('modalTitle').textContent = executive + ' - Accessories';
      }
      
      const modalContent = document.getElementById('modalContent');
      modalContent.innerHTML = response.breakdown.map(item => `
        <div class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${type === 'models' ? item.model : item.accessory}</div>
          </div>
          <div class="list-item-value">${item.count}</div>
        </div>
      `).join('');
      
      document.getElementById('accessoryModal').classList.add('active');
    } else {
      showMessage('No data available', 'error');
    }
  } catch (error) {
    console.error('Executive breakdown error:', error);
    showMessage('Error loading breakdown', 'error');
  }
}

/**
 * Close modal
 */
function closeModal() {
  document.getElementById('accessoryModal').classList.remove('active');
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
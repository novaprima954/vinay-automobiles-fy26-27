// ==========================================
// HOME PAGE JAVASCRIPT
// Vinay Automobiles - Dashboard Cards
// ==========================================

const ROLE_CARDS = {
  admin: [
    { title: 'Dashboard', icon: '📊', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', link: 'dashboard.html', description: 'Overview & analytics' },
    { title: 'Add New Sale', icon: '➕', color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', link: 'sales.html', description: 'Create new sales entry' },
    { title: 'Edit Sales', icon: '✏️', color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', link: 'salesedit.html', description: 'Modify existing sales' },
    { title: 'Accounts', icon: '💰', color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', link: 'accounts.html', description: 'Financial records' },
    { title: 'Accessories', icon: '🔧', color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', link: 'accessories.html', description: 'Accessory management' },
    { title: 'CRM', icon: '👥', color: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', link: 'crm.html', description: 'Customer relationship' },
    { title: 'Operator', icon: '🚗', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', link: 'operator-update.html', description: 'Vehicle operations' },
    { title: 'Number Plate Update', icon: '🔢', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', link: 'number-plate-upload.html', description: 'Number Plate Upload' },
    { title: 'ALL Number Plate Update', icon: '🔢🔢', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', link: 'hsrp-update.html', description: 'V301 AD+Counter' },
    { title: 'View Records', icon: '📋', color: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', link: 'view.html', description: 'View all records' },
    { title: 'Vehicle Scanner', icon: '📷', color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', link: 'scanner.html', description: 'Scan vehicle stickers' },
    { title: 'Customer Form', icon: '📋', color: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)', link: 'customer-form.html', description: 'Generate customer forms' },
    { title: 'HPCL Tracker', icon: '⛽', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', link: 'vehicle-mileage.html', description: 'Track HPCL Fuel and Mileage' }
  ],
  sales: [
    { title: 'Dashboard', icon: '📊', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', link: 'dashboard.html', description: 'View your performance' },
    { title: 'Add New Sale', icon: '➕', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', link: 'sales.html', description: 'Create new sales entry' },
    { title: 'Edit Sales', icon: '✏️', color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', link: 'salesedit.html', description: 'Modify existing sales' },
    { title: 'Vehicle Scanner', icon: '📷', color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', link: 'scanner.html', description: 'Scan vehicle stickers' },
    { title: 'Customer Form', icon: '📋', color: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)', link: 'customer-form.html', description: 'Generate customer forms' },
    { title: 'CRM', icon: '👥', color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', link: 'crm.html', description: 'Manage customer leads' }
  ],
  accounts: [
    { title: 'Dashboard', icon: '📊', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', link: 'dashboard.html', description: 'Financial overview' },
    { title: 'Accounts', icon: '💰', color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', link: 'accounts.html', description: 'Manage accounts' },
    { title: 'View Records', icon: '📋', color: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', link: 'view.html', description: 'View all records' },
    { title: 'Customer Form', icon: '📋', color: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)', link: 'customer-form.html', description: 'Generate customer forms' },
    { title: 'HPCL Tracker', icon: '⛽', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', link: 'vehicle-mileage.html', description: 'Track HPCL Fuel and Mileage' }
  ],
  accessories: [
    { title: 'Accessories', icon: '🔧', color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', link: 'accessories.html', description: 'Manage accessories' },
    { title: 'View Records', icon: '📋', color: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', link: 'view.html', description: 'View all records' }
  ],
  operator: [
    { title: 'Operator', icon: '🚗', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', link: 'operator-update.html', description: 'Vehicle operations' },
    { title: 'Number Plate Update', icon: '🔢', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', link: 'number-plate-upload.html', description: 'Number Plate Upload' },
    { title: 'ALL Number Plate Update', icon: '🔢🔢', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', link: 'hsrp-update.html', description: 'V301 AD+Counter' },
    { title: 'View Records', icon: '📋', color: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', link: 'view.html', description: 'View all records' },
    { title: 'HPCL Tracker', icon: '⛽', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', link: 'vehicle-mileage.html', description: 'Track HPCL Fuel and Mileage' }
  ]
};

// ==========================================
// PAGE INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async function() {
  console.log('=== HOME PAGE LOADED ===');
  
  // Show loading
  showLoading();
  
  // Check authentication
  const session = SessionManager.getSession();
  
  if (!session) {
    console.log('❌ No session - redirecting to login');
    window.location.href = 'index.html';
    return;
  }
  
  const user = session.user;
  console.log('✅ User authenticated:', user.name, '/', user.role);
  
  // Display user info
  displayUserInfo(user);
  
  // Load role-specific cards
  loadCards(user.role);
  
  // Hide loading
  hideLoading();
});

/**
 * Display user information
 */
function displayUserInfo(user) {
  document.getElementById('userName').textContent = user.name;
  document.getElementById('userRole').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  document.getElementById('welcomeTitle').textContent = 'Welcome back, ' + user.name + '!';
  
  // Set avatar initial
  const initial = user.name.charAt(0).toUpperCase();
  document.getElementById('userAvatar').textContent = initial;
}

/**
 * Load cards based on user role
 */
function loadCards(role) {
  const cardsContainer = document.getElementById('cardsContainer');
  const cards = ROLE_CARDS[role] || [];
  
  if (cards.length === 0) {
    cardsContainer.innerHTML = '<div class="no-cards">No modules available for your role.</div>';
    return;
  }
  
  let html = '';
  
  cards.forEach(function(card) {
    html += '<div class="card" onclick="navigateTo(\'' + card.link + '\')">';
    html += '  <div class="card-icon" style="background: ' + card.color + '">' + card.icon + '</div>';
    html += '  <div class="card-title">' + card.title + '</div>';
    html += '  <div class="card-description">' + card.description + '</div>';
    html += '</div>';
  });
  
  cardsContainer.innerHTML = html;
}

/**
 * Navigate to page
 */
function navigateTo(page) {
  window.location.href = page;
}

/**
 * Handle logout
 */
async function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) {
    return;
  }
  
  const sessionId = SessionManager.getSessionId();
  
  try {
    await API.call('logout', { sessionId: sessionId });
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  // Clear session and redirect
  SessionManager.clearSession();
  window.location.href = 'index.html';
}

/**
 * Show loading screen
 */
function showLoading() {
  document.getElementById('loadingScreen').style.display = 'flex';
  document.getElementById('mainContent').classList.add('hidden');
}

/**
 * Hide loading screen
 */
function hideLoading() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('mainContent').classList.remove('hidden');
}

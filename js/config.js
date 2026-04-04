// ==========================================
// CONFIGURATION - Vinay Automobiles
// ==========================================

const CONFIG = {
  // Apps Script Backend API
  API_ENDPOINT: 'https://script.google.com/macros/s/AKfycbwspc7qwDq4QSd5FHphzCp6xrmj6xP89ShvfOtvIkW1Z9OtU-VXG19sqbE02i9Bz_ozfw/exec',
  
  // Session Configuration
  SESSION_DURATION: 9 * 60 * 60 * 1000, // 9 hours in milliseconds
  
  // Role-based Access Control
  ROLE_ACCESS: {
    // Full access - Owner/IT Admin
    'admin': ['sales', 'salesedit', 'accounts', 'accessory', 'view', 'crm', 'dashboard', 'users'],
    
    // Sales Team - Sagar, Punam, Manisha, Hemant
    'sales': ['sales', 'salesedit', 'view', 'crm', 'dashboard'],
    
    // Accounts Department - Financial transactions
    'accounts': ['accounts', 'view', 'dashboard'],
    
    // Accessories Department - Fitting & inventory
    'accessories': ['accessory', 'view', 'dashboard'],
    
    // Operator - Status updates
    'operator': ['operator-update', 'view'],
    
    // Manager/Supervisor - Oversees operations
    'manager': ['sales', 'salesedit', 'accounts', 'accessory', 'view', 'crm', 'dashboard'],
    
    // CRM/Telecaller - Lead management
    'crm': ['crm', 'view', 'dashboard'],
    
    // View-only - Reports access
    'viewer': ['view', 'dashboard']
  },
  
  // Page Definitions
  PAGES: {
    'sales': { 
      title: 'Sales Entry', 
      icon: '🛒', 
      description: 'Create new sales bookings',
      class: 'card-sales'
    },
    'salesedit': { 
      title: 'Sales Edit', 
      icon: '✏️', 
      description: 'Modify existing sales records',
      class: 'card-salesedit'
    },
    'accounts': { 
      title: 'Accounts', 
      icon: '💰', 
      description: 'Manage financial transactions',
      class: 'card-accounts'
    },
    'accessory': { 
      title: 'Accessories', 
      icon: '🎯', 
      description: 'Track accessory inventory',
      class: 'card-accessories'
    },
    'view': { 
      title: 'View Records', 
      icon: '📊', 
      description: 'Browse all records',
      class: 'card-view'
    },
    'operator-update': { 
      title: 'Update Status', 
      icon: '🔄', 
      description: 'Update DMS/Insurance/Vahan status',
      class: 'card-operator'
    },
    'crm': { 
      title: 'CRM - Leads', 
      icon: '👥', 
      description: 'Manage customer relationships',
      class: 'card-crm'
    },
    'dashboard': { 
      title: 'Dashboard', 
      icon: '📈', 
      description: 'View analytics and reports',
      class: 'card-dashboard'
    },
    'users': { 
      title: 'User Management', 
      icon: '👤', 
      description: 'Manage user accounts',
      class: 'card-users'
    }
  }
};

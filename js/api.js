// ==========================================
// API COMMUNICATION MODULE
// ==========================================

const API = {
  
  /**
   * Make API call to Apps Script backend
   */
  async call(action, params = {}) {
    try {
      // Check if we should use POST (for large data like base64 or records array)
      const hasArrayParam = Array.isArray(params.records);
      const hasBase64 = !!params.base64Data;
      const hasData = !!params.data;
      const isTooLarge = JSON.stringify(params).length > 1000;
      
      const usePost = hasBase64 || hasData || hasArrayParam || isTooLarge;
      
      let response;
      
      if (usePost) {
        // POST request for large data
        console.log('API Call (POST):', action, Object.keys(params));
        console.log('POST reason:', { hasBase64, hasData, hasArrayParam, isTooLarge });
        
        const formData = new URLSearchParams();
        formData.append('action', action);
        
        for (const [key, value] of Object.entries(params)) {
          if (value !== null && value !== undefined) {
            if (typeof value === 'object') {
              formData.append(key, JSON.stringify(value));
            } else {
              formData.append(key, value);
            }
          }
        }
        
        response = await fetch(CONFIG.API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
          redirect: 'follow'
        });
        
      } else {
        // GET request for small data
        console.log('API Call (GET):', action, params);
        
        const url = new URL(CONFIG.API_ENDPOINT);
        url.searchParams.append('action', action);
        
        for (const [key, value] of Object.entries(params)) {
          if (value !== null && value !== undefined) {
            url.searchParams.append(key, value);
          }
        }
        
        response = await fetch(url.toString(), {
          method: 'GET',
          redirect: 'follow'
        });
      }
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      return data;
      
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        message: 'Network error: ' + error.message
      };
    }
  },
  
  /**
   * Login user
   */
  async login(username, password) {
    return await this.call('login', { username, password });
  },
  
  /**
   * Validate session
   */
  async validateSession(sessionId) {
    return await this.call('validateSession', { sessionId });
  },
  
  /**
   * Logout
   */
  async logout(sessionId) {
    return await this.call('logout', { sessionId });
  },
  
  /**
   * Get users (admin only)
   */
  async getUsers(sessionId) {
    return await this.call('getUsers', { sessionId });
  },
  
  /**
   * Check for duplicate receipt number
   */
  async checkDuplicateReceipt(sessionId, receiptNo) {
    return await this.call('checkDuplicateReceipt', { sessionId, receiptNo });
  },
  
  /**
   * Save sales entry
   */
  async saveSales(sessionId, salesData) {
    return await this.call('saveSales', { 
      sessionId, 
      data: JSON.stringify(salesData) 
    });
  },
  
  /**
   * Get sales data
   */
  async getSalesData(sessionId, limit = 100) {
    return await this.call('getSalesData', { sessionId, limit });
  },
  
  /**
   * Get accounts dashboard data
   */
  async getAccountsDashboard(sessionId, month) {
    return await this.call('getAccountsDashboard', { sessionId, month });
  },
  
  /**
   * Get accounts by status
   */
  async getAccountsByStatus(sessionId, month, status) {
    return await this.call('getAccountsByStatus', { sessionId, month, status });
  },
  
  /**
   * Search accounts records
   */
  async searchAccountsRecords(sessionId, searchBy, searchValue, dateFilter, singleDate, fromDate, toDate) {
    return await this.call('searchAccountsRecords', {
      sessionId,
      searchBy,
      searchValue,
      dateFilter,
      singleDate,
      fromDate,
      toDate
    });
  },
  
  /**
   * Get record by receipt number
   */
  async getRecordByReceiptNo(sessionId, receiptNo) {
    return await this.call('getRecordByReceiptNo', { sessionId, receiptNo });
  },
  
  /**
   * Update accounts record
   */
  async updateAccountsRecord(sessionId, data) {
    return await this.call('updateAccountsRecord', {
      sessionId,
      data: JSON.stringify(data)
    });
  },
  
  /**
   * Export accounts to CSV
   */
  async exportAccountsToCSV(sessionId, month, status) {
    return await this.call('exportAccountsToCSV', { sessionId, month, status });
  },
  
  /**
   * Get accessories dashboard data
   */
  async getAccessoryDashboardData(sessionId, month) {
    return await this.call('getAccessoryDashboardData', { sessionId, month });
  },
  
  /**
   * Get accessories filtered data
   */
  async getAccessoryFilteredData(sessionId, month, status) {
    return await this.call('getAccessoryFilteredData', { sessionId, month, status });
  },
  
  /**
   * Search accessory records
   */
  async searchAccessoryRecords(sessionId, searchBy, searchValue, dateFilter, singleDate, fromDate, toDate) {
    return await this.call('searchAccessoryRecords', {
      sessionId,
      searchBy,
      searchValue,
      dateFilter,
      singleDate,
      fromDate,
      toDate
    });
  },
  
  /**
   * Get accessory record by row
   */
  async getAccessoryRecordByRow(sessionId, row) {
    return await this.call('getAccessoryRecordByRow', { sessionId, row });
  },
  
  /**
   * Update accessory data
   */
  async updateAccessoryData(sessionId, row, checkerName, fitted, remark, pending, receipt1, extra) {
    return await this.call('updateAccessoryData', {
      sessionId,
      row,
      checkerName,
      fitted,
      remark,
      pending,
      receipt1,
      extra
    });
  },
  
  /**
   * Export accessories to Excel
   */
  async exportAccessoryToExcel(sessionId, month, status) {
    return await this.call('exportAccessoryToExcel', { sessionId, month, status });
  },
  
  /**
   * Search view records
   */
  async searchViewRecords(searchBy, searchValue, dateFilter, month, fromDate, toDate) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('searchViewRecords', {
      sessionId,
      searchBy,
      searchValue,
      dateFilter,
      month,
      fromDate,
      toDate
    });
  },
  
  /**
   * Get view record by row
   */
  async getViewRecordByRow(row) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getViewRecordByRow', { sessionId, row });
  },
  
  /**
   * Export view records to CSV
   */
  async exportViewRecordsToCSV(searchBy, searchValue, dateFilter, month, fromDate, toDate) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('exportViewRecordsToCSV', {
      sessionId,
      searchBy,
      searchValue,
      dateFilter,
      month,
      fromDate,
      toDate
    });
  },
  
  /**
   * Get CRM Dashboard
   */
  async getCRMDashboard() {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getCRMDashboard', { sessionId });
  },
  
  /**
   * Get available leads
   */
  async getAvailableLeads() {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getAvailableLeads', { sessionId });
  },
  
  /**
   * Get my leads
   */
  async getMyLeads() {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getMyLeads', { sessionId });
  },
  
  /**
   * Get all leads (admin)
   */
  async getAllLeads() {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getAllLeads', { sessionId });
  },
  
  /**
   * Add new lead
   */
  async addLead(data) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('addLead', {
      sessionId,
      data: JSON.stringify(data)
    });
  },
  
  /**
   * Claim lead
   */
  async claimLead(leadId, initialStatus) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('claimLead', {
      sessionId,
      leadId,
      initialStatus
    });
  },
  
  /**
   * Get lead details
   */
  async getLeadDetails(leadId) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getLeadDetails', {
      sessionId,
      leadId
    });
  },
  
  /**
   * Update lead
   */
  async updateLead(leadId, data) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('updateLead', {
      sessionId,
      leadId,
      data: JSON.stringify(data)
    });
  },
  
  /**
   * Add note to lead
   */
  async addLeadNote(leadId, note) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('addLeadNote', {
      sessionId,
      leadId,
      note
    });
  },
  
  /**
   * Convert lead to sale
   */
  async convertLeadToSale(leadId) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('convertLeadToSale', {
      sessionId,
      leadId
    });
  },
  
  /**
   * Get Sales Dashboard
   */
  async getSalesDashboard(dateFilter) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getSalesDashboard', {
      sessionId,
      dateFilter
    });
  },
  

  
  /**
   * Get Accessories Dashboard
   */
  async getAccessoriesDashboard(dateFilter) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getAccessoriesDashboard', {
      sessionId,
      dateFilter
    });
  },
  
  /**
   * Get Admin Dashboard
   */
  async getAdminDashboard(dateFilter) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getAdminDashboard', {
      sessionId,
      dateFilter
    });
  },
  
  /**
   * Get Accessory Breakdown
   */
  async getAccessoryBreakdown(type, dateFilter) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getAccessoryBreakdown', {
      sessionId,
      accessoryType: type,
      dateFilter
    });
  },
  
  /**
   * Get Operator Pending Counts
   */
  async getOperatorPendingCounts() {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getOperatorPendingCounts', {
      sessionId
    });
  },
  
  /**
   * Search Operator Records
   */
  async searchOperatorRecords(searchBy, searchValue) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('searchOperatorRecords', {
      sessionId,
      searchBy,
      searchValue
    });
  },
  
  /**
   * Get Operator Record Details
   */
  async getOperatorRecordDetails(receiptNo) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getOperatorRecordDetails', {
      sessionId,
      receiptNo
    });
  },
  
  /**
   * Update Operator Status
   */
  async updateOperatorStatus(receiptNo, data) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('updateOperatorStatus', {
      sessionId,
      receiptNo,
      data: JSON.stringify(data)
    });
  },
  
  /**
   * Get Operator Pending List
   */
  async getOperatorPendingList(type) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getOperatorPendingList', {
      sessionId,
      type
    });
  },
  
  /**
   * Get PriceMaster Models
   */
  async getPriceMasterModels() {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getPriceMasterModels', {
      sessionId
    });
  },
  
  /**
   * Get PriceMaster Variants for a model
   */
  async getPriceMasterVariants(model) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getPriceMasterVariants', {
      sessionId,
      model
    });
  },
  
  /**
   * Get PriceMaster Details for model/variant
   */
  async getPriceMasterDetails(model, variant) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getPriceMasterDetails', {
      sessionId,
      model,
      variant
    });
  },
  
  /**
   * Calculate Price for a sale record
   */
  async calculatePrice(receiptNo) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('calculatePrice', {
      sessionId,
      receiptNo
    });
  },
  
  /**
   * Save Price Verification
   */
  async savePriceVerification(receiptNo, calculatedTotal, matched) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('savePriceVerification', {
      sessionId,
      receiptNo,
      calculatedTotal,
      matched
    });
  },

/**
 * Parse Excel and check conflicts (combined function)
 */
parseAndCheckExcel: async function(base64Data, fileName) {
  const session = SessionManager.getSession();
  if (!session) {
    throw new Error('No session');
  }
  
  return this.call('parseAndCheckExcel', {
    sessionId: session.sessionId,
    base64Data: base64Data,
    fileName: fileName
  });
},

/**
 * Bulk update number plates
 */
bulkUpdateNumberPlates: async function(records, overwriteExisting) {
  const session = SessionManager.getSession();
  if (!session) {
    throw new Error('No session');
  }
  
  return this.call('bulkUpdateNumberPlates', {
    sessionId: session.sessionId,
    records: records,
    overwriteExisting: overwriteExisting
  });
},

// ==========================================
// API ADDITIONS FOR HSRP
// Add these to your api.js file at the end (before the closing brace)
// ==========================================

/**
 * Upload V301 file (Step 1)
 */
uploadV301File: async function(base64Data, fileName) {
  const session = SessionManager.getSession();
  if (!session) {
    throw new Error('No session');
  }
  
  return this.call('uploadV301File', {
    sessionId: session.sessionId,
    base64Data: base64Data,
    fileName: fileName
  });
},

/**
 * Upload Registration file (Step 2)
 */
uploadRegistrationFile: async function(base64Data, fileName) {
  const session = SessionManager.getSession();
  if (!session) {
    throw new Error('No session');
  }
  
  return this.call('uploadRegistrationFile', {
    sessionId: session.sessionId,
    base64Data: base64Data,
    fileName: fileName
  });
},

/**
 * Get HSRP data
 */
getHSRPData: async function() {
  const session = SessionManager.getSession();
  if (!session) {
    throw new Error('No session');
  }
  
  return this.call('getHSRPData', {
    sessionId: session.sessionId
  });
},

/**
 * Download HSRP data
 */
downloadHSRPData: async function() {
  const session = SessionManager.getSession();
  if (!session) {
    throw new Error('No session');
  }
  
  return this.call('downloadHSRPData', {
    sessionId: session.sessionId
  });
},

/**
 * Search HSRP data
 */
searchHSRPData: async function(searchBy, searchValue, dateFilter, customDate) {
  const session = SessionManager.getSession();
  if (!session) {
    throw new Error('No session');
  }
  
  return this.call('searchHSRPData', {
    sessionId: session.sessionId,
    searchBy: searchBy,
    searchValue: searchValue || '',
    dateFilter: dateFilter || '',
    customDate: customDate || ''
  });
}
};

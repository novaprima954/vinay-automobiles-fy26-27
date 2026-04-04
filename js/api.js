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
   * Validate session (auto-uses session from SessionManager)
   */
  async validateSession() {
    const session = SessionManager.getSession();
    if (!session) {
      return { success: false, message: 'No session found' };
    }
    return await this.call('validateSession', { sessionId: session.sessionId });
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
   * Get lead history
   */
  async getLeadHistory(leadId) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getLeadHistory', {
      sessionId,
      leadId
    });
  },
  
  /**
   * Get Dashboard Data
   */
  async getDashboardData() {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getDashboardData', {
      sessionId
    });
  },
  
  /**
   * Get sales record by receipt
   */
  async getSalesRecordByReceipt(receiptNo) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getSalesRecordByReceipt', {
      sessionId,
      receiptNo
    });
  },
  
  /**
   * Update sales record
   */
  async updateSalesRecord(receiptNo, data) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('updateSalesRecord', {
      sessionId,
      receiptNo,
      data: JSON.stringify(data)
    });
  },
  
  /**
   * Get Operator Pending List
   */
  async getOperatorPendingList(type, month) {
    const sessionId = SessionManager.getSessionId();
    return await this.call('getOperatorPendingList', {
      sessionId,
      type,
      month
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
  async parseAndCheckExcel(base64Data, fileName) {
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
  async bulkUpdateNumberPlates(records, overwriteExisting) {
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
  // HSRP FUNCTIONS
  // ==========================================

  /**
   * Upload V301 file (Step 1)
   */
  async uploadV301File(base64Data, fileName) {
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
  async uploadRegistrationFile(base64Data, fileName, orderDate) {
    const session = SessionManager.getSession();
    if (!session) {
      throw new Error('No session');
    }
    
    return this.call('uploadRegistrationFile', {
      sessionId: session.sessionId,
      base64Data: base64Data,
      fileName: fileName,
      orderDate: orderDate || ''
    });
  },

  /**
   * Update HSRP status
   */
  async updateHSRPStatus(srNo, newStatus) {
    const session = SessionManager.getSession();
    if (!session) {
      throw new Error('No session');
    }
    
    return this.call('updateHSRPStatus', {
      sessionId: session.sessionId,
      srNo: srNo,
      newStatus: newStatus
    });
  },

  /**
   * Export HSRP to PDF
   */
  async exportHSRPToPdf(fromDate, toDate) {
    const session = SessionManager.getSession();
    if (!session) {
      throw new Error('No session');
    }
    
    return this.call('exportHSRPToPdf', {
      sessionId: session.sessionId,
      fromDate: fromDate,
      toDate: toDate
    });
  },

  /**
   * Get HSRP data
   */
  async getHSRPData() {
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
  async downloadHSRPData() {
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
  async searchHSRPData(searchBy, searchValue, dateFilter, customDate) {
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
  },

  // ==========================================
  // VEHICLE MILEAGE FUNCTIONS
  // ==========================================

  /**
   * Get Vehicle Mileage Dashboard
   */
  async getVehicleMileageDashboard() {
    const session = SessionManager.getSession();
    if (!session) {
      throw new Error('No session');
    }
    
    return this.call('getVehicleMileageDashboard', {
      sessionId: session.sessionId
    });
  },
  
  /**
   * Get last KM reading for vehicle (auto-fetch)
   */
  async getLastKmReading(vehicleName) {
    const session = SessionManager.getSession();
    if (!session) {
      throw new Error('No session');
    }
    
    return this.call('getLastKmReading', {
      sessionId: session.sessionId,
      vehicleName: vehicleName
    });
  },
  
  /**
   * Add fuel entry
   */
  async addFuelEntry(data) {
    const session = SessionManager.getSession();
    if (!session) {
      throw new Error('No session');
    }
    
    return this.call('addFuelEntry', {
      sessionId: session.sessionId,
      data: JSON.stringify(data)
    });
  },
  
  /**
   * Get vehicle mileage history
   */
  async getVehicleMileageHistory(vehicleName, dateFrom, dateTo) {
    const session = SessionManager.getSession();
    if (!session) {
      throw new Error('No session');
    }
    
    return this.call('getVehicleMileageHistory', {
      sessionId: session.sessionId,
      vehicleName: vehicleName || '',
      dateFrom: dateFrom || '',
      dateTo: dateTo || ''
    });
  },
  
  /**
   * Get all fuel entries
   */
  async getAllFuelEntries(dateFrom, dateTo) {
    const session = SessionManager.getSession();
    if (!session) {
      throw new Error('No session');
    }
    
    return this.call('getAllFuelEntries', {
      sessionId: session.sessionId,
      dateFrom: dateFrom || '',
      dateTo: dateTo || ''
    });
  },
  
  /**
   * Get HPCL wallet transaction history
   */
  async getHPCLWalletHistory() {
    const session = SessionManager.getSession();
    if (!session) {
      throw new Error('No session');
    }
    
    return this.call('getHPCLWalletHistory', {
      sessionId: session.sessionId
    });
  },
  
  /**
   * Add HPCL wallet top-up
   */
  async addHPCLWalletTopup(amount, notes) {
    const session = SessionManager.getSession();
    if (!session) {
      throw new Error('No session');
    }
    
    return this.call('addHPCLWalletTopup', {
      sessionId: session.sessionId,
      amount: amount,
      notes: notes || ''
    });
  },
  
  /**
   * Export vehicle mileage to Excel
   */
  async exportVehicleMileageToExcel(vehicleName, dateFrom, dateTo) {
    const session = SessionManager.getSession();
    if (!session) {
      throw new Error('No session');
    }
    
    return this.call('exportVehicleMileageToExcel', {
      sessionId: session.sessionId,
      vehicleName: vehicleName || '',
      dateFrom: dateFrom || '',
      dateTo: dateTo || ''
    });
  }
};

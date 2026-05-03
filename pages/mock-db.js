/**
 * ZG API Client
 * Replaces the old localStorage mock-db with actual backend calls.
 */

// FOR SEPARATE DEPLOYMENT: Replace this with your ACTUAL Vercel backend URL
const PROD_BACKEND_URL = 'https://monbackend.vercel.app/api'; 

// Always use the live production backend
const API_BASE = PROD_BACKEND_URL; 


const monthrob_DB = {
  // Define it first, assign to window below
};

// EXPOSE GLOBALLY IMMEDIATELY
window.monthrob_DB = monthrob_DB;
window.ZG_DB = monthrob_DB;

Object.assign(monthrob_DB, {
  getToken() {
    if (window.location.pathname.includes('/admin/')) {
      return localStorage.getItem('monthrob_admin_token');
    }
    return localStorage.getItem('monthrob_token');
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // ENSURE ROBUST URL CONSTRUCTION
    let baseUrl = API_BASE;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    
    let path = endpoint;
    if (!path.startsWith('/')) path = '/' + path;

    const url = `${baseUrl}${path}`;

    try {
      const res = await fetch(url, {
        ...options,
        headers
      });

      if (res.status === 401) {
        console.warn('[monthrob_DB] Unauthorized response from:', endpoint);
        const isAdmin = window.location.pathname.includes('/admin/');
        
        if (isAdmin) {
            // For admins, we don't auto-redirect here anymore.
            // We let the page-level 'validateAdminSession' handle it.
            console.log('[monthrob_DB] Admin 401 caught. Delegating to guard.');
        } else {
            localStorage.removeItem('monthrob_token');
            localStorage.removeItem('monthrob_user');
            if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('createaccount.html')) {
                window.location.href = './login.html';
            }
        }
        return null;
      }

      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`[monthrob_DB] Request error (${endpoint}):`, err);
      return null;
    }
  },

  async get(key) {
    console.log(`[monthrob_DB] Fetching all ${key}...`);
    let endpoint = `/${key}`;
    const isAdmin = window.location.pathname.includes('/admin/');
    
    // Smart Route: If admin is asking for orders, use the admin endpoint
    if (isAdmin && key === 'orders') {
        endpoint = '/admin/orders';
    }
    
    return await this.request(endpoint, { method: 'GET', cache: 'no-store' });
  },

  async getItem(key, id) {
    console.log(`[monthrob_DB] Fetching ${key} item: ${id}...`);
    return await this.request(`/${key}/${id}`, { method: 'GET', cache: 'no-store' });
  },

  async addItem(key, item) {
    return await this.request(`/${key}`, {
      method: 'POST',
      body: JSON.stringify(item)
    });
  },

  async updateItem(key, id, updates) {
    let endpoint = `/${key}/${id}`;
    const isAdmin = window.location.pathname.includes('/admin/');

    // Smart Route: For admin orders, use the dedicated admin PUT route
    if (isAdmin && key === 'orders') {
        endpoint = `/admin/orders/${id}`;
    }

    return await this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  async saveShowcase(data) {
    return await this.request('/showcase', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async deleteItem(key, id) {
    return await this.request(`/${key}/${id}`, {
      method: 'DELETE'
    });
  },

  // User Profile
  async getUser() {
    return await this.request('/user');
  },

  // User Addresses
  async addAddress(data) {
    return await this.request('/user/addresses', {
        method: 'POST',
        body: JSON.stringify(data)
    });
  },

  async updateAddress(id, data) {
    return await this.request(`/user/addresses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
  },

  async deleteAddress(id) {
    return await this.request(`/user/addresses/${id}`, {
        method: 'DELETE'
    });
  },

  // --- Admin Session & Inactivity Monitor ---
  
  /**
   * New REMADE Auth Validator
   * Call this on every admin-*.html page load.
   */
  async validateAdminSession() {
    const token = localStorage.getItem('monthrob_admin_token');
    if (!token) {
        console.warn('[monthrob_DB] No token. Redirecting.');
        this.logoutAdmin();
        return false;
    }

    try {
        console.log('[monthrob_DB] Validating heartbeat...');
        const res = await fetch(`${API_BASE}/admin/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            console.log('[monthrob_DB] Verification Success:', data.admin.username);
            this.refreshAdminActivity();
            return true;
        } else {
            console.error('[monthrob_DB] Token invalid or expired.');
            this.logoutAdmin();
            return false;
        }
    } catch (err) {
        console.error('[monthrob_DB] Heartbeat error:', err);
        // On network error, we stay but warn. 
        // This prevents kicking out admins if the server flickers.
        return true; 
    }
  },

  checkAdminSession() {
    // Legacy support for sidebar check
    const token = localStorage.getItem('monthrob_admin_token');
    return !!token;
  },

  refreshAdminActivity() {
    localStorage.setItem('monthrob_admin_last_active', Date.now().toString());
  },

  logoutAdmin() {
    localStorage.removeItem('monthrob_admin_token');
    localStorage.removeItem('monthrob_admin_user');
    localStorage.removeItem('monthrob_admin_last_active');
    
    // Standardize redirection
    const isLoginPage = window.location.pathname.includes('admin-login.html');
    if (!isLoginPage) {
        window.location.href = 'admin-login.html';
    }
  },

  async updateUser(data) {
    return await this.request('/user', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
});

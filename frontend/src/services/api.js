import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Customer services
export const customerService = {
  getAll: (params) => apiClient.get('/customers', { params }),
  getById: (id) => apiClient.get(`/customers/${id}`),
  create: (data) => apiClient.post('/customers', data),
  update: (id, data) => apiClient.put(`/customers/${id}`, data),
  delete: (id) => apiClient.delete(`/customers/${id}`),
};

// Portfolio services
export const portfolioService = {
  getAll: () => apiClient.get('/portfolios'),
  getById: (id) => apiClient.get(`/portfolios/${id}`),
  getHoldings: (id) => apiClient.get(`/portfolios/${id}/holdings`),
};

// Trade services
export const tradeService = {
  getAll: (params) => apiClient.get('/trades', { params }),
  create: (data) => apiClient.post('/trades', data),
  approve: (id) => apiClient.post(`/trades/${id}/approve`),
};

// Report services
export const reportService = {
  getAll: (params) => apiClient.get('/reports', { params }),
  generate: (data) => apiClient.post('/reports/generate', data),
  download: (id) => apiClient.get(`/reports/${id}/download`, { responseType: 'blob' }),
  getPresignedUrl: (id) => apiClient.get(`/reports/${id}/url`),
  approve: (id, data) => apiClient.post(`/reports/${id}/approve`, data),
};

// Security services
export const securityService = {
  getAll: () => apiClient.get('/securities'),
};

export default apiClient;

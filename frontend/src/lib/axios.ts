import axios from 'axios';
import { API_CONFIG } from '../config/api.config';

const axiosInstance = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add request interceptor to add auth token
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor to handle errors
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            switch (error.response.status) {
                case 401:
                    // Unauthorized - clear token and redirect to login
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                    break;
                case 403:
                    // Forbidden - user doesn't have permission
                    console.error('Access forbidden:', error.response.data.error);
                    break;
                case 400:
                    // Bad Request - validation error
                    console.error('Validation error:', error.response.data.error);
                    break;
                case 500:
                    // Internal Server Error
                    console.error('Server error:', error.response.data.error);
                    break;
                default:
                    console.error('Request failed:', error.response.data.error);
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance; 
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor: attach auth token
api.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('auth_token');
            if (token) {
                console.log('Attaching Access Token:', token.substring(0, 10) + '...');
                config.headers.Authorization = `Bearer ${token}`;
            } else {
                console.warn('No Access Token found in localStorage');
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor: handle 401 + refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refresh_token');
                if (refreshToken) {
                    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                        refreshToken,
                    });
                    localStorage.setItem('auth_token', data.accessToken);
                    localStorage.setItem('refresh_token', data.refreshToken);
                    originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                    return api(originalRequest);
                }
            } catch {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('refresh_token');
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
            }
        }

        return Promise.reject(error);
    }
);

export default api;

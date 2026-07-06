import axios from 'axios';

const apiClient = axios.create({
    // In dev: requests go to /api/* → Vite proxy → http://localhost:5000 (no CORS)
    // In prod: set VITE_API_BASE to your backend URL (e.g. https://api.pilotis.com)
    baseURL: import.meta.env.VITE_API_BASE ?? '/api',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 90000, // 90s — /companies/conversion fetches from Boond (can take 30-60s)
});

// Log errors globally
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('[API Error]', error.response?.status, error.message);
        return Promise.reject(error);
    }
);

export default apiClient;

// Shared configuration - avoids circular imports with App.jsx
export const API_BASE_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '') 
  : (import.meta.env.PROD ? 'https://airindex-india-181v.onrender.com' : 'http://localhost:8000');

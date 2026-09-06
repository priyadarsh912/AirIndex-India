// Dynamic API Base URL configuration: uses VITE_API_URL env variable if set, otherwise empty string to utilize Vite reverse proxy
export const API_BASE_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '') 
  : '';

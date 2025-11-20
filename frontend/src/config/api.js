// API Configuration
const getBaseUrl = () => {
  // Try to get the server URL dynamically
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // If we're on port 3000 (frontend), assume backend is on 5000
    if (port === '3000') {
      return `${protocol}//${hostname}:5000`;
    }
    
    // For production or different setups, you might want to use environment variables
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL;
    }
    
    // Default fallback
    return `${protocol}//${hostname}:5000`;
  }
  
  return 'http://localhost:5000';
};

export const API_BASE_URL = getBaseUrl();

// Helper function for making API calls
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };
  
  try {
    const response = await fetch(url, config);
    return response;
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
};

export default API_BASE_URL;

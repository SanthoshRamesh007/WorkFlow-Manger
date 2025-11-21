// API Configuration
const getBaseUrl = () => {
  // Use production backend URL if available
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // Use Render deployment URL as default for production
  return "https://workflow-manger-1.onrender.com";
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

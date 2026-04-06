// Utility for making authenticated API calls

export function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** Authenticated GET (or other) for binary/text responses — omits JSON Content-Type. */
export async function apiDownload(url, options = {}) {
  const headers = { ...getAuthHeaders() };
  delete headers['Content-Type'];
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...headers,
      ...options.headers
    }
  });
}

export async function apiRequest(url, options = {}) {
  const headers = getAuthHeaders();
  
  const config = {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    },
    credentials: 'include'
  };
  
  const response = await fetch(url, config);
  
  // If unauthorized, clear token and redirect to login
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      // Don't redirect here, let the component handle it
    }
  }
  
  return response;
}

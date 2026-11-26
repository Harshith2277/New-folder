const API_BASE = '/api';

async function parseResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  let data;

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (jsonErr) {
      throw new Error(`Failed to parse backend response as JSON: ${jsonErr.message}`);
    }
  } else {
    // If backend is down or returned an HTML error page (e.g. 404 / 502 / 504 from reverse proxy)
    const textBody = await res.text();
    if (textBody.includes('<!DOCTYPE') || textBody.includes('<html')) {
      throw new Error(
        `Backend server at http://localhost:5000 is not reachable or returned HTML (HTTP ${res.status}). Please ensure the Express backend is running (cd backend && npm start).`
      );
    }
    throw new Error(textBody || `Server returned non-JSON response with status ${res.status}`);
  }

  if (!res.ok || !data.success) {
    const error = new Error(data.error || 'Request failed');
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  // Auth
  register: (payload) =>
    fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(parseResponse),

  login: (payload) =>
    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(parseResponse),

  getMe: (token) =>
    fetch(`${API_BASE}/auth/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(parseResponse),

  // Schemes & Sync
  getSchemes: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.isNew) params.set('isNew', '1');
    if (filters.state) params.set('state', filters.state);
    const qs = params.toString();
    return fetch(`${API_BASE}/schemes${qs ? `?${qs}` : ''}`).then(parseResponse);
  },

  syncGovSchemes: (officerName) =>
    fetch(`${API_BASE}/schemes/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officerName }),
    }).then(parseResponse),

  getSyncHistory: () => fetch(`${API_BASE}/schemes/sync/history`).then(parseResponse),

  // Eligibility
  checkEligibility: (payload) =>
    fetch(`${API_BASE}/eligibility/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(parseResponse),

  getAlternatives: (payload) =>
    fetch(`${API_BASE}/eligibility/alternatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(parseResponse),

  getSchemeVersions: (schemeId) =>
    fetch(`${API_BASE}/schemes/${schemeId}/versions`).then(parseResponse),

  updateSchemeRules: (schemeId, payload) =>
    fetch(`${API_BASE}/schemes/${schemeId}/rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(parseResponse),

  // Document Upload & Wallet
  uploadDocumentPdf: (formData) =>
    fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    }).then(parseResponse),

  getDocuments: (userId) =>
    fetch(`${API_BASE}/documents${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`).then(parseResponse),

  // Applications
  submitApplication: (payload) =>
    fetch(`${API_BASE}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(parseResponse),

  getApplications: (role = 'citizen', officerName = '', userId = '') =>
    fetch(
      `${API_BASE}/applications?role=${role}&officerName=${encodeURIComponent(officerName)}&userId=${encodeURIComponent(userId)}`
    ).then(parseResponse),

  editApplication: (appId, payload) =>
    fetch(`${API_BASE}/applications/${appId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(parseResponse),

  updateApplicationStatus: (appId, payload) =>
    fetch(`${API_BASE}/applications/${appId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(parseResponse),

  getAuditLogs: () => fetch(`${API_BASE}/audit-logs`).then(parseResponse),
};

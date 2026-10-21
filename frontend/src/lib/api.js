const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('securechain_token');
}

export function setToken(token) {
  localStorage.setItem('securechain_token', token);
}

export function clearToken() {
  localStorage.removeItem('securechain_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const err = new Error(data?.error || data?.detail || `Request failed: ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const api = {
  // Public Stats
  cveCount: () => request('/api/stats/cve-count'),

  // Auth
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, email, password) => request('/api/auth/register', { method: 'POST', body: { name, email, password } }),
  authStatus: () => request('/api/auth/status'),
  googleAuthorizeUrl: () => request('/api/auth/google'),
  githubAuthorizeUrl: () => request('/api/auth/github'),
  githubLinkUrl: () => request('/api/auth/github/link'),  // for Google users linking GitHub
  me: () => request('/api/auth/me'),

  // Dashboard
  dashboardSummary: () => request('/api/dashboard/summary'),

  // Repositories
  connectedRepos: () => request('/api/repos/connected'),
  listGitHubRepos: () => request('/api/repos'),
  connectRepo: (fullName, defaultBranch) => request('/api/repos/connect', { method: 'POST', body: { fullName, defaultBranch } }),
  getRepo: (id) => request(`/api/repos/${id}`),
  scanRepo: (id, opts = {}) => request(`/api/repos/${id}/scan`, { method: 'POST', body: opts }),
  deleteRepo: (id) => request(`/api/repos/${id}`, { method: 'DELETE' }),
  // Works for ALL users — paste package.json content directly, no GitHub token needed
  scanManifest: (manifestContent, projectName, maxDepth) =>
    request('/api/repos/scan-manifest', { method: 'POST', body: { manifestContent, projectName, maxDepth } }),

  // Vulnerabilities & Malware
  listVulnerabilities: (repoId = 'all') => request(`/api/vulnerabilities/${repoId}/list`),
  listMaliciousPackages: (repoId = 'all') => request(`/api/malicious-packages/${repoId}`),
  updateVulnerabilityStatus: (id, status, vexJustification) =>
    request(`/api/vulnerabilities/${id}/status`, { method: 'PATCH', body: { status, vexJustification } }),
  lookupNvd: (cveId) => request(`/api/vulnerabilities/${cveId}/nvd`),

  // SBOM endpoints
  listSboms: (repoId) => request(`/api/sboms${repoId ? `?repoId=${repoId}` : ''}`),
  getSbom: (id) => request(`/api/sboms/${id}`),
  getLatestSbom: (repoId) => request(`/api/repos/${repoId}/sbom`),
  exportSbomUrl: (sbomId, format) => `${API_BASE}/api/sboms/${sbomId}/export?format=${format}`,

  // Build integrity
  verifyBuild: (repoId, currentContent, baselineHash) =>
    request(`/api/repos/${repoId}/verify-build`, { method: 'POST', body: { currentContent, baselineHash } }),
  setBaseline: (repoId, content) => request(`/api/repos/${repoId}/set-baseline`, { method: 'POST', body: { content } }),

  // CI/CD
  generateCiApiKey: (repoId) => request(`/api/cicd/repos/${repoId}/api-key`, { method: 'POST' }),
  pipelineRuns: () => request('/api/cicd/pipeline-runs'),

  // Alert channels / notifications
  getAlertChannels: (repoId) => request(`/api/repos/${repoId}/alert-channels`),
  setAlertChannels: (repoId, channels) => request(`/api/repos/${repoId}/alert-channels`, { method: 'PUT', body: channels }),
  testAlertChannels: (repoId) => request(`/api/repos/${repoId}/alert-channels/test`, { method: 'POST' }),
  getAlertHistory: (repoId) => request(`/api/repos/${repoId}/alert-history`),

  // AI Threat Engine
  aiExplain: (finding) => request('/api/ai/explain', { method: 'POST', body: { finding } }),
  aiClassify: (finding) => request('/api/ai/classify', { method: 'POST', body: { finding } }),
  aiRemediate: (finding, sbomContext) => request('/api/ai/remediate', { method: 'POST', body: { finding, sbomContext } }),
  aiRootCause: (finding, chain) => request('/api/ai/root-cause', { method: 'POST', body: { finding, dependencyChain: chain } }),
  aiPredictRisk: (repoId) => request(`/api/ai/predict-risk/${repoId}`),
  aiChat: (messages, repoId) => request('/api/ai/chat', { method: 'POST', body: { messages, repoId } }),
  aiModelInfo: () => request('/api/ai/model-info'),
  aiExplainStream: (finding) => {
    const token = localStorage.getItem('securechain_token');
    return fetch(`${API_BASE}/api/ai/explain/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ finding }),
    });
  },

  // Compliance
  getCompliance: (repoId) => request(`/api/repos/${repoId}/compliance`),
  downloadComplianceUrl: (repoId) => `${API_BASE}/api/repos/${repoId}/compliance/download`,

  // Admin
  adminUsers: () => request('/api/admin/users'),
  adminSetRole: (userId, role) => request(`/api/admin/users/${userId}/role`, { method: 'PATCH', body: { role } }),
  adminInvite: (email, role, orgId) => request('/api/admin/users/invite', { method: 'POST', body: { email, role, orgId } }),
  adminOrgs: () => request('/api/admin/orgs'),
  adminCreateOrg: (name) => request('/api/admin/orgs', { method: 'POST', body: { name } }),
  adminUpgradePlan: (orgId, plan) => request(`/api/admin/orgs/${orgId}/plan`, { method: 'PATCH', body: { plan } }),
  adminApiKeys: () => request('/api/admin/api-keys'),
  adminCreateApiKey: (name, scopes) => request('/api/admin/api-keys', { method: 'POST', body: { name, scopes } }),
  adminRevokeApiKey: (id) => request(`/api/admin/api-keys/${id}`, { method: 'DELETE' }),

  // Onboarding & Team Directory
  completeOnboarding: (data) =>
    request('/api/auth/complete-onboarding', { method: 'POST', body: typeof data === 'string' ? { mode: data } : data }),
  searchTeams: (query = '') =>
    request(`/api/teams/search${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  requestJoinTeam: (teamId, note) =>
    request(`/api/teams/${teamId}/request-join`, { method: 'POST', body: { note } }),

  // Invite
  getInvite: (token) => request('/api/invite/' + token),
  acceptInvite: (token) => request('/api/invite/' + token + '/accept', { method: 'POST' }),

  // Team & Admin Requests
  teamInfo: () => request('/api/team/info'),
  teamMembers: () => request('/api/team/members'),
  removeMember: (id) => request('/api/team/members/' + id, { method: 'DELETE' }),
  getTeamRequests: () => request('/api/team/requests'),
  respondTeamRequest: (requestId, action, role = 'Developer') =>
    request(`/api/team/requests/${requestId}/respond`, { method: 'POST', body: { action, role } }),

  adminAuditLog: (params = {}) => request(`/api/admin/audit-log?${new URLSearchParams(params)}`),
};

export function wsThreatFeedUrl() {
  const base = API_BASE.replace(/^http/, 'ws');
  return `${base}/ws/threat-feed`;
}

export { API_BASE };
const BASE = "/api";

function getToken() {
  return localStorage.getItem("dc_token");
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isForm && body) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (netErr) {
    // Network offline / Airplane mode
    if (path.startsWith("/reports")) return { reports: [], offline: true };
    if (path.startsWith("/ngo")) return { notifications: [], offline: true };
    return { offline: true, error: "Network offline" };
  }

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no body */
  }

  if (data && data.offline) {
    if (path.startsWith("/reports")) return { reports: [], offline: true };
    if (path.startsWith("/ngo")) return { notifications: [], offline: true };
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  me: () => request("/auth/me"),
  config: () => request("/config"),

  listReports: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports${qs ? `?${qs}` : ""}`);
  },
  getReport: (id) => request(`/reports/${id}`),
  createReport: (formData) => request("/reports", { method: "POST", body: formData, isForm: true }),
  vote: (id, payload) => request(`/reports/${id}/vote`, { method: "POST", body: payload }),
  setStatus: (id, status) => request(`/reports/${id}/status`, { method: "POST", body: { status } }),
  simulateVotes: (id) => request(`/reports/${id}/simulate-votes`, { method: "POST" }),

  ngoNotifications: () => request("/ngo/notifications"),
  ackNotification: (id) => request(`/ngo/notifications/${id}/ack`, { method: "POST" }),

  getPublicNgos: (userLat, userLng) => {
    const qs = userLat != null && userLng != null ? `?userLat=${userLat}&userLng=${userLng}` : "";
    return request(`/ngo/public-list${qs}`);
  },
  getReportFundraiser: (reportId) => request(`/ngo/fundraiser/${reportId}`),
};

export { getToken };

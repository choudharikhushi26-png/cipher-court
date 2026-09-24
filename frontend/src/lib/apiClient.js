// Thin fetch wrapper to backend endpoints.
// Every API call goes through here so error-handling is consistent.

const BASE = "/api";

async function request(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function generateCase() {
  return request("POST", "/case/generate");
}

export function investigate(caseId, locationId) {
  return request("POST", `/case/${caseId}/investigate`, { locationId });
}

export function askSuspect(caseId, suspectId, question) {
  return request("POST", `/case/${caseId}/ask-suspect`, { suspectId, question });
}

export function submitReasoning(caseId, reasoning) {
  return request("POST", `/case/${caseId}/submit-reasoning`, reasoning);
}

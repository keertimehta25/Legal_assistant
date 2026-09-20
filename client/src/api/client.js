const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, options);
    let data = null;
    try {
        data = await res.json();
    } catch {
        // non-JSON response body, leave data as null
    }
    if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
    }
    return data;
}

export async function uploadDocument(file) {
    const formData = new FormData();
    formData.append('document', file);
    return request('/upload', { method: 'POST', body: formData });
}

export async function indexDocument(sessionId, text) {
    return request('/index-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, text }),
    });
}

export async function analyzeDocument(text) {
    return request('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
    });
}

export async function simplifyText(text, readingLevel = 'general public') {
    return request('/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, readingLevel }),
    });
}

export async function compareDocuments(docA, docB) {
    return request('/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docA, docB }),
    });
}

export async function askQuestion(sessionId, question) {
    return request('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, question }),
    });
}

export async function generateChecklist(analysisResult) {
    return request('/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisResult }),
    });
}

export async function checkHealth() {
    return request('/health', { method: 'GET' });
}

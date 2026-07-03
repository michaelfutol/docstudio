export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function fetchStats() {
  const res = await fetch(`${API_BASE_URL}/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function fetchProjects() {
  const res = await fetch(`${API_BASE_URL}/projects`);
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export async function fetchDocument(documentId: string | number) {
  const res = await fetch(`${API_BASE_URL}/documents/${documentId}`);
  if (!res.ok) throw new Error("Failed to fetch document");
  return res.json();
}

export async function deleteDocument(documentId: string | number) {
  const res = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error("Failed to delete document");
  return res.json();
}

export async function fetchTemplates() {
  const res = await fetch(`${API_BASE_URL}/templates`);
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json();
}

export async function triggerExtraction(docId: string | number, templateId: number) {
  const res = await fetch(`${API_BASE_URL}/documents/${docId}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: templateId })
  });
  if (!res.ok) throw new Error("Failed to extract data");
  return res.json();
}

export function uploadDocument(file: File, projectId?: number | string, onProgress?: (percent: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    
    let url = `${API_BASE_URL}/documents/`;
    if (projectId) {
      url += `?project_id=${projectId}`;
    }
    
    const xhr = new XMLHttpRequest();
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error("Upload failed with status: " + xhr.status));
      }
    };
    
    xhr.onerror = () => {
      reject(new Error("Network error during upload"));
    };
    
    xhr.open('POST', url, true);
    xhr.send(formData);
  });
}

export async function fetchPendingRecords() {
  const res = await fetch(`${API_BASE_URL}/records/pending`);
  if (!res.ok) throw new Error("Failed to fetch pending records");
  return res.json();
}

export async function updateRecordStatus(recordId: number, status: string, recordData?: any) {
  const res = await fetch(`${API_BASE_URL}/records/${recordId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, record_data: recordData })
  });
  if (!res.ok) throw new Error("Failed to update record status");
  return res.json();
}

export async function fetchRecord(recordId: string | number) {
  const res = await fetch(`${API_BASE_URL}/records/${recordId}`);
  if (!res.ok) throw new Error("Failed to fetch record");
  return res.json();
}

export async function createProject(name: string, description?: string) {
  const res = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description })
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export async function exportProject(projectId: number | string, format: string) {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/export?format=${format}`);
  if (!res.ok) throw new Error("Failed to export project");
  return res.blob();
}

export async function createTemplate(name: string, schema_json: any, validation_rules?: any) {
  const res = await fetch(`${API_BASE_URL}/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, schema_json, validation_rules })
  });
  if (!res.ok) throw new Error("Failed to create template");
  return res.json();
}

export async function updateTemplate(templateId: number | string, data: any) {
  const res = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Failed to update template");
  return res.json();
}

export async function deleteTemplate(templateId: number | string) {
  const res = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error("Failed to delete template");
  return res.json();
}

export async function deleteProject(projectId: number | string) {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error("Failed to delete project");
  return res.json();
}

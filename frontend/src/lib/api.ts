export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
export const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/v1$/, "");

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue }

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: number[];
  needsReview?: boolean;
}

export interface OCRPayload {
  pages?: Array<{
    page?: number;
    confidence?: number;
    width?: number;
    height?: number;
    source?: string;
    lines?: OCRLine[];
  }>;
}

export interface DocumentPage {
  id: number;
  document_id: number;
  page_number: number;
  image_path: string | null;
  width: number | null;
  height: number | null;
  ocr_json: OCRPayload | null;
  text_content: string | null;
  confidence: number | null;
}

export interface StudioDocument {
  id: number;
  filename: string;
  status: "uploaded" | "processing" | "processed" | "extracting" | "pending_review" | "approved" | "rejected" | "recreating_book" | "book_recreated" | "exported" | "failed";
  extraction_progress: string | null;
  pages: DocumentPage[];
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  industry: string;
  created_at: string;
  document_count: number;
  status: string;
}

export interface Template {
  id: number;
  name: string;
  industry: string;
  schema_json: JsonObject;
  validation_rules: JsonObject | null;
  is_builtin: boolean;
}

export interface ExtractedRecord {
  id: number;
  document_id: number;
  filename?: string;
  record_data: JsonObject;
  confidence: number | null;
  needs_review: boolean;
  status: string;
}

export interface StudioStats {
  total_documents: number;
  total_projects: number;
  total_templates: number;
  pending_review_count: number;
  approved_count: number;
  rejected_count: number;
  avg_confidence: number;
  stp_rate: number;
  recent_documents: Array<{ id: number; filename: string; status: string }>;
}

export interface SettingsStatus {
  api_status: string;
  database_driver: string;
  gemini_configured: boolean;
  openrouter_configured: boolean;
  uploads_writable: boolean;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json() as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // Keep the status-based fallback when the response is not JSON.
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export function documentExportUrl(documentId: string | number, path: string): string {
  return `${API_BASE_URL}/documents/${documentId}/${path.replace(/^\//, "")}`;
}

export function fetchStats(): Promise<StudioStats> {
  return apiRequest<StudioStats>("/stats");
}

export function fetchProjects(): Promise<Project[]> {
  return apiRequest<Project[]>("/projects");
}

export function fetchDocument(documentId: string | number): Promise<StudioDocument> {
  return apiRequest<StudioDocument>(`/documents/${documentId}`);
}

export function deleteDocument(documentId: string | number): Promise<{ message: string }> {
  return apiRequest(`/documents/${documentId}`, { method: "DELETE" });
}

export function fetchTemplates(): Promise<Template[]> {
  return apiRequest<Template[]>("/templates");
}

export function triggerExtraction(docId: string | number, templateId: number): Promise<{ message: string }> {
  return apiRequest(`/documents/${docId}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_id: templateId }),
  });
}

export function uploadDocument(
  file: File,
  projectId?: number | string,
  onProgress?: (percent: number) => void,
): Promise<{ message: string; document_id: number }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const query = projectId ? `?project_id=${encodeURIComponent(String(projectId))}` : "";
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as { message: string; document_id: number });
        } catch {
          reject(new Error("The upload completed but the server returned an invalid response"));
        }
        return;
      }
      try {
        const payload = JSON.parse(xhr.responseText) as { detail?: string };
        reject(new Error(payload.detail || `Upload failed with status ${xhr.status}`));
      } catch {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.open("POST", `${API_BASE_URL}/documents/${query}`, true);
    xhr.send(formData);
  });
}

export function updatePageText(
  documentId: string | number,
  pageNumber: number,
  ocrJson: OCRPayload,
  textContent: string,
): Promise<{ message: string }> {
  return apiRequest(`/documents/${documentId}/pages/${pageNumber}/text`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ocr_json: ocrJson, text_content: textContent }),
  });
}

export function fetchPendingRecords(): Promise<ExtractedRecord[]> {
  return apiRequest<ExtractedRecord[]>("/records/pending");
}

export function updateRecordStatus(
  recordId: number,
  status: "approved" | "rejected",
  recordData?: JsonObject,
): Promise<{ message: string }> {
  return apiRequest(`/records/${recordId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, record_data: recordData }),
  });
}

export function fetchRecord(recordId: string | number): Promise<ExtractedRecord> {
  return apiRequest<ExtractedRecord>(`/records/${recordId}`);
}

export function fetchDocumentRecord(docId: string | number): Promise<ExtractedRecord> {
  return apiRequest<ExtractedRecord>(`/documents/${docId}/record`);
}

export function createProject(name: string, description?: string, industry?: string): Promise<Project> {
  return apiRequest<Project>("/projects/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, industry }),
  });
}

export async function exportProject(projectId: number | string, format: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/export?format=${encodeURIComponent(format)}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(payload.detail || "Failed to export project");
  }
  return response.blob();
}

export function createTemplate(
  name: string,
  schemaJson: JsonObject,
  industry?: string,
  validationRules?: JsonObject,
): Promise<Template> {
  return apiRequest<Template>("/templates/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      schema_json: schemaJson,
      industry: industry || "General",
      validation_rules: validationRules,
    }),
  });
}

export function updateTemplate(id: number, data: Partial<{
  name: string;
  schema_json: JsonObject;
  industry: string;
  validation_rules: JsonObject;
}>): Promise<Template> {
  return apiRequest<Template>(`/templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteTemplate(templateId: number | string): Promise<{ message: string }> {
  return apiRequest(`/templates/${templateId}`, { method: "DELETE" });
}

export function deleteProject(projectId: number | string): Promise<{ message: string }> {
  return apiRequest(`/projects/${projectId}`, { method: "DELETE" });
}

export function recreateBook(documentId: string | number): Promise<{ message: string }> {
  return apiRequest(`/documents/${documentId}/recreate_book`, { method: "POST" });
}

export function fetchSettingsStatus(): Promise<SettingsStatus> {
  return apiRequest<SettingsStatus>("/settings/status");
}

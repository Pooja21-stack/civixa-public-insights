import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" }
});

apiClient.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const submissionsApi = {
  create: (data: FormData) =>
    apiClient.post("/api/v1/submissions", data, {
      headers: { "Content-Type": "multipart/form-data" }
    }),
  list: (params?: Record<string, string>) =>
    apiClient.get("/api/v1/submissions", { params }),
  getThemes: () => apiClient.get("/api/v1/themes"),
  getHotspots: () => apiClient.get("/api/v1/submissions/hotspots")
};

export const projectsApi = {
  getPriority: () => apiClient.get("/api/v1/projects/priority"),
  getById: (id: string) => apiClient.get(`/api/v1/projects/${id}`)
};

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post("/api/v1/auth/login", { email, password }),
  me: () => apiClient.get("/api/v1/auth/me")
};

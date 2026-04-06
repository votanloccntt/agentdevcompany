import axios from "axios";

const API_URL = "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  register: (email: string, password: string, name: string) =>
    api.post("/auth/register", { email, password, name }),
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
};

export const projectsAPI = {
  getAll: () => api.get("/projects"),
  getOne: (id: string) => api.get(`/projects/${id}`),
  create: (name: string, description?: string) =>
    api.post("/projects", { name, description }),
  update: (id: string, name: string, description?: string) =>
    api.put(`/projects/${id}`, { name, description }),
  delete: (id: string) => api.delete(`/projects/${id}`),
  getProjectChat: (id: string) => api.get(`/projects/${id}/chat`),
  projectChat: (id: string, message: string) =>
    api.post(`/projects/${id}/chat`, { message }),
  projectChatStream: (id: string, message: string) =>
    api.post(`/projects/${id}/chat/stream`, { message }, { responseType: 'stream' }),
  analyze: (id: string) => api.post(`/projects/${id}/analyze`),
  getWorkflow: (id: string) => api.get(`/projects/${id}/workflow`),
};

export const tasksAPI = {
  getAll: (projectId: string) => api.get(`/projects/${projectId}/tasks`),
  getOne: (id: string) => api.get(`/tasks/${id}`),
  create: (
    projectId: string,
    title: string,
    agentType: string,
    description?: string,
  ) =>
    api.post(`/projects/${projectId}/tasks`, { title, agentType, description }),
  chat: (taskId: string, message: string) =>
    api.post(`/tasks/${taskId}/chat`, { message }),
};

export const agentsAPI = {
  getAll: () => api.get("/agents"),
  getOne: (type: string) => api.get(`/agents/${type}`),
  chat: (agentType: string, message: string) =>
    api.post("/agents/chat", { agentType, message }),
  chatStream: (agentType: string, message: string) =>
    api.post(
      "/agents/chat/stream",
      { agentType, message },
      { responseType: "stream" },
    ),
};

export const getStreamResponse = async (url: string, data: any) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_URL}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return response.body;
};

export default api;

import type { Person, Project, TimelineData } from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export const api = {
  getTimeline: () => request<TimelineData>('/api/timeline'),

  getPeople: () => request<Person[]>('/api/people'),
  createPerson: (body: Partial<Person>) =>
    request<Person>('/api/people', { method: 'POST', body: JSON.stringify(body) }),
  updatePerson: (id: number, body: Partial<Person>) =>
    request<Person>(`/api/people/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePerson: (id: number) =>
    request<void>(`/api/people/${id}`, { method: 'DELETE' }),

  getProjects: () => request<Project[]>('/api/projects'),
  createProject: (body: Partial<Project>) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  updateProject: (id: number, body: Partial<Project>) =>
    request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProject: (id: number) =>
    request<void>(`/api/projects/${id}`, { method: 'DELETE' }),

  createAssignment: (body: {
    project_id: number;
    person_id?: number;
    person_ids?: number[];
    start_date: string;
  }) => request('/api/assignments', { method: 'POST', body: JSON.stringify(body) }),

  updateAssignment: (
    id: number,
    body: { person_id?: number; start_date?: string; sync_siblings?: boolean }
  ) =>
    request(`/api/assignments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deleteAssignment: (id: number) =>
    request<void>(`/api/assignments/${id}`, { method: 'DELETE' }),
};

import api from '@/shared/api/axios';
import { ApiResponse } from '@/shared/api/types';
import type { User } from '@/types/auth';

export interface LoginResponse {
  token: string;
  user: User;
}

export async function login(credentials: { citizen_id: string; password: string }) {
  const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
  return res.data;
}

export async function getCurrentUser() {
  const res = await api.get<ApiResponse<User>>('/auth/me');
  return res.data;
}

export async function logout() {
  const res = await api.post<ApiResponse<{ message: string }>>('/auth/logout');
  return res.data;
}

export async function updateCurrentUserProfile(payload: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
}) {
  const res = await api.patch<ApiResponse<User>>('/auth/me', payload);
  return res.data;
}

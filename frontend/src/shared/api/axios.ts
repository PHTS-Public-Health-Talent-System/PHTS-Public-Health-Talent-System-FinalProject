import axios, { AxiosError } from 'axios';
import { DEFAULT_API_BASE, resolveApiBaseUrl } from '@/shared/api/base-url';
import {
  AUTH_TOKEN_COOKIE_NAME,
  AUTH_TOKEN_STORAGE_NAME,
  AUTH_USER_STORAGE_NAME,
} from '@/shared/auth/storage';

const api = axios.create({
  baseURL: resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE),
  headers: {
    'Content-Type': 'application/json',
  },
});

const TOKEN_STORAGE_NAME = AUTH_TOKEN_STORAGE_NAME;
const USER_STORAGE_NAME = AUTH_USER_STORAGE_NAME;

const clearTokenCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
};

type ValidationDetail = {
  field?: string;
  message?: string;
};

type ApiErrorBody = {
  success?: boolean;
  error?: unknown;
  message?: string;
  details?: ValidationDetail[];
};

const toReadableErrorMessage = (body?: ApiErrorBody): string => {
  if (!body) return 'เกิดข้อผิดพลาดจากการเชื่อมต่อระบบ';

  if (Array.isArray(body.details) && body.details.length > 0) {
    const first = body.details[0];
    if (first?.message) return first.message;
  }

  if (typeof body.error === 'string' && body.error.trim().length > 0) {
    return body.error;
  }
  if (body.error && typeof body.error === 'object') {
    const nestedMessage = (body.error as { message?: unknown }).message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim().length > 0) {
      return nestedMessage;
    }
  }

  return body.message || 'เกิดข้อผิดพลาดจากการเชื่อมต่อระบบ';
};

// Interceptor: Attach Token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_STORAGE_NAME);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor: Handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const axiosError = axios.isAxiosError<ApiErrorBody>(error)
      ? (error as AxiosError<ApiErrorBody>)
      : null;
    const errorBody = axiosError?.response?.data;
    const readableMessage = toReadableErrorMessage(errorBody);

    if (axiosError?.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_STORAGE_NAME);
        localStorage.removeItem(USER_STORAGE_NAME);
        clearTokenCookie();
        // Prevent redirect loop if already on login
        if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
        }
      }
    }

    if (axiosError) {
      axiosError.message = readableMessage;
      (axiosError as AxiosError<ApiErrorBody> & { details?: ValidationDetail[] }).details =
        errorBody?.details;
      return Promise.reject(axiosError);
    }

    return Promise.reject(error);
  }
);

export default api;

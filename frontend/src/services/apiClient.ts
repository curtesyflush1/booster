import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ErrorHandler } from '../utils/errorHandler';


class ApiClient {
  private client: AxiosInstance;

  constructor() {
    const rawBase = import.meta.env.VITE_API_URL as string | undefined;
    const baseURL = rawBase ? `${rawBase.replace(/\/$/, '')}/api` : '/api';
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getStoredToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const appError = ErrorHandler.handleApiError(error);
        
        if (error.response?.status === 401) {
          window.dispatchEvent(new CustomEvent('auth-error'));
        }

        return Promise.reject(appError);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  setAuthToken(token: string, remember: boolean = false): void {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('auth_token', token);
  }

  clearAuthToken(): void {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
  }

  isAuthenticated(): boolean {
    return !!this.getStoredToken();
  }

  private getStoredToken(): string | null {
    return localStorage.getItem('auth_token') || 
           sessionStorage.getItem('auth_token');
  }
}

export const apiClient = new ApiClient();

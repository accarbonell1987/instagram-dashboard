import type { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * Clase base para todos los servicios HTTP.
 *
 * Responsabilidad única: encapsular las llamadas HTTP con tipos.
 * No gestiona tokens, no gestiona URLs de entorno, no gestiona errores.
 *
 * Diseñada para composición: los servicios concretos la extienden
 * con un solo nivel de herencia.
 */
export class HttpService {
  constructor(
    protected readonly http: AxiosInstance,
    protected readonly baseUrl: string
  ) {}

  protected async get<T>(
    path: string,
    params?: Record<string, unknown>,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.http
      .get<T>(`${this.baseUrl}${path}`, { params, ...config })
      .then((response) => response.data);
  }

  protected async post<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, data, config).then((response) => response.data);
  }

  protected async put<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, data, config).then((response) => response.data);
  }

  protected async patch<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, data, config).then((response) => response.data);
  }

  protected async delete<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`, config).then((response) => response.data);
  }

  protected async postForm<T>(
    path: string,
    formData: FormData,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.http
      .post<T>(`${this.baseUrl}${path}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        ...config,
      })
      .then((response) => response.data);
  }

  protected async getBlob(path: string, config?: AxiosRequestConfig): Promise<Blob> {
    return this.http
      .get(`${this.baseUrl}${path}`, { responseType: 'blob', ...config })
      .then((response) => response.data as Blob);
  }
}

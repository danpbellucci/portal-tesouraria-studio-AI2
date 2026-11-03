// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { localFetch } from '../backend/app';
const TOKEN_KEY = 'elo_treasury_token';

export class ApiClient {
  static getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  static setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  static clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    let res: Response;
    try {
      // 1. Tenta fetch real para o servidor local Node.js (grava dados em arquivos JSON locais na máquina)
      const httpRes = await fetch(endpoint, {
        ...options,
        headers
      });

      const contentType = httpRes.headers.get('content-type') || '';
      // Se retornou resposta de API ou erro estruturado do servidor
      if (httpRes.status !== 404 || contentType.includes('application/json')) {
        if (!httpRes.ok && options.body instanceof FormData) {
          try {
            const errClone = await httpRes.clone().json();
            if (errClone.error === 'Nenhum arquivo enviado.') {
              res = await localFetch(endpoint, { ...options, headers });
            } else {
              res = httpRes;
            }
          } catch {
            res = httpRes;
          }
        } else {
          res = httpRes;
        }
      } else {
        // Rota não encontrada no servidor: fallback para localFetch
        res = await localFetch(endpoint, { ...options, headers });
      }
    } catch {
      // Falha de rede ou servidor local indisponível: fallback seguro para localFetch no navegador
      res = await localFetch(endpoint, {
        ...options,
        headers
      });
    }

    if (res.status === 401) {
      this.clearToken();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    if (!res.ok) {
      let errorMsg = `Erro na requisição (${res.status})`;
      try {
        const errorJson = await res.json();
        if (errorJson.error) errorMsg = errorJson.error;
      } catch {
        // ignore fallback
      }
      throw new Error(errorMsg);
    }

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }

    return (await res.blob()) as unknown as T;
  }

  // File download helper
  static async downloadFile(endpoint: string, defaultFilename: string): Promise<void> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(endpoint, { headers });
      if (!res.ok && res.status === 404) {
        res = await localFetch(endpoint, { headers });
      }
    } catch {
      res = await localFetch(endpoint, { headers });
    }

    if (!res.ok) {
      throw new Error(`Falha ao baixar arquivo: ${res.statusText}`);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const disposition = res.headers.get('content-disposition');
    let filename = defaultFilename;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

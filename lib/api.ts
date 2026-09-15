import type {
  RegistroRequest,
  LoginRequest,
  LoginResponse,
  PerfilRequest,
  PerfilCompleto,
  AcessoPublicoRequest,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ─── helpers ─────────────────────────────────────────────────────────────────

function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vitaltag_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const tok = token();
  if (tok) headers["Authorization"] = `Bearer ${tok}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.erro ?? msg;
    } catch {}
    throw new ApiError(msg, res.status);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const ct = res.headers.get("content-type") ?? "";
  if (ct.startsWith("image/")) return res.blob() as unknown as T;

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function registrar(body: RegistroRequest): Promise<void> {
  await request("/api/v1/auth/registro", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function login(body: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Perfil ───────────────────────────────────────────────────────────────────

export async function buscarPerfil(): Promise<PerfilCompleto> {
  return request<PerfilCompleto>("/api/v1/perfil");
}

export async function salvarPerfil(body: PerfilRequest): Promise<PerfilCompleto> {
  return request<PerfilCompleto>("/api/v1/perfil", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function excluirPerfil(): Promise<void> {
  await request("/api/v1/perfil", { method: "DELETE" });
}

export async function gerarQRCode(): Promise<Blob> {
  return request<Blob>("/api/v1/perfil/qrcode");
}

// ─── Público ─────────────────────────────────────────────────────────────────

export async function acessarPublico(
  slug: string,
  body: AcessoPublicoRequest
): Promise<PerfilCompleto> {
  return request<PerfilCompleto>(`/api/v1/publico/${slug}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

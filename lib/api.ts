import type {
  RegisterRequest,
  LoginRequest,
  LoginResponse,
  ProfileRequest,
  Profile,
  PublicAccessRequest,
  Allergy,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ─── Wire contract (vitaltag-api) ────────────────────────────────────────────
//
// The backend uses Portuguese routes and JSON field names. This section is the ONLY place in
// the frontend that knows about them: everything else works with the English types from
// "@/types". If the API contract changes, update these types and the mappers below.

interface WireRegisterRequest {
  nome: string;
  sobrenome: string;
  email: string;
  senha: string;
  consentimento: boolean;
}

interface WireLoginRequest {
  email: string;
  senha: string;
}

interface WireProfileRequest {
  nome: string;
  sobrenome: string;
  data_nascimento: string;
  tipo_sanguineo: string;
  senha_publica: string;
  contatos_emergencia: { nome: string; telefone: string; parentesco: string }[];
  alergias: { descricao: string; gravidade: string }[];
  medicamentos: { nome: string; dose: string; frequencia: string }[];
  doencas: { nome: string; desde: string }[];
  cirurgias: { procedimento: string; data: string }[];
}

// Lists may come back as null from the API.
type Nullable<T> = { [K in keyof T]: T[K] extends unknown[] ? T[K] | null : T[K] };

type WireProfile = Nullable<Omit<WireProfileRequest, "senha_publica">> & {
  slug: string;
  usuario_id: string;
};

interface WirePublicAccessRequest {
  senha: string;
}

interface WireError {
  erro?: string;
}

// Allergy severity values as stored by the API.
const SEVERITY_TO_WIRE: Record<string, string> = {
  mild: "leve",
  moderate: "moderada",
  severe: "grave",
  fatal: "fatal",
};
const SEVERITY_FROM_WIRE: Record<string, string> = Object.fromEntries(
  Object.entries(SEVERITY_TO_WIRE).map(([en, pt]) => [pt, en])
);

// ─── Mappers ─────────────────────────────────────────────────────────────────

function toWireRegister(r: RegisterRequest): WireRegisterRequest {
  return {
    nome: r.firstName,
    sobrenome: r.lastName,
    email: r.email,
    senha: r.password,
    consentimento: r.consent,
  };
}

function toWireLogin(r: LoginRequest): WireLoginRequest {
  return { email: r.email, senha: r.password };
}

function toWireProfile(p: ProfileRequest): WireProfileRequest {
  return {
    nome: p.firstName,
    sobrenome: p.lastName,
    data_nascimento: p.birthDate,
    tipo_sanguineo: p.bloodType,
    senha_publica: p.publicPassword,
    contatos_emergencia: p.emergencyContacts.map((c) => ({
      nome: c.name,
      telefone: c.phone,
      parentesco: c.relationship,
    })),
    alergias: p.allergies.map((a) => ({
      descricao: a.description,
      gravidade: SEVERITY_TO_WIRE[a.severity] ?? a.severity,
    })),
    medicamentos: p.medications.map((m) => ({
      nome: m.name,
      dose: m.dose,
      frequencia: m.frequency,
    })),
    doencas: p.conditions.map((c) => ({ nome: c.name, desde: c.since })),
    cirurgias: p.surgeries.map((s) => ({ procedimento: s.procedure, data: s.date })),
  };
}

function fromWireProfile(w: WireProfile): Profile {
  return {
    slug: w.slug,
    userId: w.usuario_id,
    firstName: w.nome,
    lastName: w.sobrenome,
    birthDate: w.data_nascimento,
    bloodType: w.tipo_sanguineo,
    emergencyContacts: (w.contatos_emergencia ?? []).map((c) => ({
      name: c.nome,
      phone: c.telefone,
      relationship: c.parentesco,
    })),
    allergies: (w.alergias ?? []).map(
      (a): Allergy => ({
        description: a.descricao,
        severity: SEVERITY_FROM_WIRE[a.gravidade] ?? a.gravidade,
      })
    ),
    medications: (w.medicamentos ?? []).map((m) => ({
      name: m.nome,
      dose: m.dose,
      frequency: m.frequencia,
    })),
    conditions: (w.doencas ?? []).map((d) => ({ name: d.nome, since: d.desde })),
    surgeries: (w.cirurgias ?? []).map((c) => ({ procedure: c.procedimento, date: c.data })),
  };
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

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
      const body: WireError = await res.json();
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

export async function register(body: RegisterRequest): Promise<void> {
  await request("/api/v1/auth/registro", {
    method: "POST",
    body: JSON.stringify(toWireRegister(body)),
  });
}

export async function login(body: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(toWireLogin(body)),
  });
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile> {
  return fromWireProfile(await request<WireProfile>("/api/v1/perfil"));
}

export async function saveProfile(body: ProfileRequest): Promise<Profile> {
  const saved = await request<WireProfile>("/api/v1/perfil", {
    method: "POST",
    body: JSON.stringify(toWireProfile(body)),
  });
  return fromWireProfile(saved);
}

/** DELETE /perfil — the UI treats this as deleting the account (it logs out afterwards). */
export async function deleteProfile(): Promise<void> {
  await request("/api/v1/perfil", { method: "DELETE" });
}

export async function getQRCode(): Promise<Blob> {
  return request<Blob>("/api/v1/perfil/qrcode");
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function accessPublicProfile(
  slug: string,
  body: PublicAccessRequest
): Promise<Profile> {
  const wire: WirePublicAccessRequest = { senha: body.password };
  const profile = await request<WireProfile>(`/api/v1/publico/${slug}`, {
    method: "POST",
    body: JSON.stringify(wire),
  });
  return fromWireProfile(profile);
}

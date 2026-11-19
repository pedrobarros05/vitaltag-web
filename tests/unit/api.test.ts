// lib/api.ts is the only place that knows the API's Portuguese wire format. These tests pin
// both directions of the mapping (English types ⇄ wire JSON), the routes/methods/headers, and
// how HTTP errors become ApiError. `fetch` is stubbed, so no server is needed.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  accessPublicProfile,
  deleteProfile,
  getProfile,
  getQRCode,
  login,
  register,
  saveProfile,
} from "@/lib/api";
import {
  PROFILE,
  PROFILE_REQUEST,
  WIRE_PROFILE,
  WIRE_PROFILE_REQUEST,
  jsonResponse,
} from "./fixtures";

const API = "http://localhost:8080"; // default when NEXT_PUBLIC_API_URL is not set

let fetchMock: ReturnType<typeof vi.fn>;

/** Queue the Response the next fetch() call resolves with. */
function respondWith(res: Response) {
  fetchMock.mockResolvedValueOnce(res);
}

/** The request lib/api.ts made: URL, method, headers and the parsed JSON body. */
function lastRequest() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init = {}] = fetchMock.mock.calls[0] as [string, RequestInit];
  return {
    url,
    method: init.method ?? "GET",
    headers: (init.headers ?? {}) as Record<string, string>,
    body: typeof init.body === "string" ? JSON.parse(init.body) : init.body,
  };
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

// ─── Auth ────────────────────────────────────────────────────────────────────

describe("register", () => {
  it("POSTs the Portuguese wire body to /auth/registro", async () => {
    respondWith(jsonResponse({ id: "1", mensagem: "ok" }, 201));

    await register({
      firstName: "Maria",
      lastName: "Silva",
      email: "maria@example.com",
      password: "password1",
      consent: true,
    });

    const req = lastRequest();
    expect(req.url).toBe(`${API}/api/v1/auth/registro`);
    expect(req.method).toBe("POST");
    expect(req.headers["Content-Type"]).toBe("application/json");
    // Exact match: no English keys may leak onto the wire
    expect(req.body).toStrictEqual({
      nome: "Maria",
      sobrenome: "Silva",
      email: "maria@example.com",
      senha: "password1",
      consentimento: true,
    });
  });

  it("sends consentimento: false as-is (the API enforces LGPD consent)", async () => {
    respondWith(jsonResponse({ erro: "consent required" }, 400));
    await expect(
      register({ firstName: "A", lastName: "B", email: "a@b.co", password: "12345678", consent: false })
    ).rejects.toThrow("consent required");
    expect(lastRequest().body.consentimento).toBe(false);
  });

  it("surfaces 409 (email already registered) as ApiError", async () => {
    respondWith(jsonResponse({ erro: "email already registered" }, 409));
    const err = await register({
      firstName: "A",
      lastName: "B",
      email: "a@b.co",
      password: "12345678",
      consent: true,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, message: "email already registered" });
  });
});

describe("login", () => {
  it("sends { email, senha } and returns the token", async () => {
    respondWith(jsonResponse({ token: "tok-123" }));

    await expect(login({ email: "demo@example.com", password: "demo1234" })).resolves.toEqual({
      token: "tok-123",
    });

    const req = lastRequest();
    expect(req.url).toBe(`${API}/api/v1/auth/login`);
    expect(req.method).toBe("POST");
    expect(req.body).toStrictEqual({ email: "demo@example.com", senha: "demo1234" });
  });

  it("does not send an Authorization header when signed out", async () => {
    respondWith(jsonResponse({ token: "t" }));
    await login({ email: "a@b.co", password: "x" });
    expect(lastRequest().headers).not.toHaveProperty("Authorization");
  });
});

// ─── Profile ─────────────────────────────────────────────────────────────────

describe("getProfile", () => {
  it("GETs /perfil with the stored bearer token", async () => {
    localStorage.setItem("vitaltag_token", "tok-abc");
    respondWith(jsonResponse(WIRE_PROFILE));

    await getProfile();

    const req = lastRequest();
    expect(req.url).toBe(`${API}/api/v1/perfil`);
    expect(req.method).toBe("GET");
    expect(req.headers.Authorization).toBe("Bearer tok-abc");
  });

  it("maps every wire field to the English Profile type", async () => {
    respondWith(jsonResponse(WIRE_PROFILE));
    // toStrictEqual also fails if a Portuguese key leaks through or an English one is missing
    await expect(getProfile()).resolves.toStrictEqual(PROFILE);
  });

  it("translates allergy severities leve/moderada/grave/fatal → mild/moderate/severe/fatal", async () => {
    respondWith(jsonResponse(WIRE_PROFILE));
    const p = await getProfile();
    expect(p.allergies.map((a) => a.severity)).toEqual(["mild", "moderate", "severe", "fatal"]);
  });

  it("passes unknown severities through unchanged instead of dropping them", async () => {
    respondWith(
      jsonResponse({ ...WIRE_PROFILE, alergias: [{ descricao: "Latex", gravidade: "desconhecida" }] })
    );
    const p = await getProfile();
    expect(p.allergies).toEqual([{ description: "Latex", severity: "desconhecida" }]);
  });

  it("turns null lists from the API into empty arrays", async () => {
    respondWith(
      jsonResponse({
        ...WIRE_PROFILE,
        contatos_emergencia: null,
        alergias: null,
        medicamentos: null,
        doencas: null,
        cirurgias: null,
      })
    );
    const p = await getProfile();
    expect(p.emergencyContacts).toEqual([]);
    expect(p.allergies).toEqual([]);
    expect(p.medications).toEqual([]);
    expect(p.conditions).toEqual([]);
    expect(p.surgeries).toEqual([]);
  });

  it("throws ApiError 404 when the user has no profile yet", async () => {
    respondWith(jsonResponse({ erro: "profile not found" }, 404));
    await expect(getProfile()).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "profile not found",
    });
  });
});

describe("saveProfile", () => {
  it("POSTs the exact Portuguese wire body (including senha_publica)", async () => {
    localStorage.setItem("vitaltag_token", "tok-abc");
    respondWith(jsonResponse(WIRE_PROFILE));

    await saveProfile(PROFILE_REQUEST);

    const req = lastRequest();
    expect(req.url).toBe(`${API}/api/v1/perfil`);
    expect(req.method).toBe("POST");
    expect(req.headers.Authorization).toBe("Bearer tok-abc");
    expect(req.body).toStrictEqual(WIRE_PROFILE_REQUEST);
  });

  it("translates severities mild/moderate/severe/fatal → leve/moderada/grave/fatal", async () => {
    respondWith(jsonResponse(WIRE_PROFILE));
    await saveProfile(PROFILE_REQUEST);
    expect(lastRequest().body.alergias.map((a: { gravidade: string }) => a.gravidade)).toEqual([
      "leve",
      "moderada",
      "grave",
      "fatal",
    ]);
  });

  it("sends a blank senha_publica so the API keeps the current password", async () => {
    respondWith(jsonResponse(WIRE_PROFILE));
    await saveProfile({ ...PROFILE_REQUEST, publicPassword: "" });
    expect(lastRequest().body.senha_publica).toBe("");
  });

  it("sends empty lists as [] (never null/undefined)", async () => {
    respondWith(jsonResponse(WIRE_PROFILE));
    await saveProfile({
      ...PROFILE_REQUEST,
      emergencyContacts: [],
      allergies: [],
      medications: [],
      conditions: [],
      surgeries: [],
    });
    const { body } = lastRequest();
    for (const key of ["contatos_emergencia", "alergias", "medicamentos", "doencas", "cirurgias"]) {
      expect(body[key], key).toEqual([]);
    }
  });

  it("returns the saved profile mapped back to English", async () => {
    respondWith(jsonResponse(WIRE_PROFILE));
    await expect(saveProfile(PROFILE_REQUEST)).resolves.toStrictEqual(PROFILE);
  });

  it("surfaces validation errors from the API's { erro } body", async () => {
    respondWith(jsonResponse({ erro: "invalid blood type" }, 400));
    await expect(saveProfile(PROFILE_REQUEST)).rejects.toMatchObject({
      status: 400,
      message: "invalid blood type",
    });
  });
});

describe("deleteProfile", () => {
  it("sends DELETE /perfil and resolves on 204 without parsing a body", async () => {
    localStorage.setItem("vitaltag_token", "tok-abc");
    respondWith(new Response(null, { status: 204 }));

    await expect(deleteProfile()).resolves.toBeUndefined();

    const req = lastRequest();
    expect(req.url).toBe(`${API}/api/v1/perfil`);
    expect(req.method).toBe("DELETE");
    expect(req.headers.Authorization).toBe("Bearer tok-abc");
  });
});

describe("getQRCode", () => {
  it("returns the PNG as a Blob (not parsed as JSON)", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    respondWith(new Response(png, { status: 200, headers: { "Content-Type": "image/png" } }));

    const blob = await getQRCode();

    expect(lastRequest().url).toBe(`${API}/api/v1/perfil/qrcode`);
    expect(blob.type).toBe("image/png");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(png);
  });
});

// ─── Public ──────────────────────────────────────────────────────────────────

describe("accessPublicProfile", () => {
  it("POSTs { senha } to /publico/<slug> and maps the result", async () => {
    respondWith(jsonResponse(WIRE_PROFILE));

    await expect(accessPublicProfile("abc123", { password: "4321" })).resolves.toStrictEqual(PROFILE);

    const req = lastRequest();
    expect(req.url).toBe(`${API}/api/v1/publico/abc123`);
    expect(req.method).toBe("POST");
    expect(req.body).toStrictEqual({ senha: "4321" });
  });

  it.each([
    [401, "incorrect password"],
    [404, "profile not found"],
    [429, "too many incorrect attempts, try again later"],
  ])("HTTP %i → ApiError with that status (the page picks the message from it)", async (status, erro) => {
    respondWith(jsonResponse({ erro }, status));
    await expect(accessPublicProfile("abc123", { password: "x" })).rejects.toMatchObject({
      name: "ApiError",
      status,
      message: erro,
    });
  });
});

// ─── Errors & configuration ──────────────────────────────────────────────────

describe("error handling", () => {
  it("falls back to 'HTTP <status>' when the error body isn't JSON", async () => {
    respondWith(new Response("<html>Bad Gateway</html>", { status: 502 }));
    await expect(getProfile()).rejects.toMatchObject({ status: 502, message: "HTTP 502" });
  });

  it("falls back to 'HTTP <status>' when the JSON body has no `erro` key", async () => {
    respondWith(jsonResponse({ error: "english key is not part of the contract" }, 500));
    await expect(getProfile()).rejects.toMatchObject({ status: 500, message: "HTTP 500" });
  });

  it("lets network failures propagate (not disguised as ApiError)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const err = await getProfile().catch((e) => e);
    expect(err).toBeInstanceOf(TypeError);
    expect(err).not.toBeInstanceOf(ApiError);
  });
});

describe("API base URL", () => {
  it("uses NEXT_PUBLIC_API_URL when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
    vi.resetModules(); // BASE is read when the module loads
    const api = await import("@/lib/api");

    respondWith(jsonResponse({ token: "t" }));
    await api.login({ email: "a@b.co", password: "x" });

    expect(lastRequest().url).toBe("https://api.example.test/api/v1/auth/login");
  });
});

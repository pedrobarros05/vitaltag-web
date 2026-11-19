// Contract test: the real lib/api.ts against the real API mock (mock-api/server.mjs) over HTTP.
//
// api.test.ts pins the mapping with a stubbed fetch; this file catches the other failure mode —
// lib/api.ts and the mock drifting apart (a renamed route or field on either side).

import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PROFILE, PROFILE_REQUEST } from "./fixtures";

type Api = typeof import("@/lib/api");

// (string form: under jsdom the global URL is jsdom's, which fileURLToPath rejects)
const SERVER = resolve(dirname(fileURLToPath(import.meta.url)), "../../mock-api/server.mjs");
let proc: ChildProcess | undefined;
let api: Api;
let apiUrl = "";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.on("error", reject);
    s.listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });
}

beforeAll(async () => {
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, MOCK_PORT: String(port), MOCK_DELAY: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc = child;
  let stderr = "";
  child.stderr!.on("data", (d) => (stderr += d));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`mock did not start:\n${stderr}`)), 10_000);
    child.stdout!.on("data", (d) => {
      if (String(d).includes("running at")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("exit", (code) => reject(new Error(`mock exited with code ${code}:\n${stderr}`)));
  });

  // lib/api.ts reads NEXT_PUBLIC_API_URL when the module loads
  apiUrl = `http://localhost:${port}`;
  vi.stubEnv("NEXT_PUBLIC_API_URL", apiUrl);
  vi.resetModules();
  api = await import("@/lib/api");
});

afterAll(() => {
  proc?.kill();
});

async function signIn(email: string, password: string) {
  const { token } = await api.login({ email, password });
  localStorage.setItem("vitaltag_token", token);
}

describe("lib/api.ts ⇄ mock API", () => {
  it("reads the seeded demo profile and maps it to English", async () => {
    await signIn("demo@example.com", "demo1234");
    const p = await api.getProfile();

    expect(p).toMatchObject({ slug: "demo", firstName: "Demo", lastName: "User", bloodType: "O-" });
    expect(p.allergies).toEqual([
      { description: "Penicillin", severity: "severe" },
      { description: "Shellfish", severity: "moderate" },
    ]);
    expect(p.emergencyContacts[0]).toEqual({
      name: "Contact One",
      phone: "(00) 00000-0001",
      relationship: "Spouse",
    });
    expect(p.conditions).toContainEqual({ name: "Type 2 diabetes", since: "" });
  });

  it("full lifecycle: register → login → create profile → public access → QR → delete", async () => {
    const email = `contract-${Date.now()}@example.com`;
    await api.register({ firstName: "Maria", lastName: "Silva", email, password: "password1", consent: true });
    await signIn(email, "password1");

    // New account: no profile yet
    await expect(api.getProfile()).rejects.toMatchObject({ status: 404 });

    // Everything the form sends must come back identical (the mock echoes the stored record)
    const saved = await api.saveProfile(PROFILE_REQUEST);
    const { slug, userId, ...data } = saved;
    const { slug: _s, userId: _u, ...expected } = PROFILE;
    expect(slug).toBeTruthy();
    expect(userId).toBeTruthy();
    expect(data).toStrictEqual(expected);
    await expect(api.getProfile()).resolves.toStrictEqual(saved);

    // A round trip can hide symmetric bugs (e.g. severities never translated in either
    // direction), so also check what the mock actually stored, in its own wire format.
    const raw = await fetch(`${apiUrl}/api/v1/perfil`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("vitaltag_token")}` },
    }).then((r) => r.json());
    expect(raw.alergias.map((a: { gravidade: string }) => a.gravidade)).toEqual([
      "leve",
      "moderada",
      "grave",
      "fatal",
    ]);
    expect(raw.contatos_emergencia).toEqual([
      { nome: "João Silva", telefone: "(11) 98765-4321", parentesco: "Spouse" },
    ]);

    // Editing with a blank public password keeps the old one
    await api.saveProfile({ ...PROFILE_REQUEST, publicPassword: "", bloodType: "O+" });
    const pub = await api.accessPublicProfile(slug, { password: PROFILE_REQUEST.publicPassword });
    expect(pub.bloodType).toBe("O+");
    expect(pub.allergies).toStrictEqual(PROFILE.allergies);

    const qr = await api.getQRCode();
    expect(qr.type).toBe("image/png");
    expect(qr.size).toBeGreaterThan(0);

    await api.deleteProfile();
    await expect(api.getProfile()).rejects.toMatchObject({ status: 401 });
  });

  it("maps the mock's { erro } bodies into ApiError messages", async () => {
    await expect(api.login({ email: "demo@example.com", password: "wrong" })).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "incorrect email or password",
    });
    await expect(api.accessPublicProfile("no-such-slug", { password: "1" })).rejects.toMatchObject({
      status: 404,
      message: "profile not found",
    });
  });
});

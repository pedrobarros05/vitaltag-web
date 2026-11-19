// API mock tests: start the real server.mjs on a free port and exercise it over HTTP,
// exactly like the frontend (lib/api.ts) does.
//
// Payloads use the vitaltag-api wire format (Portuguese field names) on purpose.
//
// Run:  npm run test:mock

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const SERVER = fileURLToPath(new URL("./server.mjs", import.meta.url));
const WEB_URL = "http://web.test";
let proc;
let API;

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.on("error", reject);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

before(async () => {
  const port = await freePort();
  API = `http://localhost:${port}/api/v1`;
  proc = spawn(process.execPath, [SERVER], {
    env: { ...process.env, MOCK_PORT: String(port), WEB_URL, MOCK_DELAY: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  proc.stderr.on("data", (d) => (stderr += d));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`mock did not start in time:\n${stderr}`)), 10_000);
    proc.stdout.on("data", (d) => {
      if (String(d).includes("running at")) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.on("exit", (code) => reject(new Error(`mock exited with code ${code}:\n${stderr}`)));
  });
});

after(() => proc?.kill());

// ─── helpers ─────────────────────────────────────────────────────────────────

async function call(method, path, { body, token, raw } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const ct = res.headers.get("content-type") ?? "";
  const data =
    res.status === 204 ? null : ct.startsWith("application/json") ? await res.json() : await res.arrayBuffer();
  return { status: res.status, data, headers: res.headers };
}

let seq = 0;
/** Creates a fresh user and returns { email, token } — keeps tests isolated. */
async function newUser() {
  const email = `user${++seq}-${Date.now()}@test.com`;
  const reg = await call("POST", "/auth/registro", {
    body: { nome: "Test", sobrenome: "Smith", email, senha: "password1", consentimento: true },
  });
  assert.equal(reg.status, 201);
  const { data } = await call("POST", "/auth/login", { body: { email, senha: "password1" } });
  return { email, token: data.token };
}

const validProfile = (extra = {}) => ({
  nome: "John",
  sobrenome: "Smith",
  data_nascimento: "1990-01-02",
  tipo_sanguineo: "A+",
  senha_publica: "4321",
  contatos_emergencia: [{ nome: "Ann", telefone: "(11) 99999-0000", parentesco: "Mother" }],
  alergias: [{ descricao: "Dipyrone", gravidade: "grave" }],
  medicamentos: [{ nome: "Losartan", dose: "50 mg", frequencia: "Once a day" }],
  doencas: [{ nome: "Asthma", desde: "" }],
  cirurgias: [],
  ...extra,
});

// ─── infrastructure ──────────────────────────────────────────────────────────

test("health and CORS (preflight with Authorization)", async () => {
  const health = await fetch(API.replace("/api/v1", "/health"));
  assert.deepEqual(await health.json(), { status: "ok", mock: true });

  const pre = await fetch(`${API}/perfil`, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Headers": "authorization,content-type" },
  });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), "*");
  assert.match(pre.headers.get("access-control-allow-headers"), /Authorization/);
});

test("unknown route → 404, wrong method → 405, invalid JSON → 400 (always with { erro })", async () => {
  const r404 = await call("GET", "/nothing");
  assert.equal(r404.status, 404);
  const r405 = await call("PUT", "/perfil");
  assert.equal(r405.status, 405);
  const r400 = await call("POST", "/auth/login", { raw: "{broken" });
  assert.equal(r400.status, 400);
  for (const r of [r404, r405, r400]) assert.equal(typeof r.data.erro, "string");
});

// ─── auth ────────────────────────────────────────────────────────────────────

test("register: validates fields, LGPD consent and duplicate email (case-insensitive)", async () => {
  const base = { nome: "A", sobrenome: "B", email: `dup${Date.now()}@x.com`, senha: "12345678", consentimento: true };

  assert.equal((await call("POST", "/auth/registro", { body: { ...base, consentimento: false } })).status, 400);
  assert.equal((await call("POST", "/auth/registro", { body: { ...base, senha: "short" } })).status, 400);
  assert.equal((await call("POST", "/auth/registro", { body: { ...base, email: "invalid" } })).status, 400);
  assert.equal((await call("POST", "/auth/registro", { body: { ...base, nome: "" } })).status, 400);

  const ok = await call("POST", "/auth/registro", { body: base });
  assert.equal(ok.status, 201);
  // lib/api.ts calls res.json() on non-204 responses — the body must be JSON
  assert.equal(typeof ok.data, "object");

  const dup = await call("POST", "/auth/registro", { body: { ...base, email: base.email.toUpperCase() } });
  assert.equal(dup.status, 409);
});

test("login: wrong credentials → 401; correct → token", async () => {
  const bad = await call("POST", "/auth/login", { body: { email: "demo@example.com", senha: "wrong" } });
  assert.equal(bad.status, 401);
  assert.equal(typeof bad.data.erro, "string");

  const ok = await call("POST", "/auth/login", { body: { email: "Demo@Example.com", senha: "demo1234" } });
  assert.equal(ok.status, 200);
  assert.equal(typeof ok.data.token, "string");
});

test("authenticated routes require a valid token → 401", async () => {
  for (const [m, p] of [["GET", "/perfil"], ["POST", "/perfil"], ["DELETE", "/perfil"], ["GET", "/perfil/qrcode"]]) {
    assert.equal((await call(m, p, { body: m === "POST" ? {} : undefined })).status, 401, `${m} ${p} without token`);
    assert.equal((await call(m, p, { token: "fake" })).status, 401, `${m} ${p} fake token`);
  }
});

// ─── profile ─────────────────────────────────────────────────────────────────

test("new user: GET /perfil and QR Code → 404 (dashboard treats it as 'no profile yet')", async () => {
  const { token } = await newUser();
  assert.equal((await call("GET", "/perfil", { token })).status, 404);
  assert.equal((await call("GET", "/perfil/qrcode", { token })).status, 404);
});

test("save profile: validation", async () => {
  const { token } = await newUser();
  const cases = {
    "no public password on first save": { senha_publica: "" },
    "public password too short": { senha_publica: "12" },
    "invalid blood type": { tipo_sanguineo: "Z+" },
    "invalid date": { data_nascimento: "02/01/1990" },
    "missing first name": { nome: "  " },
  };
  for (const [name, extra] of Object.entries(cases)) {
    const r = await call("POST", "/perfil", { token, body: validProfile(extra) });
    assert.equal(r.status, 400, name);
    assert.equal(typeof r.data.erro, "string", name);
  }
});

test("save profile: creates, never exposes senha_publica, keeps slug and password on edit", async () => {
  const { token } = await newUser();

  const created = await call("POST", "/perfil", { token, body: validProfile() });
  assert.equal(created.status, 200);
  assert.ok(created.data.slug);
  assert.ok(created.data.usuario_id);
  assert.equal("senha_publica" in created.data, false);
  assert.deepEqual(created.data.alergias, [{ descricao: "Dipyrone", gravidade: "grave" }]);

  // Editing with a blank password (as the form sends it) keeps the previous password and slug
  const edited = await call("POST", "/perfil", {
    token,
    body: validProfile({ senha_publica: "", tipo_sanguineo: "O-", alergias: [] }),
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.slug, created.data.slug);
  assert.equal(edited.data.tipo_sanguineo, "O-");
  assert.deepEqual(edited.data.alergias, []);

  const fetched = await call("GET", "/perfil", { token });
  assert.deepEqual(fetched.data, edited.data);

  const pub = await call("POST", `/publico/${created.data.slug}`, { body: { senha: "4321" } });
  assert.equal(pub.status, 200, "old password still works");
});

test("save profile: lists only accept the contract's fields", async () => {
  const { token } = await newUser();
  const r = await call("POST", "/perfil", {
    token,
    body: validProfile({ contatos_emergencia: [{ nome: "X", telefone: "1", parentesco: "Father", hack: true }, null] }),
  });
  assert.deepEqual(r.data.contatos_emergencia, [{ nome: "X", telefone: "1", parentesco: "Father" }]);
});

test("QR Code: real PNG whose content points to WEB_URL/public/<slug>", async () => {
  const { token } = await newUser();
  const { data: profile } = await call("POST", "/perfil", { token, body: validProfile() });

  const r = await call("GET", "/perfil/qrcode", { token });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/png");
  const png = Buffer.from(r.data);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // The QR content is generated by the `qrcode` lib; compare with the URL the mock should encode
  const QRCode = (await import("qrcode")).default;
  const expected = await QRCode.toBuffer(`${WEB_URL}/public/${profile.slug}`, {
    type: "png", width: 512, margin: 2, errorCorrectionLevel: "M",
  });
  assert.ok(png.equals(expected), "QR Code must encode WEB_URL/public/<slug>");
});

test("delete account: 204, invalidates token, removes login and public page", async () => {
  const { email, token } = await newUser();
  const { data: profile } = await call("POST", "/perfil", { token, body: validProfile() });

  const del = await call("DELETE", "/perfil", { token });
  assert.equal(del.status, 204);
  assert.equal((await call("GET", "/perfil", { token })).status, 401);
  assert.equal((await call("POST", "/auth/login", { body: { email, senha: "password1" } })).status, 401);
  assert.equal((await call("POST", `/publico/${profile.slug}`, { body: { senha: "4321" } })).status, 404);
});

// ─── public access ───────────────────────────────────────────────────────────

test("public: demo is accessible with password 1234 and doesn't expose senha_publica", async () => {
  const r = await call("POST", "/publico/demo", { body: { senha: "1234" } });
  assert.equal(r.status, 200);
  assert.equal(r.data.nome, "Demo");
  assert.equal("senha_publica" in r.data, false);
});

test("public: unknown slug → 404", async () => {
  assert.equal((await call("POST", "/publico/does-not-exist", { body: { senha: "1" } })).status, 404);
});

test("public: 4 failures → 401, 5th → 429 and locked even with the right password; other slugs unaffected", async () => {
  const { token } = await newUser();
  const { data: profile } = await call("POST", "/perfil", { token, body: validProfile() });
  const url = `/publico/${profile.slug}`;

  for (let i = 1; i <= 4; i++) assert.equal((await call("POST", url, { body: { senha: "0000" } })).status, 401, `failure ${i}`);
  assert.equal((await call("POST", url, { body: { senha: "0000" } })).status, 429);
  assert.equal((await call("POST", url, { body: { senha: "4321" } })).status, 429, "locked even with the right password");

  assert.equal((await call("POST", "/publico/demo", { body: { senha: "1234" } })).status, 200);
});

test("public: a correct password resets the failure counter", async () => {
  const { token } = await newUser();
  const { data: profile } = await call("POST", "/perfil", { token, body: validProfile() });
  const url = `/publico/${profile.slug}`;

  for (let i = 0; i < 4; i++) await call("POST", url, { body: { senha: "0000" } });
  assert.equal((await call("POST", url, { body: { senha: "4321" } })).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await call("POST", url, { body: { senha: "0000" } })).status, 401);
});

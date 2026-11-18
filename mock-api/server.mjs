// ─────────────────────────────────────────────────────────────────────────────
// VitalTag — API mock (replaces vitaltag-api during development)
//
// Plain Node HTTP server implementing the same contract used by lib/api.ts.
// NOTE: the routes and JSON field names (`nome`, `senha`, `erro`, ...) are Portuguese on
// purpose — they mirror the real vitaltag-api wire format and must not be translated.
//
// Data lives in memory: restarting the mock resets it to the initial state (with the
// demo user).
//
// Usage:  npm run mock            (mock only, at http://localhost:8080)
//         npm run dev:mock        (mock + next dev together)
//
// Optional environment variables:
//   MOCK_PORT   mock port                              (default 8080)
//   WEB_URL     frontend URL, used in the QR Code      (default http://localhost:3000)
//   MOCK_DELAY  artificial latency in ms               (default 0)
// ─────────────────────────────────────────────────────────────────────────────

import http from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import QRCode from "qrcode";

const PORT = Number(process.env.MOCK_PORT ?? 8080);
const WEB_URL = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
const DELAY = Number(process.env.MOCK_DELAY ?? 0);

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// ─── In-memory "database" ────────────────────────────────────────────────────
// Records are stored in the wire format, exactly as the real API would return them.

/** @type {Map<string, {id:string,nome:string,sobrenome:string,email:string,senha:string}>} */
const users = new Map(); // id → user
/** @type {Map<string, object>} */
const profiles = new Map(); // user id → profile (includes senha_publica)
/** @type {Map<string, string>} */
const tokens = new Map(); // token → user id
/** @type {Map<string, {failures:number, lockedUntil:number}>} */
const attempts = new Map(); // `${ip}|${slug}` → brute-force control

function seed() {
  const id = "00000000-0000-4000-8000-000000000001";
  users.set(id, {
    id,
    nome: "Demo",
    sobrenome: "User",
    email: "demo@example.com",
    senha: "demo1234",
  });
  profiles.set(id, {
    usuario_id: id,
    slug: "demo",
    senha_publica: "1234",
    nome: "Demo",
    sobrenome: "User",
    data_nascimento: "1988-04-12",
    tipo_sanguineo: "O-",
    contatos_emergencia: [
      { nome: "Contact One", telefone: "(00) 00000-0001", parentesco: "Spouse" },
      { nome: "Contact Two", telefone: "(00) 00000-0002", parentesco: "Sister" },
    ],
    // Severity values are stored in the API's format (leve/moderada/grave/fatal)
    alergias: [
      { descricao: "Penicillin", gravidade: "grave" },
      { descricao: "Shellfish", gravidade: "moderada" },
    ],
    medicamentos: [
      { nome: "Losartan", dose: "50 mg", frequencia: "Once a day" },
      { nome: "Metformin", dose: "850 mg", frequencia: "Twice a day" },
    ],
    doencas: [
      { nome: "Hypertension", desde: "2015-06-01" },
      { nome: "Type 2 diabetes", desde: "" },
    ],
    cirurgias: [{ procedimento: "Appendectomy", data: "2010-09-20" }],
  });
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "600",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, body) {
  res.writeHead(status, { ...CORS, "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function noContent(res) {
  res.writeHead(204, CORS);
  res.end();
}

async function readJSON(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new HttpError(413, "request body too large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    const body = JSON.parse(raw);
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, "invalid JSON");
  }
}

function authenticate(req) {
  const auth = req.headers.authorization ?? "";
  const [scheme, tok] = auth.split(" ");
  if (scheme !== "Bearer" || !tok) throw new HttpError(401, "missing token");
  const userId = tokens.get(tok);
  if (!userId || !users.has(userId)) throw new HttpError(401, "invalid or expired token");
  return userId;
}

const str = (v) => (typeof v === "string" ? v.trim() : "");
const list = (v, fields) =>
  Array.isArray(v)
    ? v
        .filter((i) => i && typeof i === "object")
        .map((i) => Object.fromEntries(fields.map((f) => [f, str(i[f])])))
    : [];

/** Strips the public password before returning a profile to the client. */
function withoutPassword(profile) {
  const { senha_publica, ...rest } = profile;
  return rest;
}

function newSlug() {
  let slug;
  do slug = randomBytes(6).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "x");
  while ([...profiles.values()].some((p) => p.slug === slug));
  return slug;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function register(req, res) {
  const b = await readJSON(req);
  const firstName = str(b.nome);
  const lastName = str(b.sobrenome);
  const email = str(b.email).toLowerCase();
  const password = typeof b.senha === "string" ? b.senha : "";

  if (!firstName || !lastName || !email || !password)
    throw new HttpError(400, "first name, last name, email and password are required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "invalid email");
  if (password.length < 8) throw new HttpError(400, "password must be at least 8 characters");
  if (b.consentimento !== true)
    throw new HttpError(400, "consent to the use of your data (LGPD) is required");
  if ([...users.values()].some((u) => u.email === email))
    throw new HttpError(409, "email already registered");

  const id = randomUUID();
  users.set(id, { id, nome: firstName, sobrenome: lastName, email, senha: password });
  json(res, 201, { id, mensagem: "account created successfully" });
}

async function login(req, res) {
  const b = await readJSON(req);
  const email = str(b.email).toLowerCase();
  const user = [...users.values()].find((u) => u.email === email);
  if (!user || user.senha !== b.senha) throw new HttpError(401, "incorrect email or password");

  const token = `mock.${randomBytes(24).toString("hex")}`;
  tokens.set(token, user.id);
  json(res, 200, { token });
}

function getProfile(req, res) {
  const uid = authenticate(req);
  const profile = profiles.get(uid);
  if (!profile) throw new HttpError(404, "profile not found");
  json(res, 200, withoutPassword(profile));
}

async function saveProfile(req, res) {
  const uid = authenticate(req);
  const b = await readJSON(req);
  const current = profiles.get(uid);

  const data = {
    nome: str(b.nome),
    sobrenome: str(b.sobrenome),
    data_nascimento: str(b.data_nascimento),
    tipo_sanguineo: str(b.tipo_sanguineo),
  };
  if (!data.nome || !data.sobrenome) throw new HttpError(400, "first name and last name are required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.data_nascimento))
    throw new HttpError(400, "invalid date of birth (use YYYY-MM-DD)");
  if (!BLOOD_TYPES.includes(data.tipo_sanguineo))
    throw new HttpError(400, "invalid blood type");

  const publicPassword = typeof b.senha_publica === "string" ? b.senha_publica : "";
  if (publicPassword && publicPassword.length < 4)
    throw new HttpError(400, "public password must be at least 4 characters");
  if (!publicPassword && !current)
    throw new HttpError(400, "set a public password when creating your profile");

  const profile = {
    usuario_id: uid,
    slug: current?.slug ?? newSlug(),
    senha_publica: publicPassword || current.senha_publica, // blank = keep the current one
    ...data,
    contatos_emergencia: list(b.contatos_emergencia, ["nome", "telefone", "parentesco"]),
    alergias: list(b.alergias, ["descricao", "gravidade"]),
    medicamentos: list(b.medicamentos, ["nome", "dose", "frequencia"]),
    doencas: list(b.doencas, ["nome", "desde"]),
    cirurgias: list(b.cirurgias, ["procedimento", "data"]),
  };
  profiles.set(uid, profile);
  json(res, 200, withoutPassword(profile));
}

function deleteAccount(req, res) {
  const uid = authenticate(req);
  profiles.delete(uid);
  users.delete(uid);
  for (const [tok, id] of tokens) if (id === uid) tokens.delete(tok);
  noContent(res);
}

async function qrcode(req, res) {
  const uid = authenticate(req);
  const profile = profiles.get(uid);
  if (!profile) throw new HttpError(404, "create your profile before generating a QR Code");

  const png = await QRCode.toBuffer(`${WEB_URL}/public/${profile.slug}`, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  res.writeHead(200, { ...CORS, "Content-Type": "image/png", "Content-Length": png.length });
  res.end(png);
}

async function publicAccess(req, res, slug) {
  const key = `${req.socket.remoteAddress}|${slug}`;
  const a = attempts.get(key);
  if (a && a.lockedUntil > Date.now())
    throw new HttpError(429, "too many incorrect attempts, try again later");

  const b = await readJSON(req);
  const profile = [...profiles.values()].find((p) => p.slug === slug);
  if (!profile) throw new HttpError(404, "profile not found");

  if (b.senha !== profile.senha_publica) {
    const lockoutExpired = a && a.lockedUntil > 0 && a.lockedUntil <= Date.now();
    const failures = (a && !lockoutExpired ? a.failures : 0) + 1;
    attempts.set(key, {
      failures,
      lockedUntil: failures >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
    });
    if (failures >= MAX_ATTEMPTS)
      throw new HttpError(429, "too many incorrect attempts, try again later");
    throw new HttpError(401, "incorrect password");
  }

  attempts.delete(key);
  json(res, 200, withoutPassword(profile));
}

// ─── Routing ─────────────────────────────────────────────────────────────────
// Paths mirror the real vitaltag-api (Portuguese on purpose).

const routes = [
  ["POST", /^\/api\/v1\/auth\/registro$/, register],
  ["POST", /^\/api\/v1\/auth\/login$/, login],
  ["GET", /^\/api\/v1\/perfil$/, getProfile],
  ["POST", /^\/api\/v1\/perfil$/, saveProfile],
  ["DELETE", /^\/api\/v1\/perfil$/, deleteAccount],
  ["GET", /^\/api\/v1\/perfil\/qrcode$/, qrcode],
  ["POST", /^\/api\/v1\/publico\/([^/]+)$/, publicAccess],
];

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const start = Date.now();
  res.on("finish", () =>
    console.log(`${req.method} ${pathname} → ${res.statusCode} (${Date.now() - start}ms)`)
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  try {
    if (DELAY > 0) await new Promise((r) => setTimeout(r, DELAY));

    if (req.method === "GET" && pathname === "/health") return json(res, 200, { status: "ok", mock: true });

    const candidates = routes.filter(([, re]) => re.test(pathname));
    if (candidates.length === 0) throw new HttpError(404, "route not found");
    const route = candidates.find(([m]) => m === req.method);
    if (!route) throw new HttpError(405, "method not allowed");

    const params = pathname.match(route[1]).slice(1).map(decodeURIComponent);
    await route[2](req, res, ...params);
  } catch (err) {
    if (err instanceof HttpError) return json(res, err.status, { erro: err.message });
    console.error(err);
    json(res, 500, { erro: "mock internal error" });
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n❌ Port ${PORT} is already in use (is vitaltag-api or another mock already running?).\n` +
        `   Stop the other process or use another port: MOCK_PORT=8081 npm run mock\n` +
        `   (remember to point NEXT_PUBLIC_API_URL to the new port; "npm run dev:mock" does this for you)\n`
    );
    process.exit(1);
  }
  throw err;
});

seed();
server.listen(PORT, () => {
  console.log(`\n🩺 VitalTag mock API running at http://localhost:${PORT}`);
  console.log(`   QR Codes point to ${WEB_URL}/public/<slug>`);
  console.log(`   Demo account:  demo@example.com / demo1234`);
  console.log(`   Demo public page: ${WEB_URL}/public/demo  (password 1234)\n`);
});

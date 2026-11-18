# VitalTag — Web

Frontend for **VitalTag**, a system for sharing clinical information during emergencies in the
workplace.

Project for the **Integrative Project Development course** (Disciplina Integradora de
Desenvolvimento de Projetos) — Systems Analysis and Development.

Backend: **vitaltag-api** (separate repository).

## Stack

- **Next.js 15** (App Router) — SSR on the public page, essential for fast loading on mobile
- **TypeScript** — API contracts checked at compile time
- **Tailwind CSS + shadcn/ui** — mobile-first, accessible interface (WCAG 2.1 AA)

## Structure

```
app/                       App Router routes
  auth/login/              sign in
  auth/register/           create account
  dashboard/               authenticated area: welcome, QR Code, profile summary
  profile/                 clinical profile form
  public/[slug]/           password-protected public page (opened via the QR Code)
components/                UI components
lib/api.ts                 API client — the only place that knows the API's wire format
types/                     domain types (English) used across the app
mock-api/                  API mock to run without the backend (see below)
```

`/publico/<slug>` (the public page's former URL) redirects to `/public/<slug>`, so QR Codes that
were already printed keep working.

### API contract language

The **vitaltag-api** uses Portuguese routes and JSON field names (e.g. `/api/v1/perfil`,
`nome`, `contatos_emergencia`, errors as `{ "erro": "..." }`). The frontend code is entirely in
English: `lib/api.ts` maps between the API's wire format and the English types in `types/`. If
the backend contract changes, only `lib/api.ts` (and the mock) need to be updated.

## How to run (Phase 2)

```bash
cp .env.local.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8080
npm install
npm run dev
```

## Running without the backend (API mock)

To develop or demo the frontend without **vitaltag-api**, use the mock in `mock-api/`.
It implements the same HTTP contract used by `lib/api.ts` (same routes, status codes and
`{ "erro": "..." }` error body), so no frontend code changes.

```bash
npm install
npm run dev:mock      # starts the mock (:8080) + next dev (:3000) together
```

Or in two terminals: `npm run mock` and `npm run dev`.

To check the mock (automated tests, no extra dependencies): `npm run test:mock`.

Preloaded demo data:

| What                   | Value                                   |
| ---------------------- | --------------------------------------- |
| Login                  | `demo@example.com` / `demo1234`        |
| Public page            | http://localhost:3000/public/demo       |
| Emergency password     | `1234`                                  |

Simulated behavior:

| Route                             | Mock                                                              |
| --------------------------------- | ----------------------------------------------------------------- |
| `POST /api/v1/auth/registro`      | 201; 400 (validation / no LGPD consent); 409 (email already exists) |
| `POST /api/v1/auth/login`         | `{ token }`; 401 on wrong credentials                             |
| `GET /api/v1/perfil`              | profile; 404 if not created yet; 401 without a valid token        |
| `POST /api/v1/perfil`             | create/update; blank `senha_publica` keeps the current one        |
| `DELETE /api/v1/perfil`           | 204; deletes the whole account (user, profile and tokens)         |
| `GET /api/v1/perfil/qrcode`       | real PNG pointing to `WEB_URL/public/<slug>`                      |
| `POST /api/v1/publico/:slug`      | profile; 401 wrong password; 404; **429 after 5 failures (15 min)** |

Optional variables: `MOCK_PORT` (default `8080`), `WEB_URL` (default `http://localhost:3000`,
used in the QR Code) and `MOCK_DELAY` (artificial latency in ms, useful to see loading states).

To scan the QR Code with a phone (on the same network), use the machine's IP in both URLs:

```bash
WEB_URL=http://192.168.0.10:3000 NEXT_PUBLIC_API_URL=http://192.168.0.10:8080 npm run dev:mock
```

> Data is kept **in memory**: restarting the mock resets it to the initial state. If the mock
> restarts while you're signed in, your token becomes invalid and the app redirects to login.

## Screens

The high-fidelity prototype of the six main screens (login, account creation, clinical form,
dashboard with QR Code, public page with password and public page with the data) is part of the
course's Phase 1 deliverable.

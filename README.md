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
app/                 App Router routes
  (auth)/            login and sign-up
  painel/            authenticated area: clinical form, QR Code, printable card
  p/[slug]/          password-protected public page
components/          UI components
lib/                 API client and utilities
```

## Running locally (Phase 2)

```bash
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8080
npm install
npm run dev
```

## Screens

The high-fidelity prototype of the six main screens (login, sign-up, clinical form, dashboard
with QR Code, password-protected public page, and public page with the data) is part of the
course's Phase 1 deliverable.

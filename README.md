# VitalTag — Web

Frontend do **VitalTag**, sistema para compartilhamento de informações clínicas em situações de
emergência no ambiente de trabalho.

Projeto da **Disciplina Integradora de Desenvolvimento de Projetos** — Análise e Desenvolvimento
de Sistemas.

Backend: **vitaltag-api** (repositório separado).

## Stack

- **Next.js 15** (App Router) — SSR na página pública, essencial para abertura rápida no celular
- **TypeScript** — contratos de API verificados em tempo de compilação
- **Tailwind CSS + shadcn/ui** — interface mobile-first e acessível (WCAG 2.1 AA)

## Estrutura

```
app/                 rotas do App Router
  (auth)/            login e criação de conta
  painel/            área autenticada: formulário clínico, QR Code, cartão de impressão
  p/[slug]/          página pública protegida por senha
components/          componentes de interface
lib/                 cliente da API e utilitários
```

## Como rodar (Fase 2)

```bash
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8080
npm install
npm run dev
```

## Telas

O protótipo de alta fidelidade das seis telas principais (login, criação de conta, formulário
clínico, painel com QR Code, página pública com senha e página pública com os dados) faz parte da
entrega da Fase 1 da disciplina.

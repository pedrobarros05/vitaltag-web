// Helpers shared by the E2E specs.
//
// The mock keeps its data in memory for the whole run and specs run in parallel, so any spec
// that writes data (or risks the public-page lockout) creates its own user through the API
// instead of touching the demo account. Those setup calls talk to the mock directly, so they
// use the API's wire format (Portuguese field names), exactly like mock-api/server.test.mjs.

import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { API_URL } from "./env";

export const DEMO = { email: "demo@example.com", password: "demo1234", slug: "demo", publicPassword: "1234" };

let seq = 0;
export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${process.pid}-${++seq}@example.com`;
}

/** Registers a new account directly on the mock. */
export async function createUser(request: APIRequestContext, firstName = "Maria") {
  const email = uniqueEmail();
  const password = "password1";
  const res = await request.post(`${API_URL}/api/v1/auth/registro`, {
    data: { nome: firstName, sobrenome: "Silva", email, senha: password, consentimento: true },
  });
  expect(res.status(), await res.text()).toBe(201);
  return { email, password };
}

/** Registers a new account with a saved profile; returns its public slug and password. */
export async function createUserWithProfile(request: APIRequestContext) {
  const user = await createUser(request);
  const login = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: user.email, senha: user.password },
  });
  const { token } = await login.json();
  const publicPassword = "4321";
  const res = await request.post(`${API_URL}/api/v1/perfil`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      nome: "Maria",
      sobrenome: "Silva",
      data_nascimento: "1990-01-02",
      tipo_sanguineo: "AB+",
      senha_publica: publicPassword,
      contatos_emergencia: [],
      alergias: [{ descricao: "Dipyrone", gravidade: "grave" }],
      medicamentos: [],
      doencas: [],
      cirurgias: [],
    },
  });
  expect(res.status(), await res.text()).toBe(200);
  const { slug } = await res.json();
  return { ...user, slug: slug as string, publicPassword };
}

/** Signs in through the login screen and waits for the dashboard. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** A card of the profile form, by its heading. */
export function section(page: Page, title: string) {
  return page.locator("div.card", { has: page.getByRole("heading", { name: title, exact: true }) });
}

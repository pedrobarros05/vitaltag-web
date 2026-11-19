# Testing

| Command              | What it runs                                                          | Time   |
| -------------------- | --------------------------------------------------------------------- | ------ |
| `npm test`           | Vitest: `lib/api.ts` mapping + UI components (+ contract test vs mock) | ~10 s  |
| `npm run test:watch` | Vitest in watch mode                                                  |        |
| `npx playwright test`<br>(`npm run test:e2e`) | Playwright E2E: the six screens in Chromium, against the API mock | ~45 s |
| `npm run test:mock`  | The mock's own tests (`node --test`)                                  | ~1 s   |
| `npm run test:all`   | All of the above                                                      |        |
| `npm run lint`       | ESLint (`next/core-web-vitals` + `next/typescript`) on app, tests and mock |  |
| `npm run typecheck`  | `tsc --noEmit` (app and tests)                                        |        |

No backend is needed for any of them: they use `mock-api/server.mjs` (or a stubbed `fetch`).

```
tests/
  unit/                        Vitest (jsdom)
    api.test.ts                lib/api.ts: English ⇄ Portuguese mapping, routes, headers, errors
    api-contract.test.ts       real lib/api.ts against the real mock over HTTP
    auth-pages.test.tsx        login + registration screens
    profile-page.test.tsx      clinical profile form
    dashboard-page.test.tsx    dashboard + QR Code
    public-page.test.tsx       password-protected public page
    fixtures.ts                the same profile in wire format and in English
    support/                   next/navigation stand-in, form helpers
  e2e/                         Playwright
    login / register / profile / qrcode / public-page / publico-redirect .spec.ts
```

## Unit and component tests (Vitest)

**`lib/api.ts`** is the only code that knows the API speaks Portuguese, so it has the densest
tests. `fetch` is stubbed and every call checks the exact URL, method, `Authorization` header,
and JSON body sent. It also checks what comes back:

- Both directions of the mapping are compared with `toStrictEqual`. A leaked Portuguese key
  (`nome`) or a missing English one (`firstName`) fails the test.
- Allergy severities: `leve/moderada/grave/fatal` ⇄ `mild/moderate/severe/fatal`. Unknown values
  pass through unchanged, and `null` lists become `[]`.
- Errors: `{ "erro": "..." }` becomes `ApiError(message, status)`. A body that isn't JSON falls
  back to `HTTP <status>`. Network errors are not disguised as `ApiError`.

`fixtures.ts` holds the same profile twice, as wire JSON and as English types, **both written by
hand**. If one were derived from the other with the code under test, a mapping bug would show up
on both sides and the test would still pass.

**`api-contract.test.ts`** starts the real mock on a free port and runs `lib/api.ts` against it
(register → login → profile → public access → QR → delete). It catches the frontend and the mock
drifting apart. It also reads the stored record in wire format, because a round trip alone
would hide a bug that is the same in both directions, such as severities never being translated.

**Component tests** render the real pages with Testing Library and `user-event`. `next/navigation`
and the network functions of `@/lib/api` are mocked; the real `ApiError` is kept. Things to
know when writing new ones:

- Find fields the way assistive technology does: `screen.getByLabelText("First name")`, or
  `within(section("Allergies")).getByLabelText("Severity")` for list items. Each page also has a
  test asserting that **every** input/select has an accessible name, so a new field without a
  label fails `npm test`. In the profile form, wrap controls in `<Field label=… hint=…>`: it
  links the label (`htmlFor`/`useId`) and the hint (`aria-describedby`) for you.
- `app/public/[slug]/page.tsx` receives `params` as a Promise and unwraps it with React's
  `use()`. Pass `resolvedParams("slug")` from `public-page.test.tsx`: a promise already marked
  as fulfilled, so `use()` returns synchronously and no Suspense boundary is needed.
- The installed React (`~19.0`) matches the React 19.0 that Next 15 bundles for the App Router,
  so component tests run on the same React major/minor as the real app.

## E2E tests (Playwright)

`playwright.config.ts` starts two servers and stops them at the end:

1. **API mock** on `:8090`, with fresh in-memory data for every run. `WEB_URL` is set so the
   QR Code points at the test app.
2. **Next.js production build** on `:3100`, built with `NEXT_PUBLIC_API_URL=http://localhost:8090`
   into `.next-e2e/` (see `distDir` in `next.config.ts`). It never touches the `.next/` of a
   `next dev` you have running, and the ports don't clash with `npm run dev:mock`
   (`:3000`/`:8080`). To change the ports, set `E2E_WEB_PORT` / `E2E_API_PORT`.

| Screen                  | Spec                        | Checks                                                                     |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------- |
| Login                   | `login.spec.ts`             | demo sign-in, case-insensitive email, wrong password, signed-out redirect |
| Registration            | `register.spec.ts`          | create → "account created" banner → sign in; LGPD consent; duplicate email |
| Profile saving          | `profile.spec.ts`           | fill + save; **request body is Portuguese** (`gravidade: "grave"`); reload persists |
| QR Code                 | `qrcode.spec.ts`            | displayed PNG is byte-identical to the QR for `<WEB_URL>/public/demo`; download |
| Public page (password)  | `public-page.spec.ts`       | nothing shown before the password; 401/404; data shown in English; lockout (429) |
| `/publico` → `/public`  | `publico-redirect.spec.ts`  | old QR URL opens the page; it's a 307 that keeps the slug                  |

**Data isolation.** Specs run in parallel against one mock, so the **demo account is
read-only**. A spec that writes data or types wrong public passwords (5 failures lock a slug
for 15 min) creates its own user with `createUser` / `createUserWithProfile` from
`tests/e2e/support.ts`. Those helpers call the mock directly, in its Portuguese wire format.

**Console guard.** Specs import `test`/`expect` from `tests/e2e/fixtures.ts`, not from
`@playwright/test`. That version fails any test in which the browser logs an error or throws:
React hydration mismatches, uncaught exceptions, a missing JS chunk. These bugs often leave the
page looking fine, so no regular assertion would catch them. The only errors allowed are
Chromium's "Failed to load resource" lines for **API mock** responses the specs trigger on
purpose (401 for a wrong password, 404 for a new user's profile, …).

**Debugging:** `npx playwright test --ui`, `npx playwright test --headed`, or open the trace that
a failed test leaves in `test-results/` with `npx playwright show-trace <path>/trace.zip`.

**Browser.** `@playwright/test` is pinned to **1.58.2**, which uses Chromium revision 1208. If
that browser isn't installed on your machine yet, run `npx playwright install chromium`. If you
upgrade Playwright, install the matching browser again.

## CI

`.github/workflows/web-tests.yml` (at the repository root) runs on every push or pull request:
`npm ci` → lint → type-check → mock tests → Vitest → Playwright. With
`CI` set, Playwright also forbids `test.only`, retries a failed test once, and writes an HTML
report. If the job fails, `playwright-report/` and `test-results/` (screenshots and traces) are
uploaded as an artifact. `npm ci` needs `package-lock.json` to be committed.

## Make a test fail on purpose

A test suite is only worth something if it fails when the code breaks. Two quick ways to see it
happen:

### Example 1 — Vitest catches a broken mapping

In `lib/api.ts`, inside `toWireProfile`, "forget" to translate the allergy severity:

```diff
     alergias: p.allergies.map((a) => ({
       descricao: a.description,
-      gravidade: SEVERITY_TO_WIRE[a.severity] ?? a.severity,
+      gravidade: a.severity,
     })),
```

Run `npm test`. It exits with code 1:

```
 ❯ tests/unit/api-contract.test.ts (3 tests | 1 failed)
     × full lifecycle: register → login → create profile → public access → QR → delete
 ❯ tests/unit/api.test.ts (27 tests | 2 failed)
     × POSTs the exact Portuguese wire body (including senha_publica)
     × translates severities mild/moderate/severe/fatal → leve/moderada/grave/fatal

 FAIL  tests/unit/api.test.ts > saveProfile > POSTs the exact Portuguese wire body (including senha_publica)
AssertionError: expected { nome: 'Maria', …(9) } to strictly equal { nome: 'Maria', …(9) }

- Expected
+ Received

    "alergias": [
      {
        "descricao": "Penicillin",
-       "gravidade": "leve",
+       "gravidade": "mild",
      },
  ...
      Tests  3 failed | 72 passed (75)
```

The app itself would look fine here: the mock echoes whatever it receives. The real backend,
though, would get `"mild"` where it expects `"leve"`.

### Example 2 — Playwright catches a broken redirect

In `next.config.ts`, break the redirect that keeps printed QR Codes working:

```diff
-        source: "/publico/:slug",
+        source: "/publico-disabled/:slug",
```

Run `npx playwright test`. It exits with code 1:

```
  ✘ publico-redirect.spec.ts › /publico → /public redirect › the old URL opens the public page
  ✘ publico-redirect.spec.ts › /publico → /public redirect › is a temporary (307) redirect that keeps the slug

    Error: expect(page).toHaveURL(expected) failed
    Expected pattern: /\/public\/demo$/
    Received string:  "http://localhost:3100/publico/demo"

    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 307
    Received: 404
```

Undo the edit and both suites are green again.
Other bugs that were introduced the same way and caught: severity typo (`moderado`), the
`{ erro }` message ignored, `/publico/` renamed to `/public/` in the API call, `null` lists not
handled, bearer token not sent, login not storing the token, LGPD consent not enforced, public
password pre-filled in the form, 404 on the dashboard shown as an error, missing lockout message,
unsanitised `tel:` link, a form field whose label isn't linked to it, severities not
translated back from the API (caught by E2E), and a server/browser hydration mismatch on the
login page (caught by the E2E console guard).

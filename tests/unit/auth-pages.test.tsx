import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/auth/login/page";
import RegisterPage from "@/app/auth/register/page";
import { ApiError, login, register } from "@/lib/api";
import { router, setSearchParams } from "./support/next-navigation";

vi.mock("next/navigation", () => import("./support/next-navigation"));
// Keep the real ApiError (the pages use instanceof), stub the network calls
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  login: vi.fn(),
  register: vi.fn(),
}));

beforeEach(() => setSearchParams(""));

/** Every input/select on screen must have an accessible name (what a screen reader announces). */
function expectAllControlsNamed() {
  const controls = document.querySelectorAll("input, select, textarea");
  expect(controls.length).toBeGreaterThan(0);
  controls.forEach((el) => expect(el).toHaveAccessibleName());
}

/** A promise the test resolves by hand, to observe loading states. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

// ─── Login ───────────────────────────────────────────────────────────────────

describe("LoginPage", () => {
  async function fillAndSubmit(email = "demo@example.com", password = "demo1234") {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), email);
    await user.type(screen.getByLabelText("Password"), password);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
  }

  it("signs in: calls the API, stores the token and goes to the dashboard", async () => {
    vi.mocked(login).mockResolvedValue({ token: "tok-123" });
    render(<LoginPage />);

    await fillAndSubmit();

    expect(login).toHaveBeenCalledWith({ email: "demo@example.com", password: "demo1234" });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard"));
    expect(localStorage.getItem("vitaltag_token")).toBe("tok-123");
  });

  it("shows the API's error message and stays on the page", async () => {
    vi.mocked(login).mockRejectedValue(new ApiError("incorrect email or password", 401));
    render(<LoginPage />);

    await fillAndSubmit("demo@example.com", "wrong");

    expect(await screen.findByText("incorrect email or password")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(localStorage.getItem("vitaltag_token")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("shows a generic message on network errors", async () => {
    vi.mocked(login).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginPage />);
    await fillAndSubmit();
    expect(await screen.findByText("Error signing in.")).toBeInTheDocument();
  });

  it("clears the error as soon as the user edits a field", async () => {
    vi.mocked(login).mockRejectedValue(new ApiError("incorrect email or password", 401));
    render(<LoginPage />);
    await fillAndSubmit();
    await screen.findByText("incorrect email or password");

    await userEvent.type(screen.getByLabelText("Password"), "x");

    expect(screen.queryByText("incorrect email or password")).not.toBeInTheDocument();
  });

  it("disables the button while signing in", async () => {
    const pending = deferred<{ token: string }>();
    vi.mocked(login).mockReturnValue(pending.promise);
    render(<LoginPage />);

    await fillAndSubmit();

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    pending.resolve({ token: "t" });
    await waitFor(() => expect(router.push).toHaveBeenCalled());
  });

  it("shows the 'account created' banner after registration (?registered=1)", async () => {
    setSearchParams("registered=1");
    render(<LoginPage />);
    expect(
      await screen.findByText("Account created successfully! Please sign in.")
    ).toBeInTheDocument();
  });

  it("has no banner on a plain visit and links to registration", () => {
    render(<LoginPage />);
    expect(screen.queryByText(/Account created successfully/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a free account" })).toHaveAttribute(
      "href",
      "/auth/register"
    );
  });

  it("labels every field for assistive technology", () => {
    render(<LoginPage />);
    expectAllControlsNamed();
  });
});

// ─── Register ────────────────────────────────────────────────────────────────

describe("RegisterPage", () => {
  async function fillForm() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("First name"), "Maria");
    await user.type(screen.getByLabelText("Last name"), "Silva");
    await user.type(screen.getByLabelText("Email"), "maria@example.com");
    await user.type(screen.getByLabelText("Password"), "password1");
    return user;
  }

  it("requires LGPD consent before calling the API", async () => {
    render(<RegisterPage />);
    const user = await fillForm();

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("You must consent to the use of your data.")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("creates the account and redirects to login with ?registered=1", async () => {
    vi.mocked(register).mockResolvedValue(undefined);
    render(<RegisterPage />);
    const user = await fillForm();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(register).toHaveBeenCalledWith({
      firstName: "Maria",
      lastName: "Silva",
      email: "maria@example.com",
      password: "password1",
      consent: true,
    });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/auth/login?registered=1"));
  });

  it("shows the API's error (e.g. 409 email already registered)", async () => {
    vi.mocked(register).mockRejectedValue(new ApiError("email already registered", 409));
    render(<RegisterPage />);
    const user = await fillForm();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("email already registered")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("asks for a password of at least 8 characters", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("minLength", "8");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("labels every field for assistive technology", () => {
    render(<RegisterPage />);
    expectAllControlsNamed();
    expect(screen.getByRole("checkbox", { name: /I consent to the storage/ })).toBeInTheDocument();
  });
});

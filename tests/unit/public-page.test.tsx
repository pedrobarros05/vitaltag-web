import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PublicPage from "@/app/public/[slug]/page";
import { ApiError, accessPublicProfile } from "@/lib/api";
import type { Profile } from "@/types";
import { PROFILE } from "./fixtures";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  accessPublicProfile: vi.fn(),
}));

/**
 * The page unwraps `params` with React's `use()`. Marking the promise as already fulfilled (the
 * way React tracks settled thenables) lets `use()` return synchronously, so the page renders
 * without a Suspense boundary — like Next does once the params are known.
 */
function resolvedParams(slug: string) {
  const value = { slug };
  return Object.assign(Promise.resolve(value), { status: "fulfilled", value });
}

async function unlock(password = "4321", slug = "abc123") {
  render(<PublicPage params={resolvedParams(slug)} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Emergency password"), password);
  await user.click(screen.getByRole("button", { name: "Access data" }));
  return user;
}

describe("PublicPage — password screen", () => {
  it("asks for the emergency password before showing anything", () => {
    render(<PublicPage params={resolvedParams("abc123")} />);

    expect(screen.getByRole("heading", { name: "Emergency Data" })).toBeInTheDocument();
    expect(screen.getByLabelText("Emergency password")).toHaveAttribute("type", "password");
    expect(screen.queryByText("Maria Silva")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "192 (SAMU)" })).toHaveAttribute("href", "tel:192");
    expect(accessPublicProfile).not.toHaveBeenCalled();
  });

  it("labels the password field for assistive technology", () => {
    render(<PublicPage params={resolvedParams("abc123")} />);
    // (password inputs have no ARIA role, so check the name on the element itself)
    expect(document.querySelector('input[type="password"]')).toHaveAccessibleName("Emergency password");
  });

  it("sends the slug from the URL and the typed password", async () => {
    vi.mocked(accessPublicProfile).mockResolvedValue(PROFILE);
    await unlock("4321", "abc123");
    expect(accessPublicProfile).toHaveBeenCalledWith("abc123", { password: "4321" });
  });

  it.each([
    [401, "Incorrect password. Please try again."],
    [404, "Profile not found."],
    [429, "⛔ Too many incorrect attempts. Try again in 15 minutes."],
    [500, "Error accessing profile."],
  ])("HTTP %i → %s", async (status, message) => {
    vi.mocked(accessPublicProfile).mockRejectedValue(new ApiError("api message", status));
    await unlock("0000");

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText("Maria Silva")).not.toBeInTheDocument();
  });

  it("shows 'Network error.' when the API is unreachable", async () => {
    vi.mocked(accessPublicProfile).mockRejectedValue(new TypeError("Failed to fetch"));
    await unlock();
    expect(await screen.findByText("Network error.")).toBeInTheDocument();
  });

  it("clears the error when the password is edited", async () => {
    vi.mocked(accessPublicProfile).mockRejectedValue(new ApiError("incorrect password", 401));
    const user = await unlock("0000");
    await screen.findByText("Incorrect password. Please try again.");

    await user.type(screen.getByLabelText("Emergency password"), "1");

    expect(screen.queryByText("Incorrect password. Please try again.")).not.toBeInTheDocument();
  });
});

describe("PublicPage — clinical data", () => {
  it("shows identification, blood type and day-first dates", async () => {
    vi.mocked(accessPublicProfile).mockResolvedValue(PROFILE);
    await unlock();

    expect(await screen.findByRole("heading", { name: "Maria Silva" })).toBeInTheDocument();
    expect(screen.getByText("🚨 MEDICAL EMERGENCY DATA")).toBeInTheDocument();
    expect(screen.getByText("02/01/1990")).toBeInTheDocument(); // 1990-01-02, DD/MM/YYYY
    expect(screen.getByText("AB+")).toBeInTheDocument();
  });

  it("lists allergies with their (English) severity", async () => {
    vi.mocked(accessPublicProfile).mockResolvedValue(PROFILE);
    await unlock();

    const card = (await screen.findByRole("heading", { name: "⚠️ Allergies" })).parentElement!;
    for (const [allergy, severity] of [
      ["Penicillin", "mild"],
      ["Dipyrone", "moderate"],
      ["Shellfish", "severe"],
      ["Bee sting", "fatal"],
    ]) {
      const row = within(card).getByText(allergy).parentElement!;
      expect(within(row).getByText(severity)).toBeInTheDocument();
    }
  });

  it("shows medications, conditions and surgeries", async () => {
    vi.mocked(accessPublicProfile).mockResolvedValue(PROFILE);
    await unlock();

    expect(await screen.findByText("Losartan")).toBeInTheDocument();
    expect(screen.getByText("50 mg — Once a day")).toBeInTheDocument();
    expect(screen.getByText(/Hypertension/)).toHaveTextContent("Hypertension since 01/06/2015");
    expect(screen.getByText(/Appendectomy/)).toHaveTextContent("Appendectomy (20/09/2010)");
  });

  it("makes emergency contacts callable (tel: link with digits only)", async () => {
    vi.mocked(accessPublicProfile).mockResolvedValue(PROFILE);
    await unlock();

    const call = await screen.findByRole("link", { name: /\(11\) 98765-4321/ });
    expect(call).toHaveAttribute("href", "tel:11987654321");
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText("Spouse")).toBeInTheDocument();
  });

  it("hides sections that have no data", async () => {
    const minimal: Profile = {
      ...PROFILE,
      emergencyContacts: [],
      allergies: [],
      medications: [],
      conditions: [],
      surgeries: [],
    };
    vi.mocked(accessPublicProfile).mockResolvedValue(minimal);
    await unlock();

    await screen.findByRole("heading", { name: "Maria Silva" });
    for (const heading of [
      "⚠️ Allergies",
      "💊 Current medications",
      "🏥 Health conditions",
      "🔪 Previous surgeries",
      "📞 Emergency contacts",
    ]) {
      expect(screen.queryByRole("heading", { name: heading })).not.toBeInTheDocument();
    }
  });
});

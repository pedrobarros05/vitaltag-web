import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/dashboard/page";
import { ApiError, getProfile, getQRCode } from "@/lib/api";
import { PROFILE } from "./fixtures";
import { router } from "./support/next-navigation";

vi.mock("next/navigation", () => import("./support/next-navigation"));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getProfile: vi.fn(),
  getQRCode: vi.fn(),
}));

// jsdom has no URL.createObjectURL
const createObjectURL = vi.fn(() => "blob:vitaltag-qr");
beforeEach(() => {
  createObjectURL.mockImplementation(() => "blob:vitaltag-qr");
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
});
afterEach(() => {
  delete (URL as { createObjectURL?: unknown }).createObjectURL;
});

describe("DashboardPage", () => {
  it("greets a user with a profile and shows the summary", async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE);
    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: "Hi, Maria! 👋" })).toBeInTheDocument();
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("AB+")).toBeInTheDocument();
    expect(screen.getByText("4 registered")).toBeInTheDocument(); // allergies
    expect(screen.getAllByText("1 registered")).toHaveLength(2); // medications, contacts
    expect(screen.getByRole("link", { name: "Edit profile" })).toHaveAttribute("href", "/profile");
  });

  it("invites a new user (404) to set up the profile, without a QR button", async () => {
    vi.mocked(getProfile).mockRejectedValue(new ApiError("profile not found", 404));
    render(<DashboardPage />);

    expect(await screen.findByRole("heading", { name: "Welcome to VitalTag! 👋" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up profile" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("button", { name: "Generate QR Code" })).not.toBeInTheDocument();
    expect(screen.queryByText("Error loading profile.")).not.toBeInTheDocument();
  });

  it("redirects to login on 401", async () => {
    vi.mocked(getProfile).mockRejectedValue(new ApiError("invalid or expired token", 401));
    render(<DashboardPage />);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/auth/login"));
  });

  it("shows an error for other failures", async () => {
    vi.mocked(getProfile).mockRejectedValue(new ApiError("mock internal error", 500));
    render(<DashboardPage />);
    expect(await screen.findByText("Error loading profile.")).toBeInTheDocument();
  });

  it("generates the QR Code and offers it as a PNG download", async () => {
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
    vi.mocked(getProfile).mockResolvedValue(PROFILE);
    vi.mocked(getQRCode).mockResolvedValue(png);
    render(<DashboardPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Generate QR Code" }));

    const img = await screen.findByRole("img", { name: "Emergency QR Code" });
    expect(createObjectURL).toHaveBeenCalledWith(png);
    expect(img).toHaveAttribute("src", "blob:vitaltag-qr");
    const download = screen.getByRole("link", { name: "Download PNG" });
    expect(download).toHaveAttribute("href", "blob:vitaltag-qr");
    expect(download).toHaveAttribute("download", "vitaltag-qrcode.png");
  });

  it("shows an error if the QR Code can't be generated", async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE);
    vi.mocked(getQRCode).mockRejectedValue(new ApiError("boom", 500));
    render(<DashboardPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Generate QR Code" }));

    expect(await screen.findByText("Error generating QR Code.")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Emergency QR Code" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate QR Code" })).toBeEnabled();
  });

  it("signs out: removes the token and goes to login", async () => {
    localStorage.setItem("vitaltag_token", "tok-abc");
    vi.mocked(getProfile).mockResolvedValue(PROFILE);
    render(<DashboardPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(localStorage.getItem("vitaltag_token")).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/auth/login");
  });
});

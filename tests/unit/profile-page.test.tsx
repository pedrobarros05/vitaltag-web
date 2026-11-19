import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProfilePage from "@/app/profile/page";
import { ApiError, deleteProfile, getProfile, saveProfile } from "@/lib/api";
import type { ProfileRequest } from "@/types";
import { PROFILE, PROFILE_REQUEST } from "./fixtures";
import { section } from "./support/dom";
import { router } from "./support/next-navigation";

vi.mock("next/navigation", () => import("./support/next-navigation"));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
  deleteProfile: vi.fn(),
}));

/** Renders the page and waits for the initial getProfile() to settle. */
async function renderLoaded() {
  render(<ProfilePage />);
  await screen.findByRole("heading", { name: "Clinical Profile" });
}

function lastSaved(): ProfileRequest {
  expect(saveProfile).toHaveBeenCalledTimes(1);
  return vi.mocked(saveProfile).mock.calls[0][0];
}

/** Every input/select on screen must have an accessible name (what a screen reader announces). */
function expectAllControlsNamed() {
  const controls = document.querySelectorAll("input, select, textarea");
  expect(controls.length).toBeGreaterThan(0);
  controls.forEach((el) => expect(el).toHaveAccessibleName());
}

describe("ProfilePage — loading", () => {
  it("fills the form with the existing profile (public password left blank)", async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE);
    await renderLoaded();

    expect(screen.getByLabelText("First name")).toHaveValue("Maria");
    expect(screen.getByLabelText("Last name")).toHaveValue("Silva");
    expect(screen.getByLabelText("Date of birth")).toHaveValue("1990-01-02");
    expect(screen.getByLabelText("Blood type")).toHaveValue("AB+");
    expect(screen.getByLabelText("Public password (for emergency access)")).toHaveValue("");

    const allergies = section("Allergies");
    const severities = within(allergies)
      .getAllByRole("combobox")
      .map((s) => (s as HTMLSelectElement).value);
    expect(severities).toEqual(["mild", "moderate", "severe", "fatal"]);
    expect(within(section("Emergency Contacts")).getByDisplayValue("(11) 98765-4321")).toBeInTheDocument();
  });

  it("shows an empty form when there is no profile yet (404)", async () => {
    vi.mocked(getProfile).mockRejectedValue(new ApiError("profile not found", 404));
    await renderLoaded();

    expect(screen.getByLabelText("First name")).toHaveValue("");
    expect(screen.getByText("No contacts added.")).toBeInTheDocument();
    expect(screen.getByText("No allergies added.")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("labels every field (including list items) and describes the public password", async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE);
    await renderLoaded();

    expectAllControlsNamed();
    expect(screen.getByLabelText("Public password (for emergency access)")).toHaveAccessibleDescription(
      "At least 4 characters. Don't reuse your account password."
    );
  });

  it("redirects to login when the session is invalid (401)", async () => {
    vi.mocked(getProfile).mockRejectedValue(new ApiError("invalid or expired token", 401));
    render(<ProfilePage />);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/auth/login"));
  });
});

describe("ProfilePage — saving", () => {
  it("submits the loaded profile unchanged (English ProfileRequest)", async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE);
    vi.mocked(saveProfile).mockResolvedValue(PROFILE);
    await renderLoaded();

    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(lastSaved()).toStrictEqual({ ...PROFILE_REQUEST, publicPassword: "" });
    expect(await screen.findByText(/Profile saved successfully!/)).toBeInTheDocument();
  });

  it("creates a profile from scratch with list items added via '+ Add'", async () => {
    vi.mocked(getProfile).mockRejectedValue(new ApiError("profile not found", 404));
    vi.mocked(saveProfile).mockResolvedValue(PROFILE);
    await renderLoaded();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("First name"), "Maria");
    await user.type(screen.getByLabelText("Last name"), "Silva");
    await user.type(screen.getByLabelText("Date of birth"), "1990-01-02");
    await user.selectOptions(screen.getByLabelText("Blood type"), "AB+");
    await user.type(screen.getByLabelText("Public password (for emergency access)"), "4321");

    const contacts = section("Emergency Contacts");
    await user.click(within(contacts).getByRole("button", { name: "+ Add" }));
    await user.type(within(contacts).getByLabelText("Name"), "João");
    await user.type(within(contacts).getByLabelText("Phone"), "11 99999-0000");
    await user.type(within(contacts).getByLabelText("Relationship"), "Spouse");

    const allergies = section("Allergies");
    await user.click(within(allergies).getByRole("button", { name: "+ Add" }));
    await user.type(within(allergies).getByLabelText("Description"), "Dipyrone");
    await user.selectOptions(within(allergies).getByLabelText("Severity"), "severe");

    const meds = section("Current Medications");
    await user.click(within(meds).getByRole("button", { name: "+ Add" }));
    await user.type(within(meds).getByLabelText("Medication"), "Losartan");
    await user.type(within(meds).getByLabelText("Dose"), "50 mg");
    await user.type(within(meds).getByLabelText("Frequency"), "Once a day");

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(lastSaved()).toStrictEqual({
      firstName: "Maria",
      lastName: "Silva",
      birthDate: "1990-01-02",
      bloodType: "AB+",
      publicPassword: "4321",
      emergencyContacts: [{ name: "João", phone: "11 99999-0000", relationship: "Spouse" }],
      allergies: [{ description: "Dipyrone", severity: "severe" }],
      medications: [{ name: "Losartan", dose: "50 mg", frequency: "Once a day" }],
      conditions: [],
      surgeries: [],
    });
  });

  it("new allergies default to 'mild' and offer exactly the four severities", async () => {
    vi.mocked(getProfile).mockRejectedValue(new ApiError("profile not found", 404));
    await renderLoaded();
    const allergies = section("Allergies");

    await userEvent.click(within(allergies).getByRole("button", { name: "+ Add" }));

    const select = within(allergies).getByLabelText<HTMLSelectElement>("Severity");
    expect(select).toHaveValue("mild");
    expect([...select.options].map((o) => o.value)).toEqual(["mild", "moderate", "severe", "fatal"]);
  });

  it("removing a list item drops it from the saved profile", async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE);
    vi.mocked(saveProfile).mockResolvedValue(PROFILE);
    await renderLoaded();

    // Remove the 2nd allergy ("Dipyrone")
    const allergies = section("Allergies");
    await userEvent.click(within(allergies).getAllByRole("button", { name: "Remove" })[1]);
    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(lastSaved().allergies.map((a) => a.description)).toEqual([
      "Penicillin",
      "Shellfish",
      "Bee sting",
    ]);
  });

  it("shows the API's validation error", async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE);
    vi.mocked(saveProfile).mockRejectedValue(new ApiError("invalid blood type", 400));
    await renderLoaded();

    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText("invalid blood type")).toBeInTheDocument();
    expect(screen.queryByText(/Profile saved successfully/)).not.toBeInTheDocument();
  });
});

describe("ProfilePage — deleting the account", () => {
  it("does nothing if the user cancels the confirmation", async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await renderLoaded();

    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));

    expect(deleteProfile).not.toHaveBeenCalled();
  });

  it("deletes, signs out and goes to registration after confirming", async () => {
    localStorage.setItem("vitaltag_token", "tok-abc");
    vi.mocked(getProfile).mockResolvedValue(PROFILE);
    vi.mocked(deleteProfile).mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderLoaded();

    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));

    expect(deleteProfile).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/auth/register"));
    expect(localStorage.getItem("vitaltag_token")).toBeNull();
  });
});

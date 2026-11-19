import { screen } from "@testing-library/react";

/** The profile form card whose heading is `title` (e.g. "Allergies"). */
export function section(title: string): HTMLElement {
  const card = screen.getByRole("heading", { name: title }).closest<HTMLElement>("div.card");
  if (!card) throw new Error(`no section "${title}"`);
  return card;
}

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  // jsdom is shared by all tests in a file: don't leak the auth token between them
  if (typeof localStorage !== "undefined") localStorage.clear();
});

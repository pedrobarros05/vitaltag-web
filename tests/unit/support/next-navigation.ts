// Stand-in for "next/navigation" in component tests (there is no Next router under Vitest).
// Use it with:  vi.mock("next/navigation", () => import("./support/next-navigation"));
import { vi } from "vitest";

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

let searchParams = new URLSearchParams();

/** Sets what useSearchParams() returns for the next render, e.g. setSearchParams("registered=1"). */
export function setSearchParams(query: string) {
  searchParams = new URLSearchParams(query);
}

export const useRouter = () => router;
export const useSearchParams = () => searchParams;
export const usePathname = () => "/";

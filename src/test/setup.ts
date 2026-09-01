import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

Object.defineProperty(Element.prototype, "scrollIntoView", {
  value: () => undefined,
  writable: true,
});

Object.defineProperty(window, "scrollTo", {
  value: () => undefined,
  writable: true,
});

Object.defineProperty(window, "matchMedia", {
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
  writable: true,
});

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: () => null,
  writable: true,
});

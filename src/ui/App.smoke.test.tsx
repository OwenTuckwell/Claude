// @vitest-environment jsdom
// Smoke test: mount the whole App in a DOM and fail loudly on any render-time crash.
// This catches runtime errors that typecheck + build cannot (e.g. a white screen).
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";

let container: HTMLDivElement;
let root: Root;
const errors: unknown[] = [];

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  vi.spyOn(console, "error").mockImplementation((...a) => { errors.push(a); });
});

afterEach(() => {
  act(() => root?.unmount());
  container.remove();
  vi.restoreAllMocks();
});

it("mounts without crashing on a fresh game", () => {
  localStorage.clear();
  act(() => { root = createRoot(container); root.render(<App />); });
  expect(container.querySelector(".hud")).not.toBeNull();
});

it("survives an unknown/corrupt save in localStorage", () => {
  localStorage.setItem("bannerfall.save.v1", "{\"schemaVersion\":1,\"junk\":true}");
  act(() => { root = createRoot(container); root.render(<App />); });
  expect(container.querySelector(".hud")).not.toBeNull();
});

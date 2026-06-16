// @vitest-environment jsdom
// Smoke test: mount the whole App in a DOM and fail loudly on any render-time crash.
// This catches runtime errors that typecheck + build cannot (e.g. a white screen).
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";

let container: HTMLDivElement;
let root: Root;
const errors: unknown[][] = [];

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

it("renders every tab without crashing", () => {
  localStorage.clear();
  act(() => { root = createRoot(container); root.render(<App />); });
  const tabs = Array.from(container.querySelectorAll(".tabs button")) as HTMLButtonElement[];
  expect(tabs.length).toBeGreaterThanOrEqual(6);
  for (const tab of tabs) {
    act(() => { tab.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(container.querySelector(".content")?.childElementCount ?? 0).toBeGreaterThan(0);
  }
  // any React render error would have been logged to console.error
  const renderErrors = errors.filter((e) => String(e[0]).includes("not be a child") || String(e[0]).toLowerCase().includes("error"));
  expect(renderErrors).toEqual([]);
});

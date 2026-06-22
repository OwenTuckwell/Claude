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

it("opens every place and pop-out panel without crashing", () => {
  localStorage.clear();
  act(() => { root = createRoot(container); root.render(<App />); });
  const buttons = Array.from(container.querySelectorAll(".rail button")) as HTMLButtonElement[];
  expect(buttons.length).toBeGreaterThanOrEqual(7); // 3 places + 4 panels (+ menu)
  for (const btn of buttons) {
    act(() => { btn.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    // either a scene fills the stage, or a drawer opened — something is always on screen
    const live = (container.querySelector(".stage")?.childElementCount ?? 0) + (container.querySelector(".drawer") ? 1 : 0);
    expect(live).toBeGreaterThan(0);
  }
  // any React render error would have been logged to console.error
  const renderErrors = errors.filter((e) => String(e[0]).includes("not be a child") || String(e[0]).toLowerCase().includes("error"));
  expect(renderErrors).toEqual([]);
});

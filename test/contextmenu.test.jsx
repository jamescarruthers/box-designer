/**
 * §58 The menu on screen.
 *
 * What it offers is `menu.js`'s business and is tested there. What is left here
 * is the behaviour of a menu as such: it shows what it was given, it can be
 * worked without the pointer, and it goes away — by Escape, by a click
 * elsewhere, or by a choice being made. A menu that will not close is worse
 * than no menu.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ContextMenu from "../src/ui/ContextMenu.jsx";
import { contextMenu } from "../src/ui/menu.js";
import { DEFAULT_DESIGN, derive } from "../src/ui/design.js";

afterEach(cleanup);

const MENU = {
  kind: "panel",
  title: "Left carcass",
  groups: [
    { name: "On this face", items: [
      { id: "add-cladding", label: "Add cladding", apply: (d) => d },
      { id: "add-doubler", label: "Add doubler", apply: (d) => d },
    ] },
    { name: "Prominence", items: [
      { id: "front", label: "Bring to the front", note: "runs past all five", apply: (d) => d },
      { id: "back", label: "Send to the back", disabled: true, why: "already inside all five" },
    ] },
  ],
};

const show = (menu = MENU, props = {}) => {
  const onPick = vi.fn(), onClose = vi.fn();
  const r = render(<ContextMenu menu={menu} at={{ x: 40, y: 60 }}
    onPick={onPick} onClose={onClose} {...props} />);
  return { ...r, onPick, onClose };
};

describe("§58 the menu shows what it was given", () => {
  it("names the thing it was opened on, for a screen reader too", () => {
    show();
    expect(screen.getByRole("menu", { name: "Left carcass" })).toBeTruthy();
    expect(screen.getByText("Left carcass")).toBeTruthy();
  });

  it("lists every group and item", () => {
    show();
    expect(screen.getAllByRole("menuitem").map((b) => b.querySelector(".what").textContent))
      .toEqual(["Add cladding", "Add doubler", "Bring to the front", "Send to the back"]);
    expect(screen.getByText("runs past all five")).toBeTruthy();
    expect(screen.getByText("On this face")).toBeTruthy();
  });

  it("shows the refusal rather than hiding the item", () => {
    // An item that has gone is a question you cannot ask. One that is greyed
    // with a reason answers it.
    show();
    const back = screen.getByRole("menuitem", { name: /Send to the back/ });
    expect(back.disabled).toBe(true);
    expect(back.textContent).toContain("already inside all five");
    expect(back.getAttribute("title")).toBe("already inside all five");
  });

  it("draws nothing at all when there is nothing to offer", () => {
    const { container } = show(null);
    expect(container.querySelector(".context-menu")).toBeNull();
    const empty = show({ title: "Nothing", groups: [{ name: "None", items: [] }] });
    expect(empty.container.querySelector(".context-menu")).toBeNull();
  });
});

describe("§58 the menu can be worked and closed", () => {
  it("hands back the item that was chosen, and closes", () => {
    const { onPick } = show();
    fireEvent.click(screen.getByRole("menuitem", { name: "Add doubler" }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].id).toBe("add-doubler");
  });

  it("takes the focus, so the keyboard can carry on from the pointer", () => {
    show();
    expect(document.activeElement.textContent).toBe("Add cladding");
  });

  it("walks the items with the arrows, skipping what cannot be chosen", () => {
    show();
    const down = () => fireEvent.keyDown(window, { key: "ArrowDown" });
    down(); expect(document.activeElement.textContent).toBe("Add doubler");
    down(); expect(document.activeElement.textContent).toContain("Bring to the front");
    // "Send to the back" is disabled, so the next one down is the first again.
    down(); expect(document.activeElement.textContent).toBe("Add cladding");
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(document.activeElement.textContent).toContain("Bring to the front");
  });

  it("closes on Escape", () => {
    const { onClose } = show();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on a click anywhere else, and not on a click inside", () => {
    const { onClose } = show();
    fireEvent.pointerDown(screen.getByRole("menuitem", { name: "Add doubler" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("§58 a real menu, from a real box", () => {
  it("renders what a right-click on the front carcass would offer", () => {
    const derived = derive(DEFAULT_DESIGN);
    const index = derived.rows.find((r) => r.face === "front" && r.layer === "shell").panelIndex;
    show(contextMenu(DEFAULT_DESIGN, derived, { kind: "panel", index }));

    expect(screen.getByRole("menu", { name: "Front carcass" })).toBeTruthy();
    for (const label of ["Add cladding", "Add doubler", "Add lagging", "Open the inspector"]) {
      expect(screen.getByRole("menuitem", { name: label })).toBeTruthy();
    }
    // The front is rank 0 under the default preset, so there is nowhere to
    // bring it to.
    expect(screen.getByRole("menuitem", { name: /Bring to the front/ }).disabled).toBe(true);
  });

  it("renders what a right-click on an edge would offer", () => {
    const derived = derive(DEFAULT_DESIGN);
    show(contextMenu(DEFAULT_DESIGN, derived, { kind: "edge", key: "front|left" }));
    expect(screen.getByRole("menu", { name: "Front / Left edge" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Mitre" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Fillet R12/ })).toBeTruthy();
  });
});

// §58 The menu itself: a list at a point, and nothing else.
//
// Everything about *what* it offers is in menu.js. This puts it on screen,
// keeps it on screen, and gets out of the way — by Escape, by a click
// elsewhere, or by a choice being made.

import React, { useEffect, useRef, useLayoutEffect, useState } from "react";
import { menuItems } from "./menu.js";

/** Kept clear of the window's edges: a menu half off the screen is half a menu. */
const EDGE = 8;

export default function ContextMenu({ menu, at, onPick, onClose }) {
  const box = useRef(null);
  const [place, setPlace] = useState({ left: at.x, top: at.y, ready: false });

  // Where it actually fits, measured once it is in the document. Flipped rather
  // than nudged: a menu that opens up and to the left from a pointer near the
  // bottom right is still a menu opening *from the pointer*.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const w = window.innerWidth, h = window.innerHeight;
    const left = at.x + width + EDGE > w ? Math.max(EDGE, at.x - width) : at.x;
    const top = at.y + height + EDGE > h ? Math.max(EDGE, at.y - height) : at.y;
    setPlace({ left, top, ready: true });
  }, [at.x, at.y, menu]);

  // The first thing that can be chosen takes the focus, so the keyboard can
  // work the menu without the pointer having to find it again.
  useEffect(() => {
    box.current?.querySelector("button:not(:disabled)")?.focus();
  }, [menu]);

  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const able = [...box.current.querySelectorAll("button:not(:disabled)")];
      const i = able.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? i + 1 : i - 1;
      able[(next + able.length) % able.length]?.focus();
    };
    // Capture, so a click anywhere closes before whatever it landed on acts:
    // the box behind the menu should not turn because the menu was dismissed.
    const away = (e) => { if (!box.current?.contains(e.target)) onClose(); };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  if (!menu || !menuItems(menu).length) return null;

  return (
    <div className="context-menu" ref={box} role="menu" aria-label={menu.title}
      style={{ left: place.left, top: place.top, visibility: place.ready ? "visible" : "hidden" }}>
      <header>{menu.title}</header>
      {menu.groups.filter((g) => g.items.length).map((group, gi) => (
        <div className="menu-group" key={group.name ?? `g${gi}`}>
          {group.name ? <h4>{group.name}</h4> : null}
          {group.items.map((item) => (
            <button type="button" key={item.id} role="menuitem"
              className={item.on ? "on" : ""}
              disabled={Boolean(item.disabled)}
              // The refusal is the useful half: an item that cannot be chosen
              // says what would have to change for it to be.
              title={item.why ?? undefined}
              aria-describedby={item.why ? `${item.id}-why` : undefined}
              onClick={() => onPick(item)}>
              <span className="what">{item.label}</span>
              {item.on ? <span className="mark" aria-label="current">·</span> : null}
              {item.note && !item.disabled ? <span className="note">{item.note}</span> : null}
              {item.why ? <span className="note why" id={`${item.id}-why`}>{item.why}</span> : null}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// §60 Something that opens over the page and closes when it is done with:
// by Escape, by a click anywhere else, or by the window losing focus.

import { useEffect } from "react";

/**
 * While `open`, close on Escape, on a pointer-down outside `ref`, and on the
 * window blurring. The pointer listener is on capture, so a click on the box
 * behind a menu closes the menu and does not also turn the box.
 */
export function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    const away = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("blur", onClose);
    };
  }, [ref, open, onClose]);
}

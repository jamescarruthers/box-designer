import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App.jsx";
import { ensureCrossOriginIsolated } from "./occt/isolate.js";
import "./styles.css";

// Get isolation settled before anything is on screen.
//
// Where the server sends COOP/COEP this is a no-op. Where it cannot — GitHub
// Pages — the service worker has to install and the page has to reload once
// before it controls anything. Doing that here means the reload lands on the
// first paint, when nothing is loaded and no one has clicked. Doing it lazily
// on the first kernel request instead reloaded the page out from under the
// click that asked for it, which read as a freeze and dropped the request.
ensureCrossOriginIsolated().finally(mount);

function mount() {
  createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
}

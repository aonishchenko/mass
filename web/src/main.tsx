import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Cv } from "./Cv";
import "./index.css";

// The public CV page (M5) is a standalone read-only view — no session, no
// WebSocket — reachable at /cv/<name>.
const cvMatch = location.pathname.match(/^\/cv\/(.+)$/);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {cvMatch ? <Cv name={decodeURIComponent(cvMatch[1])} /> : <App />}
  </StrictMode>
);

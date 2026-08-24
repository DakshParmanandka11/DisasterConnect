import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BatteryProvider } from "./context/BatteryContext";

// Register Service Worker for PWA support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("ServiceWorker registered successfully:", reg.scope))
      .catch((err) => console.log("ServiceWorker registration failed:", err));
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BatteryProvider>
      <App />
    </BatteryProvider>
  </StrictMode>
);

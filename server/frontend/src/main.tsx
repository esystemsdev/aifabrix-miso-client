// Ensure Node.js polyfills are available globally before any other imports
// Load comprehensive globals first, then specific module stubs
import "./stubs/node-globals";
import "./stubs/buffer";
import "./stubs/util";
import "./stubs/process";
import "./stubs/events";

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { DataClientProvider } from "./contexts/DataClientContext";
import { ThemeProvider } from "next-themes";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <DataClientProvider>
      <App />
    </DataClientProvider>
  </ThemeProvider>
);
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Scene Studio root was not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { createRoot } from "react-dom/client";
import Widget from "./Widget";
import "./styles.css";

// Mark ChatGPT host for hooks (no bootstrap needed — widget has no router)
if (typeof window !== "undefined") {
  (window as Window & { __isChatGptApp?: boolean }).__isChatGptApp =
    typeof (window as Window & { openai?: unknown }).openai !== "undefined";
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<Widget />);

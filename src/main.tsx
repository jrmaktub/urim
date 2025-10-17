import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initChainDiagnostics } from "@/lib/chainDiagnostics";

initChainDiagnostics();

createRoot(document.getElementById("root")!).render(<App />);

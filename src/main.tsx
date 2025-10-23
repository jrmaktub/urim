import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { Buffer } from "buffer";
if (!Buffer.prototype.writeUint32BE) {
  Buffer.prototype.writeUint32BE = function (value: number, offset: number = 0) {
    const view = new DataView(this.buffer);
    view.setUint32(offset, value, false);
    return offset + 4;
  };
}
window.Buffer = Buffer;

createRoot(document.getElementById("root")!).render(<App />);
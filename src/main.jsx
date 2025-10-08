import React from "react";
import { createRoot } from "react-dom/client";
import SectoCafePedidos from "./SectoCafePedidos.jsx";
import "./index.css"; // tailwind

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SectoCafePedidos />
  </React.StrictMode>
);

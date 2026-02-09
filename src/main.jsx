import React from "react";
import { createRoot } from "react-dom/client";
import SectoCafePedidos from "./SectoCafePedidos.jsx";
import Kitchen from "./Kitchen.jsx";
import Admin from "./Admin.jsx";
import Ticket from "./ticket.jsx"; // asegurate que el archivo se llame EXACTO "ticket.jsx"
import "./index.css";

function AppRouter() {
  const path = window.location.pathname;
  if (path === "/kitchen") return <Kitchen />;
  if (path === "/ticket") return <Ticket />;
  if (path === "/admin") return <Admin />;
  return <SectoCafePedidos />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);

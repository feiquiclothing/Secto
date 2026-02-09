import React from "react";
import { createRoot } from "react-dom/client";
import SectoCafePedidos from "./SectoCafePedidos.jsx";
import Kitchen from "./Kitchen.jsx";
import Ticket from "./ticket.jsx";
import "./index.css"; // tailwind
import Admin from "./Admin.jsx";

function Router() {
  const path = window.location.pathname;
  if (path === "/kitchen") return <Kitchen />;
  if (path === "/ticket") return <Ticket />;
  if (path === "/admin") return <Admin />;   // <- nuevo
  return <SectoCafePedidos />;
}


createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);

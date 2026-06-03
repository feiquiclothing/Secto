import React, { useEffect, useRef, useState } from "react";

const ENDPOINT = "/api/secto";
const POLL_MS = 2500;

const STORAGE_KEY = "secto_printed_ids_v1";
const PRINT_ORDER_KEY = "secto_print_order";
const DEDUPE_TTL_MS = 10 * 60 * 1000;

function loadMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveMap(m) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {}
}

function cleanup(m) {
  const now = Date.now();
  const out = { ...m };

  for (const [id, ts] of Object.entries(out)) {
    if (!ts || now - ts > DEDUPE_TTL_MS) delete out[id];
  }

  return out;
}

async function post(payload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Respuesta no JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return data;
}

export default function Kitchen() {
  const [status, setStatus] = useState("Esperando pedidos…");
  const [lastId, setLastId] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);

  const printedRef = useRef(cleanup(loadMap()));
  const busyRef = useRef(false);
  const ticketWinRef = useRef(null);

  const saveOrderForTicket = (order) => {
    const raw = JSON.stringify(order);

    try {
      localStorage.setItem(PRINT_ORDER_KEY, raw);
    } catch {}

    try {
      sessionStorage.setItem(PRINT_ORDER_KEY, raw);
    } catch {}
  };

  const openOrReuseTicket = () => {
    const url = "/ticket?autoprint=1";

    if (ticketWinRef.current && !ticketWinRef.current.closed) {
      ticketWinRef.current.location.href = url;
      ticketWinRef.current.focus();
      return true;
    }

    ticketWinRef.current = window.open(url, "secto_ticket");

    if (!ticketWinRef.current) {
      return false;
    }

    ticketWinRef.current.focus();
    return true;
  };

  const reopenLastTicket = () => {
    if (!lastOrder) {
      setStatus("No hay último pedido para reimprimir.");
      return;
    }

    saveOrderForTicket(lastOrder);

    const opened = openOrReuseTicket();

    if (!opened) {
      setStatus("No se pudo abrir la pestaña de ticket. Revisá bloqueo de popups.");
      return;
    }

    setStatus(`Reabriendo ticket ${lastOrder.id || ""}`);
  };

  useEffect(() => {
    let stop = false;

    const poll = async () => {
      if (stop || busyRef.current) return;

      busyRef.current = true;

      try {
        const data = await post({ action: "next_unprinted" });
        const order = data?.order;
        const id = order?.id;

        if (!id) {
          setStatus("Esperando pedidos…");
          return;
        }

        printedRef.current = cleanup(printedRef.current);

        if (printedRef.current[id]) {
          setStatus(`Esperando pedidos… (dedupe ${id})`);
          return;
        }

        setLastId(id);
        setLastOrder(order);
        setStatus("Preparando ticket " + id);

        saveOrderForTicket(order);

        const opened = openOrReuseTicket();

        if (!opened) {
          setStatus("No se pudo abrir /ticket. Revisá bloqueo de popups.");
          return;
        }

        await post({ action: "mark_printed", id });

        printedRef.current[id] = Date.now();
        saveMap(printedRef.current);

        setStatus("Listo. Esperando pedidos…");
      } catch (e) {
        if (!stop) {
          setStatus("ERROR: " + (e?.message || String(e)));
        }
      } finally {
        busyRef.current = false;
      }
    };

    const timer = setInterval(poll, POLL_MS);
    poll();

    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1>SECTO — KITCHEN</h1>

      <p style={{ fontWeight: 600 }}>{status}</p>

      {lastId && (
        <p style={{ opacity: 0.7 }}>
          Último ticket: <b>{lastId}</b>
        </p>
      )}

      <button
        type="button"
        onClick={reopenLastTicket}
        disabled={!lastOrder}
        style={{
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ccc",
          background: lastOrder ? "#000" : "#eee",
          color: lastOrder ? "#fff" : "#777",
          cursor: lastOrder ? "pointer" : "not-allowed",
        }}
      >
        Reabrir último ticket
      </button>

      <p style={{ opacity: 0.7, marginTop: 16 }}>
        Dejá esta pestaña abierta en la PC conectada a la impresora térmica.
      </p>

      <p style={{ opacity: 0.55, fontSize: 13 }}>
        Si el ticket no se abre, permití popups para este sitio.
      </p>
    </div>
  );
}

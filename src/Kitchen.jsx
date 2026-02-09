import React, { useEffect, useRef, useState } from "react";

const ENDPOINT = "/api/secto";
const POLL_MS = 2500;

const STORAGE_KEY = "secto_printed_ids_v1";
const DEDUPE_TTL_MS = 10 * 60 * 1000;

function loadMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
function saveMap(m) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch {}
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
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return data;
}

export default function Kitchen() {
  const [status, setStatus] = useState("Esperando pedidos…");
  const [lastId, setLastId] = useState(null);

  const printedRef = useRef(cleanup(loadMap()));
  const busyRef = useRef(false);
  const ticketWinRef = useRef(null);

  useEffect(() => {
    let stop = false;

    const openOrReuseTicket = () => {
      if (ticketWinRef.current && !ticketWinRef.current.closed) {
        ticketWinRef.current.location.href = "/ticket?autoprint=1";
        ticketWinRef.current.focus();
        return;
      }
      ticketWinRef.current = window.open(
        "/ticket?autoprint=1",
        "secto_ticket",
        "noopener,noreferrer"
      );
    };

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
        setStatus("Imprimiendo " + id);

        sessionStorage.setItem("secto_print_order", JSON.stringify(order));
        openOrReuseTicket();

        await post({ action: "mark_printed", id });

        printedRef.current[id] = Date.now();
        saveMap(printedRef.current);

        setStatus("Listo. Esperando pedidos…");
      } catch (e) {
        if (!stop) setStatus("ERROR: " + (e?.message || String(e)));
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
          Último impreso: <b>{lastId}</b>
        </p>
      )}
      <p style={{ opacity: 0.7 }}>
        Dejá esta pestaña abierta en la PC conectada a la impresora térmica.
      </p>
    </div>
  );
}

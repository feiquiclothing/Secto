import React, { useEffect, useState } from "react";

const ENDPOINT = "/api/secto"; // <- proxy mismo-origen (evita CORS)
const POLL_MS = 2500;

async function post(actionPayload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(actionPayload),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // si el proxy/GAS devuelve algo raro, mostramos el texto
    throw new Error(`Respuesta no JSON (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }

  return data;
}

export default function Kitchen() {
  const [status, setStatus] = useState("Esperando pedidos…");
  const [lastId, setLastId] = useState(null);

  useEffect(() => {
    let stop = false;
    let busy = false;

    const poll = async () => {
      if (stop || busy) return;
      busy = true;

      try {
        const data = await post({ action: "next_unprinted" });
        if (stop) return;

        if (data?.order?.id) {
          const id = data.order.id;
          setLastId(id);
          setStatus("Imprimiendo " + id);

          sessionStorage.setItem("secto_print_order", JSON.stringify(data.order));
          window.open("/ticket?autoprint=1", "_blank", "noopener,noreferrer");

          // marcar impreso
          await post({ action: "mark_printed", id });

          setStatus("Listo. Esperando pedidos…");
        } else {
          setStatus("Esperando pedidos…");
        }
      } catch (e) {
        if (!stop) setStatus("ERROR: " + (e?.message || String(e)));
      } finally {
        busy = false;
      }
    };

    const id = setInterval(poll, POLL_MS);
    poll();

    return () => {
      stop = true;
      clearInterval(id);
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

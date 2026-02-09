import React, { useState } from "react";

const ENDPOINT = "/api/secto";

async function post(payload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return data;
}

export default function Admin() {
  const [customer, setCustomer] = useState("");
  const [rawText, setRawText] = useState("");
  const [total, setTotal] = useState("");
  const [paid, setPaid] = useState(false);
  const [status, setStatus] = useState("");

  const submit = async () => {
    setStatus("Guardando…");
    try {
      const order = {
        source: "whatsapp",
        customer: customer.trim() || "WhatsApp",
        rawText: rawText.trim(),
        total: total ? Number(total) : null,
        paid,
        method: "whatsapp",
        time: "ASAP",
      };

      const r = await post({ action: "new_order", order });

      setStatus(`OK — creado ${r?.id || ""}`.trim());
      setCustomer("");
      setRawText("");
      setTotal("");
      setPaid(false);
    } catch (e) {
      setStatus("ERROR: " + (e?.message || String(e)));
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 640 }}>
      <h1 style={{ margin: 0 }}>SECTO — ADMIN</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Pedidos WhatsApp (1 click). Crea una fila en <b>orders</b> con <b>printed = false</b> y Kitchen lo imprime.
      </p>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <input
          placeholder="Cliente / nombre (opcional)"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
        />

        <textarea
          placeholder="Pegá el mensaje de WhatsApp acá"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={7}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
        />

        <input
          placeholder="Total (opcional)"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          inputMode="decimal"
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
        />

        <label style={{ display: "flex", gap: 8, alignItems: "center", opacity: 0.85 }}>
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          Ya pagó
        </label>

        <button
          onClick={submit}
          disabled={!rawText.trim()}
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ddd",
            cursor: rawText.trim() ? "pointer" : "not-allowed",
            fontWeight: 600,
          }}
        >
          Crear pedido WhatsApp
        </button>

        {status && <div style={{ opacity: 0.85 }}>{status}</div>}
      </div>
    </div>
  );
}


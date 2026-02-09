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
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Respuesta no JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return data;
}

export default function Admin() {
  const [customer, setCustomer] = useState("");
  const [rawText, setRawText] = useState("");
  const [total, setTotal] = useState("");
  const [paid, setPaid] = useState(false);
  const [status, setStatus] = useState("");

  const pretty = (x) => {
    try {
      return JSON.stringify(x, null, 2);
    } catch {
      return String(x);
    }
  };

  // ✅ PING real: solo verifica endpoint + buildId
  const ping = async () => {
    setStatus("Pingeando…");
    try {
      const r = await post({ action: "ping" });
      setStatus(
        `PING OK\nbuildId: ${r?.buildId || "(sin buildId)"}\n\nRESP:\n${pretty(r)}`
      );
    } catch (e) {
      setStatus("PING ERROR: " + (e?.message || String(e)));
    }
  };

  // 👀 Ver el próximo pedido sin imprimir (esto NO es ping)
  const peekNext = async () => {
    setStatus("Buscando next_unprinted…");
    try {
      const r = await post({ action: "next_unprinted" });
      if (r?.order?.id) {
        setStatus(
          `NEXT UNPRINTED OK\nid: ${r.order.id}\nbuildId: ${r?.buildId || "(sin buildId)"}\n\nORDER:\n${pretty(r.order)}`
        );
      } else {
        setStatus(
          `NEXT UNPRINTED: ninguno\nbuildId: ${r?.buildId || "(sin buildId)"}\n\nRESP:\n${pretty(r)}`
        );
      }
    } catch (e) {
      setStatus("NEXT ERROR: " + (e?.message || String(e)));
    }
  };

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

      // ✅ status legible + JSON completo
      const line1 = `NEW ORDER OK`;
      const line2 = `id: ${r?.id || r?.orderId || "(sin id)"} | wroteRow: ${
        r?.wroteRow ?? "(sin wroteRow)"
      } | buildId: ${r?.buildId || "(sin buildId)"}`;

      setStatus(`${line1}\n${line2}\n\nRESP:\n${pretty(r)}`);
    } catch (e) {
      setStatus("ERROR: " + (e?.message || String(e)));
    }
  };

  const clear = () => {
    setCustomer("");
    setRawText("");
    setTotal("");
    setPaid(false);
    setStatus("");
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1 style={{ margin: 0 }}>SECTO — ADMIN</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Pedidos WhatsApp. Crea una fila en <b>orders</b> con <b>printed=false</b> y Kitchen lo imprime.
      </p>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={ping}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
          >
            Ping (buildId)
          </button>

          <button
            onClick={peekNext}
            style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
          >
            Ver next_unprinted
          </button>
        </div>

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
          rows={8}
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

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={submit}
            disabled={!rawText.trim()}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              border: "1px solid #ddd",
              cursor: rawText.trim() ? "pointer" : "not-allowed",
              fontWeight: 700,
            }}
          >
            Crear pedido WhatsApp
          </button>

          <button
            onClick={clear}
            style={{
              padding: 12,
              borderRadius: 8,
              border: "1px solid #ddd",
              cursor: "pointer",
            }}
          >
            Limpiar
          </button>
        </div>

        {status && (
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: 0.9 }}>
            {status}
          </pre>
        )}
      </div>
    </div>
  );
}

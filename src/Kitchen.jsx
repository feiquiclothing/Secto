import React, { useEffect, useState } from "react";

const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbx3C4Wnvzguh7AVtmdtz1VH9KiAHwXBX6pGjbML-0wGvjJkaLnvBlJ7mAetvnAyTLGlSA/exec";

const POLL_MS = 2500;
const TIMEOUT_MS = 12000;

function clip(s, n = 2500) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + `\n…(clipped len=${s.length})` : s;
}

async function postDebug(payload) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const dbg = {
    at: new Date().toISOString(),
    endpoint: ENDPOINT,
    request: payload,
    ok: false,
    status: null,
    statusText: null,
    contentType: null,
    rawText: null,
    json: null,
    jsonParseError: null,
    fetchError: null,
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    dbg.status = res.status;
    dbg.statusText = res.statusText;
    dbg.ok = res.ok;
    dbg.contentType = res.headers.get("content-type") || "";

    const text = await res.text();
    dbg.rawText = clip(text);

    try {
      dbg.json = text ? JSON.parse(text) : null;
    } catch (e) {
      dbg.jsonParseError = String(e?.message || e);
    }

    return dbg;
  } catch (e) {
    dbg.fetchError = String(e?.name ? `${e.name}: ${e.message}` : e);
    return dbg;
  } finally {
    clearTimeout(t);
  }
}

export default function Kitchen() {
  const [status, setStatus] = useState("Esperando pedidos…");
  const [last, setLast] = useState(null);

  useEffect(() => {
    let stop = false;
    let busy = false;

    const poll = async () => {
      if (stop || busy) return;
      busy = true;

      // 1) pedir siguiente
      const dbg = await postDebug({ action: "next_unprinted" });
      if (stop) return;

      setLast(dbg);

      // Status humano + útil
      if (dbg.fetchError) {
        setStatus(`FETCH ERROR: ${dbg.fetchError}`);
        busy = false;
        return;
      }

      if (!dbg.ok) {
        setStatus(`HTTP ${dbg.status} ${dbg.statusText || ""}`.trim());
        busy = false;
        return;
      }

      if (dbg.jsonParseError) {
        setStatus(
          `200 OK pero NO JSON (${dbg.contentType || "sin content-type"}) — jsonParseError: ${dbg.jsonParseError}`
        );
        busy = false;
        return;
      }

      const data = dbg.json;

      if (data?.order?.id) {
        setStatus("Imprimiendo " + data.order.id);

        sessionStorage.setItem("secto_print_order", JSON.stringify(data.order));
        window.open("/ticket?autoprint=1", "_blank", "noopener,noreferrer");

        // 2) marcar impreso (también con debug)
        const mark = await postDebug({ action: "mark_printed", id: data.order.id });
        setLast(mark);

        if (mark.fetchError) setStatus(`MARK fetchError: ${mark.fetchError}`);
        else if (!mark.ok) setStatus(`MARK HTTP ${mark.status} ${mark.statusText || ""}`.trim());
        else if (mark.jsonParseError) setStatus(`MARK 200 OK pero NO JSON — ${mark.jsonParseError}`);
        else setStatus("Listo. Esperando pedidos…");
      } else {
        setStatus("Esperando pedidos…");
      }

      busy = false;
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

      {last && (
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 8,
            background: "#fafafa",
            overflow: "auto",
            maxHeight: 420,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
          }}
        >
{JSON.stringify(last, null, 2)}
        </pre>
      )}

      <p style={{ opacity: 0.7, marginTop: 12 }}>
        Dejá esta pestaña abierta en la PC conectada a la impresora térmica.
      </p>
    </div>
  );
}

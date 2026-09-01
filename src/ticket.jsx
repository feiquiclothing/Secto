import React, { useEffect, useMemo, useRef, useState } from "react";

const ENDPOINT = "/api/secto";
const STORAGE_KEY = "secto_printed_ids_v1";

const currency = (uy) =>
  new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(uy);

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

async function post(payload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Respuesta no JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
    );
  }

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  return data;
}

export default function Ticket() {
  const params = useMemo(
    () =>
      new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : ""
      ),
    []
  );

  const autoPrint = params.get("autoprint") === "1";
  const id = params.get("id");
  const returnTo = params.get("returnTo") || "";

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState(id ? "Cargando pedido…" : "Sin pedido.");
  const [printRequested, setPrintRequested] = useState(false);

  const printStartedRef = useRef(false);
  const finishingRef = useRef(false);

  useEffect(() => {
    document.title = id ? `COMANDA ${id}` : "COMANDA";
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let stop = false;

    const loadOrder = async () => {
      try {
        const data = await post({
          action: "get_order",
          id,
        });

        if (!data?.order) {
          throw new Error("No se encontró el pedido");
        }

        if (!stop) {
          setOrder(data.order);
          setStatus("");
        }
      } catch (err) {
        if (!stop) {
          setStatus("Error cargando pedido: " + (err?.message || err));
        }
      }
    };

    loadOrder();

    return () => {
      stop = true;
    };
  }, [id]);

  const finishPrintedOrder = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    setStatus("Finalizando impresión…");

    const finalId = order?.id || id;

    try {
      await post({
        action: "mark_printed",
        id: finalId,
      });

      if (finalId) {
        const map = loadMap();
        map[finalId] = Date.now();
        saveMap(map);
      }
    } catch (err) {
      console.error("No se pudo marcar printed:", err);
      finishingRef.current = false;
      setStatus(
        "La comanda se imprimió, pero no se pudo marcar como impresa: " +
          (err?.message || String(err))
      );
      return;
    }

    if (returnTo) {
      window.location.href = returnTo;
    }
  };

  const doPrint = () => {
    if (!order) return;

    setPrintRequested(true);
    setStatus("Abriendo impresión…");

    // Dos frames garantizan que la comanda ya haya sido renderizada.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.focus();

        setTimeout(() => {
          window.print();
        }, 150);
      });
    });
  };

  useEffect(() => {
    if (!order || !autoPrint || printStartedRef.current) return;

    printStartedRef.current = true;

    const t = setTimeout(() => {
      doPrint();
    }, 700);

    return () => clearTimeout(t);
  }, [order, autoPrint]);

  useEffect(() => {
    const onAfterPrint = () => {
      if (!printRequested) return;
      finishPrintedOrder();
    };

    window.addEventListener("afterprint", onAfterPrint);

    return () => {
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [printRequested, order, id, returnTo]);

  if (!order) {
    return (
      <div style={{ padding: 16, fontFamily: "monospace" }}>
        {status || "Sin pedido."}
      </div>
    );
  }

  const isWhatsApp = order?.source === "whatsapp" || !!order?.rawText;

  const {
    items = [],
    subtotal = 0,
    fee = 0,
    total = 0,
    name,
    phone,
    address,
    method,
    notes,
    time,
    paid,
    customer,
    rawText,
  } = order;

  const displayName = name || customer || "-";

  const displayMethod =
    method === "pickup"
      ? "RETIRO"
      : method === "delivery"
      ? "DELIVERY"
      : isWhatsApp
      ? "WHATSAPP"
      : "—";

  const hasItems = Array.isArray(items) && items.length > 0;

  return (
    <>
      <div className="controls noprint">
        <div>
          <b>COMANDA {order.id || id || ""}</b>
        </div>

        <div style={{ fontSize: 13, opacity: 0.65 }}>
          {status || (autoPrint ? "Impresión automática activada" : "Lista para imprimir")}
        </div>

        <button type="button" onClick={doPrint}>
          IMPRIMIR COMANDA
        </button>

        {returnTo ? (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              window.location.href = returnTo;
            }}
          >
            VOLVER A KITCHEN
          </button>
        ) : null}
      </div>

      <div className="t">
        <div className="c">
          <div className="b">SECTO CAFE</div>
          <div className="m">Piedras 276</div>
        </div>

        <div className="hr" />

        <div>Pedido: {order.id || id || "-"}</div>
        <div>Metodo: {displayMethod}</div>
        <div>Horario: {time || "ASAP"}</div>
        <div>Nombre: {displayName}</div>
        <div>Tel: {phone || "-"}</div>

        {method === "delivery" ? <div>Dir: {address || "-"}</div> : null}
        {notes ? <div>Notas: {notes}</div> : null}

        {isWhatsApp && rawText ? (
          <>
            <div className="hr" />
            <div className="b" style={{ letterSpacing: "0.06em" }}>
              PEDIDO (WHATSAPP)
            </div>
            <div className="raw">{rawText}</div>
          </>
        ) : null}

        {hasItems ? (
          <>
            <div className="hr" />

            {items.map(({ item, qty }, i) => (
              <div key={i} className="row">
                <div className="l">
                  {qty}x {item?.name}
                </div>
                <div className="r">
                  {currency((item?.price || 0) * (qty || 0))}
                </div>
              </div>
            ))}

            <div className="hr" />

            <div className="row">
              <div className="l">Subtotal</div>
              <div className="r">{currency(subtotal)}</div>
            </div>

            <div className="row">
              <div className="l">Envio</div>
              <div className="r">{currency(fee)}</div>
            </div>

            <div className="row b">
              <div className="l">TOTAL</div>
              <div className="r">{currency(total)}</div>
            </div>
          </>
        ) : total ? (
          <>
            <div className="hr" />

            <div className="row b">
              <div className="l">TOTAL</div>
              <div className="r">{currency(total)}</div>
            </div>
          </>
        ) : null}

        <div className="hr" />

        <div className="m">
          Estado: {paid ? "PAGADO" : "A PAGAR"}
        </div>
      </div>

      <style>{`
        @page {
          size: 80mm auto;
          margin: 6mm;
        }

        body {
          background: white;
          margin: 0;
        }

        .controls {
          font-family: system-ui;
          padding: 16px;
          max-width: 420px;
          display: grid;
          gap: 10px;
        }

        .controls button {
          padding: 12px 14px;
          border: 1px solid #111;
          border-radius: 10px;
          background: #111;
          color: #fff;
          font-weight: 800;
          cursor: pointer;
        }

        .controls button.secondary {
          background: #fff;
          color: #111;
        }

        .t {
          width: 72mm;
          padding: 6mm;
          font-family: ui-monospace, Menlo, Consolas, monospace;
          font-size: 12px;
          line-height: 1.25;
        }

        .c {
          text-align: center;
        }

        .b {
          font-weight: 700;
          letter-spacing: 0.12em;
        }

        .m {
          opacity: 0.75;
        }

        .hr {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }

        .row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin: 2px 0;
        }

        .l {
          flex: 1;
          word-break: break-word;
        }

        .r {
          white-space: nowrap;
        }

        .raw {
          margin-top: 6px;
          white-space: pre-wrap;
          word-break: break-word;
        }

        @media print {
          .noprint {
            display: none !important;
          }

          body {
            margin: 0;
          }

          .t {
            padding: 0;
          }
        }
      `}</style>
    </>
  );
}

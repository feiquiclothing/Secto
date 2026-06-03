import React, { useEffect, useMemo, useState } from "react";

const ENDPOINT = "/api/secto";

const currency = (uy) =>
  new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(uy);

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

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState(id ? "Cargando pedido…" : "Sin pedido.");

  useEffect(() => {
    if (!id) return;

    let stop = false;

    const loadOrder = async () => {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "get_order",
            id,
          }),
        });

        const data = await res.json();

        if (!res.ok || data?.ok === false || !data?.order) {
          throw new Error(data?.error || "No se encontró el pedido");
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

  useEffect(() => {
    if (!order || !autoPrint) return;

    const printId = order?.id || id || String(Date.now());
    const key = `secto_printed_once_${printId}`;

    if (sessionStorage.getItem(key) === "1") return;

    sessionStorage.setItem(key, "1");

    const t = setTimeout(() => {
      window.focus();
      window.print();
    }, 900);

    return () => clearTimeout(t);
  }, [order, autoPrint, id]);

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

      <style>{`
        @page {
          size: 80mm auto;
          margin: 6mm;
        }

        body {
          background: white;
        }

        .t {
          width: 72mm;
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
      `}</style>
    </div>
  );
}

import React, { useEffect, useMemo } from "react";

const currency = (uy) =>
  new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" }).format(uy);

export default function Ticket() {
  const params = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    []
  );
  const autoPrint = params.get("autoprint") === "1";

  const order = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(sessionStorage.getItem("secto_print_order") || "null");
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!order || !autoPrint) return;
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, [order, autoPrint]);

  if (!order) return <div style={{ padding: 16, fontFamily: "monospace" }}>Sin pedido.</div>;

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
    id,
  } = order;

  return (
    <div className="t">
      <div className="c">
        <div className="b">SECTO CAFE</div>
        <div className="m">Piedras 276</div>
      </div>

      <div className="hr" />
      <div>Pedido: {id || "-"}</div>
      <div>Metodo: {method === "pickup" ? "RETIRO" : "DELIVERY"}</div>
      <div>Horario: {time || "ASAP"}</div>
      <div>Nombre: {name || "-"}</div>
      <div>Tel: {phone || "-"}</div>
      {method === "delivery" ? <div>Dir: {address || "-"}</div> : null}
      {notes ? <div>Notas: {notes}</div> : null}

      <div className="hr" />
      {items.map(({ item, qty }, i) => (
        <div key={i} className="row">
          <div className="l">
            {qty}x {item?.name}
          </div>
          <div className="r">{currency((item?.price || 0) * (qty || 0))}</div>
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
      <div className="hr" />
      <div className="m">Estado: {paid ? "PAGADO (MP)" : "A PAGAR"}</div>

      {/* Styles Vite/React compatibles */}
      <style>{`
        @page { size: 80mm auto; margin: 6mm; }
        body { background: white; }

        .t {
          width: 72mm;
          font-family: ui-monospace, Menlo, Consolas, monospace;
          font-size: 12px;
          line-height: 1.25;
        }
        .c { text-align: center; }
        .b { font-weight: 700; letter-spacing: 0.12em; }
        .m { opacity: 0.75; }
        .hr { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
        .l { flex: 1; word-break: break-word; }
        .r { white-space: nowrap; }
      `}</style>
    </div>
  );
}

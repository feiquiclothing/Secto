import React, { useEffect, useMemo, useRef, useState } from "react";

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
  const popupMode = params.get("popup") === "1";
  const returnTo = params.get("returnTo");
  const id = params.get("id");

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState(id ? "Cargando pedido…" : "Sin pedido.");
  const printStartedRef = useRef(false);
  const printDialogOpenedRef = useRef(false);
  const printRetryTimerRef = useRef(null);
  const printAttemptsRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    document.title = id ? `COMANDA ${id}` : "COMANDA";
  }, [id]);

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
          cache: "no-store",
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

  const triggerPrint = () => {
    if (!order || printDialogOpenedRef.current) return;

    printAttemptsRef.current += 1;
    setStatus(
      `Abriendo ventana de impresión… intento ${printAttemptsRef.current}`
    );

    try {
      window.focus();
    } catch {}

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (printDialogOpenedRef.current) return;

          try {
            window.focus();
          } catch {}

          try {
            window.print();
          } catch (err) {
            console.warn("window.print() falló:", err);
          }
        }, 180);
      });
    });
  };

  useEffect(() => {
    const onBeforePrint = () => {
      printDialogOpenedRef.current = true;
      setStatus("Ventana de impresión abierta.");

      if (printRetryTimerRef.current) {
        clearInterval(printRetryTimerRef.current);
        printRetryTimerRef.current = null;
      }
    };

    const onAfterPrint = async () => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      setStatus("Cerrando comanda…");

      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "mark_printed",
            id: order?.id || id,
          }),
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || "No se pudo marcar como impreso");
        }

        if (returnTo) {
          window.location.replace(returnTo);
        } else {
          setStatus("Impresión finalizada.");
        }
      } catch (err) {
        finishedRef.current = false;
        setStatus(
          "Se imprimió, pero no pude cerrar el pedido: " +
            (err?.message || String(err))
        );
      }
    };

    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [order, id, returnTo]);

  useEffect(() => {
    if (!order || !autoPrint || printStartedRef.current) return;

    printStartedRef.current = true;
    printAttemptsRef.current = 0;
    printDialogOpenedRef.current = false;

    const first = setTimeout(() => {
      triggerPrint();

      // Chrome a veces ignora el primer print() si el popup todavía
      // no quedó activo. Reintentamos hasta que beforeprint confirme
      // que el diálogo realmente se abrió.
      printRetryTimerRef.current = setInterval(() => {
        if (printDialogOpenedRef.current) {
          clearInterval(printRetryTimerRef.current);
          printRetryTimerRef.current = null;
          return;
        }

        if (printAttemptsRef.current >= 8) {
          clearInterval(printRetryTimerRef.current);
          printRetryTimerRef.current = null;
          setStatus(
            "Chrome bloqueó la impresión automática. Usá IMPRIMIR COMANDA."
          );
          return;
        }

        triggerPrint();
      }, 900);
    }, popupMode ? 450 : 700);

    return () => {
      clearTimeout(first);

      if (printRetryTimerRef.current) {
        clearInterval(printRetryTimerRef.current);
        printRetryTimerRef.current = null;
      }
    };
  }, [order, autoPrint, popupMode]);

  useEffect(() => {
    if (!order || !autoPrint) return;

    const retryOnActive = () => {
      if (!printDialogOpenedRef.current) {
        setTimeout(() => triggerPrint(), 120);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") retryOnActive();
    };

    window.addEventListener("focus", retryOnActive);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", retryOnActive);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [order, autoPrint]);

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
    comboSelections = [],
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
  const hasComboSelections =
    Array.isArray(comboSelections) && comboSelections.length > 0;

  return (
    <>
      <div className="noprint controls">
        <div style={{ fontWeight: 800 }}>
          {status || "Comanda lista"}
        </div>

        <button type="button" onClick={triggerPrint}>
          IMPRIMIR COMANDA
        </button>
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

        {hasComboSelections ? (
          <>
            <div className="hr" />

            <div className="b comboTitle">DETALLE DE COMBOS</div>

            {comboSelections.map((combo, i) => {
              const rolls = Array.isArray(combo?.rolls)
                ? combo.rolls.filter(Boolean)
                : [];
              const drinks = Array.isArray(combo?.drinks)
                ? combo.drinks.filter(Boolean)
                : [];

              return (
                <div key={`${combo?.comboId || "combo"}-${i}`} className="combo">
                  <div className="comboName">
                    {combo?.comboName || "Combo"}
                    {comboSelections.length > 1 ? ` #${i + 1}` : ""}
                  </div>

                  {rolls.length > 0 ? (
                    <div className="comboDetail">
                      Rolls: {rolls.join(" / ")}
                    </div>
                  ) : null}

                  {drinks.length > 0 ? (
                    <div className="comboDetail">
                      Bebidas: {drinks.join(" / ")}
                    </div>
                  ) : null}
                </div>
              );
            })}
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
            margin: 0;
          }

          .controls {
            padding: 12px;
            font-family: system-ui;
            display: grid;
            gap: 8px;
          }

          .controls button {
            padding: 12px;
            border: 1px solid #111;
            background: #111;
            color: white;
            border-radius: 8px;
            font-weight: 800;
            cursor: pointer;
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

          .comboTitle {
            margin-bottom: 6px;
          }

          .combo {
            margin: 7px 0;
          }

          .comboName {
            font-weight: 700;
          }

          .comboDetail {
            padding-left: 10px;
            margin-top: 2px;
            word-break: break-word;
          }

          @media print {
            .noprint {
              display: none !important;
            }

            .t {
              padding: 0;
            }
          }
        `}</style>
      </div>
    </>
  );
}

import React, { useEffect, useMemo, useState } from "react";

const ENDPOINT = "/api/secto";

const SOURCE_OPTIONS = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "phone", label: "Teléfono" },
  { id: "local", label: "Mostrador" },
  { id: "other", label: "Otro" },
];

const METHOD_OPTIONS = [
  { id: "pickup", label: "Retiro" },
  { id: "delivery", label: "Delivery" },
];

const STORAGE_KEY = "secto_admin_recent_orders";

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
    throw new Error(
      `Respuesta no JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
    );
  }

  if (!res.ok) {
    throw new Error(
      data?.error ||
        `HTTP ${res.status}: ${text.slice(0, 200)}`
    );
  }

  if (data?.ok === false) {
    throw new Error(data?.error || "La API respondió con error");
  }

  return data;
}

function formatMoney(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "-";

  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(value) {
  if (!value) return "-";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleString("es-UY", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function safeLoadRecentOrders() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function OrderSummary({ order }) {
  if (!order) return null;

  const source =
    SOURCE_OPTIONS.find((x) => x.id === order.source)?.label ||
    order.source ||
    "Sin origen";

  const method =
    METHOD_OPTIONS.find((x) => x.id === order.method)?.label ||
    order.method ||
    "-";

  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        padding: 12,
        display: "grid",
        gap: 8,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 800 }}>
            {order.customer || order.name || "Sin nombre"}
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.65,
              marginTop: 2,
            }}
          >
            {source} · {method}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800 }}>
            {order.total != null ? formatMoney(order.total) : "-"}
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.65,
              marginTop: 2,
            }}
          >
            {order.paid ? "PAGADO" : "A PAGAR"}
          </div>
        </div>
      </div>

      {order.rawText && (
        <div
          style={{
            whiteSpace: "pre-wrap",
            fontSize: 13,
            lineHeight: 1.45,
            background: "#f7f7f7",
            borderRadius: 8,
            padding: 10,
          }}
        >
          {order.rawText}
        </div>
      )}

      <div
        style={{
          fontSize: 12,
          opacity: 0.65,
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 12px",
        }}
      >
        {order.id && <span>ID: {order.id}</span>}
        {order.time && <span>Hora: {order.time}</span>}
        {order.createdAt && (
          <span>Creado: {formatDate(order.createdAt)}</span>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const [source, setSource] = useState("whatsapp");
  const [method, setMethod] = useState("pickup");
  const [customer, setCustomer] = useState("");
  const [rawText, setRawText] = useState("");
  const [total, setTotal] = useState("");
  const [paid, setPaid] = useState(false);
  const [time, setTime] = useState("ASAP");

  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  const [nextOrder, setNextOrder] = useState(null);
  const [recentOrders, setRecentOrders] = useState(() =>
    safeLoadRecentOrders()
  );

  const sourceLabel = useMemo(
    () =>
      SOURCE_OPTIONS.find((x) => x.id === source)?.label ||
      source,
    [source]
  );

  const totalNumber = total.trim() === "" ? null : Number(total);

  const totalIsValid =
    total.trim() === "" ||
    (Number.isFinite(totalNumber) && totalNumber >= 0);

  const canSubmit =
    rawText.trim().length > 0 &&
    totalIsValid &&
    !sending;

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(recentOrders.slice(0, 20))
      );
    } catch {
      // El historial local es auxiliar. Si falla, no interrumpe el Admin.
    }
  }, [recentOrders]);

  const pretty = (x) => {
    try {
      return JSON.stringify(x, null, 2);
    } catch {
      return String(x);
    }
  };

  const setMessage = (message, type = "") => {
    setStatus(message);
    setStatusType(type);
  };

  const ping = async () => {
    setChecking(true);
    setMessage("Pingeando…");

    try {
      const r = await post({ action: "ping" });

      setMessage(
        `PING OK\nbuildId: ${
          r?.buildId || "(sin buildId)"
        }\n\nRESP:\n${pretty(r)}`,
        "success"
      );
    } catch (e) {
      setMessage(
        "PING ERROR: " + (e?.message || String(e)),
        "error"
      );
    } finally {
      setChecking(false);
    }
  };

  const peekNext = async () => {
    setChecking(true);
    setMessage("Buscando próximo pedido sin imprimir…");

    try {
      const r = await post({ action: "next_unprinted" });

      if (r?.order?.id) {
        setNextOrder(r.order);

        setMessage(
          `NEXT UNPRINTED OK\nid: ${
            r.order.id
          }\nbuildId: ${
            r?.buildId || "(sin buildId)"
          }`,
          "success"
        );
      } else {
        setNextOrder(null);

        setMessage(
          `No hay pedidos pendientes de impresión.\nbuildId: ${
            r?.buildId || "(sin buildId)"
          }`,
          "success"
        );
      }
    } catch (e) {
      setNextOrder(null);

      setMessage(
        "NEXT ERROR: " + (e?.message || String(e)),
        "error"
      );
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;

    setSending(true);
    setMessage("Guardando pedido…");

    const createdAt = Date.now();

    const order = {
      source,
      customer: customer.trim() || sourceLabel,
      rawText: rawText.trim(),
      total: totalNumber,
      paid,
      method,
      time: time.trim() || "ASAP",
      createdAt,
      manual: true,
    };

    try {
      const r = await post({
        action: "new_order",
        order,
      });

      const id =
        r?.id ||
        r?.orderId ||
        r?.order?.id ||
        "(sin id)";

      const savedOrder = {
        ...order,
        id,
        wroteRow: r?.wroteRow,
        buildId: r?.buildId,
      };

      setRecentOrders((prev) =>
        [savedOrder, ...prev].slice(0, 20)
      );

      setMessage(
        `PEDIDO CREADO\nid: ${id} | wroteRow: ${
          r?.wroteRow ?? "(sin wroteRow)"
        } | buildId: ${
          r?.buildId || "(sin buildId)"
        }`,
        "success"
      );

      // Limpia el contenido del pedido pero conserva origen/método
      // para cargar varios pedidos seguidos más rápido.
      setCustomer("");
      setRawText("");
      setTotal("");
      setPaid(false);
      setTime("ASAP");
    } catch (e) {
      setMessage(
        "ERROR: " + (e?.message || String(e)),
        "error"
      );
    } finally {
      setSending(false);
    }
  };

  const clearForm = () => {
    setCustomer("");
    setRawText("");
    setTotal("");
    setPaid(false);
    setTime("ASAP");
    setMessage("");
  };

  const clearHistory = () => {
    setRecentOrders([]);

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // no-op
    }
  };

  const copyOrder = async (order) => {
    const text = [
      order.customer ? `Cliente: ${order.customer}` : null,
      order.rawText || null,
      order.total != null
        ? `Total: ${formatMoney(order.total)}`
        : null,
      order.paid ? "Pagado" : "A pagar",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Pedido copiado al portapapeles.", "success");
    } catch {
      setMessage(
        "No se pudo copiar automáticamente.",
        "error"
      );
    }
  };

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: 11,
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    font: "inherit",
  };

  const buttonStyle = {
    padding: "11px 14px",
    borderRadius: 10,
    border: "1px solid #ddd",
    cursor: "pointer",
    background: "#fff",
    font: "inherit",
  };

  return (
    <div
      style={{
        padding: 16,
        fontFamily: "system-ui, sans-serif",
        maxWidth: 860,
        margin: "0 auto",
        color: "#1a1a1a",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>
            SECTO — ADMIN
          </h1>

          <p
            style={{
              opacity: 0.65,
              margin: "6px 0 0",
              maxWidth: 620,
            }}
          >
            Carga manual de pedidos y control de la cola de impresión.
            Los pedidos web siguen entrando automáticamente.
          </p>
        </div>

        <div
          style={{
            fontSize: 12,
            opacity: 0.55,
            paddingTop: 5,
          }}
        >
          endpoint: {ENDPOINT}
        </div>
      </header>

      <main
        style={{
          display: "grid",
          gap: 20,
          marginTop: 20,
        }}
      >
        <section
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 16,
                  margin: 0,
                }}
              >
                NUEVO PEDIDO
              </h2>

              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  opacity: 0.6,
                }}
              >
                Para WhatsApp, teléfono, mostrador u otro ingreso manual.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
              }}
            >
              <label>
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.65,
                    marginBottom: 5,
                  }}
                >
                  Origen
                </div>

                <select
                  value={source}
                  onChange={(e) =>
                    setSource(e.target.value)
                  }
                  style={fieldStyle}
                >
                  {SOURCE_OPTIONS.map((option) => (
                    <option
                      key={option.id}
                      value={option.id}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.65,
                    marginBottom: 5,
                  }}
                >
                  Entrega
                </div>

                <select
                  value={method}
                  onChange={(e) =>
                    setMethod(e.target.value)
                  }
                  style={fieldStyle}
                >
                  {METHOD_OPTIONS.map((option) => (
                    <option
                      key={option.id}
                      value={option.id}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.65,
                    marginBottom: 5,
                  }}
                >
                  Horario
                </div>

                <input
                  value={time}
                  onChange={(e) =>
                    setTime(e.target.value)
                  }
                  placeholder="ASAP / 20:00"
                  style={fieldStyle}
                />
              </label>
            </div>

            <input
              placeholder="Cliente / nombre (opcional)"
              value={customer}
              onChange={(e) =>
                setCustomer(e.target.value)
              }
              style={fieldStyle}
            />

            <textarea
              placeholder={
                source === "whatsapp"
                  ? "Pegá el mensaje de WhatsApp acá"
                  : source === "phone"
                  ? "Escribí el pedido tomado por teléfono"
                  : source === "local"
                  ? "Escribí el pedido de mostrador"
                  : "Detalle del pedido"
              }
              value={rawText}
              onChange={(e) =>
                setRawText(e.target.value)
              }
              rows={8}
              style={{
                ...fieldStyle,
                resize: "vertical",
                lineHeight: 1.45,
              }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(160px, 1fr) auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <input
                  placeholder="Total (opcional)"
                  value={total}
                  onChange={(e) =>
                    setTotal(e.target.value)
                  }
                  inputMode="decimal"
                  style={{
                    ...fieldStyle,
                    borderColor: totalIsValid
                      ? "#ddd"
                      : "#c62828",
                  }}
                />

                {!totalIsValid && (
                  <div
                    style={{
                      color: "#c62828",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Ingresá un total válido.
                  </div>
                )}
              </div>

              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  whiteSpace: "nowrap",
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={paid}
                  onChange={(e) =>
                    setPaid(e.target.checked)
                  }
                />
                Ya pagó
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={submit}
                disabled={!canSubmit}
                style={{
                  ...buttonStyle,
                  flex: "1 1 260px",
                  fontWeight: 800,
                  background: canSubmit
                    ? "#111"
                    : "#f1f1f1",
                  color: canSubmit
                    ? "#fff"
                    : "#888",
                  cursor: canSubmit
                    ? "pointer"
                    : "not-allowed",
                }}
              >
                {sending
                  ? "Creando pedido…"
                  : `Crear pedido · ${sourceLabel}`}
              </button>

              <button
                onClick={clearForm}
                disabled={sending}
                style={{
                  ...buttonStyle,
                  cursor: sending
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                Limpiar
              </button>
            </div>

            {status && (
              <div
                style={{
                  borderRadius: 10,
                  padding: 11,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 12,
                  background:
                    statusType === "error"
                      ? "#fff4f4"
                      : statusType === "success"
                      ? "#f5faf5"
                      : "#f7f7f7",
                  border:
                    statusType === "error"
                      ? "1px solid #f0caca"
                      : "1px solid #e8e8e8",
                }}
              >
                {status}
              </div>
            )}
          </div>
        </section>

        {nextOrder && (
          <section>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <h2
                style={{
                  fontSize: 14,
                  margin: 0,
                }}
              >
                PRÓXIMO SIN IMPRIMIR
              </h2>

              <button
                onClick={() =>
                  copyOrder(nextOrder)
                }
                style={{
                  ...buttonStyle,
                  padding: "7px 10px",
                  fontSize: 12,
                }}
              >
                Copiar
              </button>
            </div>

            <OrderSummary order={nextOrder} />
          </section>
        )}

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 14,
                  margin: 0,
                }}
              >
                CREADOS DESDE ADMIN
              </h2>

              <div
                style={{
                  fontSize: 12,
                  opacity: 0.55,
                  marginTop: 3,
                }}
              >
                Últimos {recentOrders.length} guardados en este navegador.
              </div>
            </div>

            {recentOrders.length > 0 && (
              <button
                onClick={clearHistory}
                style={{
                  ...buttonStyle,
                  padding: "7px 10px",
                  fontSize: 12,
                }}
              >
                Limpiar historial
              </button>
            )}
          </div>

          {recentOrders.length === 0 ? (
            <div
              style={{
                border: "1px dashed #ddd",
                borderRadius: 12,
                padding: 18,
                fontSize: 13,
                opacity: 0.55,
                textAlign: "center",
              }}
            >
              Todavía no creaste pedidos desde este Admin.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {recentOrders.map((order, index) => (
                <div
                  key={`${order.id || "local"}-${order.createdAt || index}`}
                >
                  <OrderSummary order={order} />

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: 5,
                    }}
                  >
                    <button
                      onClick={() =>
                        copyOrder(order)
                      }
                      style={{
                        ...buttonStyle,
                        padding: "6px 9px",
                        fontSize: 12,
                      }}
                    >
                      Copiar pedido
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <details
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            DIAGNÓSTICO
          </summary>

          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 12,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                opacity: 0.6,
              }}
            >
              Herramientas técnicas. No son necesarias para cargar un pedido normal.
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={ping}
                disabled={checking}
                style={{
                  ...buttonStyle,
                  cursor: checking
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                Ping / buildId
              </button>

              <button
                onClick={peekNext}
                disabled={checking}
                style={{
                  ...buttonStyle,
                  cursor: checking
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                Ver próximo sin imprimir
              </button>
            </div>
          </div>
        </details>
      </main>
    </div>
  );
}

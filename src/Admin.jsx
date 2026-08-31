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

const CATALOG = [
  {
    id: "combos",
    name: "COMBOS",
    items: [
      { id: "c01", name: "Combo individual", price: 440 },
      { id: "c02", name: "Combo pareja", price: 860 },
      { id: "c03", name: "Combo doble", price: 650 },
      { id: "c04", name: "Combo triple", price: 930 },
      { id: "c05", name: "3x2 Phila hot roll", price: 760 },
    ],
  },
  {
    id: "pokes",
    name: "POKES",
    items: [
      { id: "poke-seitan-tonkatsu", name: "Seitan tonkatsu", price: 720 },
      { id: "poke-crispy-protein", name: "Crispy protein", price: 720 },
      { id: "poke-custom", name: "Armá tu poke", price: 690 },
    ],
  },
  {
    id: "rolls",
    name: "ROLLS 10 piezas",
    items: [
      { id: "r01", name: "Mango Roll", price: 350 },
      { id: "r02", name: "Green Roll", price: 350 },
      { id: "r03", name: "Philadelphia Roll", price: 350 },
      { id: "r04", name: "Philadelphia Hot Roll", price: 380 },
      { id: "r05", name: "Sweet Crunch", price: 380 },
      { id: "r06", name: "Tempura Veggie", price: 380 },
      { id: "r07", name: "Spicy carrot", price: 380 },
      { id: "r08", name: "Nori furai", price: 420 },
      { id: "r09", name: "Creamy Tomato", price: 380 },
      { id: "r10", name: "Teriyaki Roll", price: 420 },
    ],
  },
  {
    id: "acompañamientos",
    name: "ACOMPAÑAMIENTOS",
    items: [
      { id: "a01", name: "Gyozas fritas (veganas)", price: 215 },
    ],
  },
  {
    id: "extras",
    name: "EXTRAS",
    items: [
      { id: "e01", name: "Salsa de soja", price: 60 },
      { id: "e03", name: "Wasabi", price: 60 },
      { id: "e04", name: "Gari (Jengibre)", price: 60 },
    ],
  },
  {
    id: "bebidas",
    name: "BEBIDAS",
    items: [
      { id: "b03", name: "Coca Cola 600cc", price: 135 },
      { id: "b02", name: "Coca Cola Zero 600cc", price: 135 },
      { id: "b05", name: "Sprite 600cc", price: 135 },
      { id: "b06", name: "Sprite Zero 600cc", price: 135 },
    ],
  },
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
      data?.error || `HTTP ${res.status}: ${text.slice(0, 200)}`
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
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
            {source} · {method}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800 }}>
            {order.total != null ? formatMoney(order.total) : "-"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
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
        {order.createdAt && <span>Creado: {formatDate(order.createdAt)}</span>}
      </div>
    </div>
  );
}

export default function Admin() {
  const [source, setSource] = useState("whatsapp");
  const [method, setMethod] = useState("pickup");
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [paid, setPaid] = useState(false);
  const [time, setTime] = useState("ASAP");

  const [categoryId, setCategoryId] = useState(CATALOG[0].id);
  const [selectedItemId, setSelectedItemId] = useState(CATALOG[0].items[0].id);
  const [orderItems, setOrderItems] = useState([]);

  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");

  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  const [nextOrder, setNextOrder] = useState(null);
  const [recentOrders, setRecentOrders] = useState(() => safeLoadRecentOrders());

  const sourceLabel = useMemo(
    () => SOURCE_OPTIONS.find((x) => x.id === source)?.label || source,
    [source]
  );

  const selectedCategory = useMemo(
    () => CATALOG.find((cat) => cat.id === categoryId) || CATALOG[0],
    [categoryId]
  );

  const selectedCatalogItem = useMemo(
    () =>
      selectedCategory.items.find((item) => item.id === selectedItemId) ||
      selectedCategory.items[0],
    [selectedCategory, selectedItemId]
  );

  const total = useMemo(
    () =>
      orderItems.reduce(
        (sum, row) => sum + Number(row.price || 0) * Number(row.qty || 0),
        0
      ),
    [orderItems]
  );

  const rawText = useMemo(() => {
    const lines = orderItems.map(
      (row) =>
        `• ${row.name} x${row.qty} — ${formatMoney(row.price * row.qty)}`
    );

    if (notes.trim()) {
      lines.push("", `Notas: ${notes.trim()}`);
    }

    return lines.join("\n");
  }, [orderItems, notes]);

  const canSubmit = orderItems.length > 0 && !sending;

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(recentOrders.slice(0, 20))
      );
    } catch {
      // Historial auxiliar: si falla, no bloquea el Admin.
    }
  }, [recentOrders]);

  const setMessage = (message, type = "") => {
    setStatus(message);
    setStatusType(type);
  };

  const addItem = (item) => {
    if (!item) return;

    setOrderItems((prev) => {
      const found = prev.find((row) => row.id === item.id);

      if (found) {
        return prev.map((row) =>
          row.id === item.id
            ? { ...row, qty: row.qty + 1 }
            : row
        );
      }

      return [...prev, { ...item, qty: 1 }];
    });
  };

  const changeQty = (id, delta) => {
    setOrderItems((prev) =>
      prev
        .map((row) =>
          row.id === id
            ? { ...row, qty: Math.max(0, row.qty + delta) }
            : row
        )
        .filter((row) => row.qty > 0)
    );
  };

  const removeItem = (id) => {
    setOrderItems((prev) => prev.filter((row) => row.id !== id));
  };

  const addManualItem = () => {
    const price = Number(manualPrice);

    if (!manualName.trim() || !Number.isFinite(price) || price < 0) {
      setMessage("Completá nombre y precio válido del ítem manual.", "error");
      return;
    }

    addItem({
      id: `manual-${Date.now()}`,
      name: manualName.trim(),
      price,
    });

    setManualName("");
    setManualPrice("");
    setMessage("");
  };

  const ping = async () => {
    setChecking(true);
    setMessage("Pingeando…");

    try {
      const r = await post({ action: "ping" });
      setMessage(
        `PING OK\nbuildId: ${r?.buildId || "(sin buildId)"}`,
        "success"
      );
    } catch (e) {
      setMessage("PING ERROR: " + (e?.message || String(e)), "error");
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
          `NEXT UNPRINTED OK\nid: ${r.order.id}\nbuildId: ${
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
      setMessage("NEXT ERROR: " + (e?.message || String(e)), "error");
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
      rawText,
      total,
      paid,
      method,
      time: time.trim() || "ASAP",
      createdAt,
      manual: true,

      // Datos extra útiles para el Admin / futuras mejoras.
      // El backend actual puede ignorarlos sin afectar rawText/total.
      items: orderItems.map((row) => ({
        id: row.id,
        name: row.name,
        price: row.price,
        qty: row.qty,
      })),
      notes: notes.trim(),
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

      setRecentOrders((prev) => [savedOrder, ...prev].slice(0, 20));

      setMessage(
        `PEDIDO CREADO\nid: ${id} | total: ${formatMoney(total)} | wroteRow: ${
          r?.wroteRow ?? "(sin wroteRow)"
        } | buildId: ${r?.buildId || "(sin buildId)"}`,
        "success"
      );

      // Conservamos origen y entrega para cargar pedidos seguidos.
      setCustomer("");
      setNotes("");
      setPaid(false);
      setTime("ASAP");
      setOrderItems([]);
    } catch (e) {
      setMessage("ERROR: " + (e?.message || String(e)), "error");
    } finally {
      setSending(false);
    }
  };

  const clearForm = () => {
    setCustomer("");
    setNotes("");
    setPaid(false);
    setTime("ASAP");
    setOrderItems([]);
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
      order.total != null ? `Total: ${formatMoney(order.total)}` : null,
      order.paid ? "Pagado" : "A pagar",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Pedido copiado al portapapeles.", "success");
    } catch {
      setMessage("No se pudo copiar automáticamente.", "error");
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
        maxWidth: 900,
        margin: "0 auto",
        color: "#1a1a1a",
      }}
    >
      <header>
        <h1 style={{ margin: 0 }}>SECTO — ADMIN</h1>

        <p
          style={{
            opacity: 0.65,
            margin: "6px 0 0",
            maxWidth: 650,
          }}
        >
          Carga manual de pedidos. Elegí los productos y el total se calcula solo.
          Los pedidos web siguen entrando automáticamente.
        </p>
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
          <h2 style={{ fontSize: 16, margin: "0 0 14px" }}>
            NUEVO PEDIDO
          </h2>

          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
              }}
            >
              <label>
                <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 5 }}>
                  Origen
                </div>

                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  style={fieldStyle}
                >
                  {SOURCE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 5 }}>
                  Entrega
                </div>

                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  style={fieldStyle}
                >
                  {METHOD_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 5 }}>
                  Horario
                </div>

                <input
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="ASAP / 20:00"
                  style={fieldStyle}
                />
              </label>
            </div>

            <input
              placeholder="Cliente / nombre (opcional)"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              style={fieldStyle}
            />

            <div
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                padding: 12,
                display: "grid",
                gap: 10,
                background: "#fafafa",
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>
                  AGREGAR PRODUCTO
                </div>
                <div style={{ fontSize: 12, opacity: 0.55, marginTop: 3 }}>
                  Precio cargado automáticamente.
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(150px, .8fr) minmax(220px, 1.4fr) auto",
                  gap: 8,
                  alignItems: "end",
                }}
              >
                <label>
                  <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 5 }}>
                    Categoría
                  </div>

                  <select
                    value={categoryId}
                    onChange={(e) => {
                      const nextCategory =
                        CATALOG.find((cat) => cat.id === e.target.value) ||
                        CATALOG[0];

                      setCategoryId(nextCategory.id);
                      setSelectedItemId(nextCategory.items[0].id);
                    }}
                    style={fieldStyle}
                  >
                    {CATALOG.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 5 }}>
                    Producto
                  </div>

                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    style={fieldStyle}
                  >
                    {selectedCategory.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {formatMoney(item.price)}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => addItem(selectedCatalogItem)}
                  style={{
                    ...buttonStyle,
                    background: "#111",
                    color: "#fff",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  + Agregar
                </button>
              </div>

              <details>
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: 12,
                    opacity: 0.7,
                  }}
                >
                  Agregar ítem manual
                </summary>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 140px auto",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Nombre del ítem"
                    style={fieldStyle}
                  />

                  <input
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="Precio"
                    inputMode="decimal"
                    style={fieldStyle}
                  />

                  <button
                    type="button"
                    onClick={addManualItem}
                    style={buttonStyle}
                  >
                    Agregar
                  </button>
                </div>
              </details>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14 }}>
                  PEDIDO
                </div>

                <div style={{ fontWeight: 900, fontSize: 18 }}>
                  {formatMoney(total)}
                </div>
              </div>

              {orderItems.length === 0 ? (
                <div
                  style={{
                    border: "1px dashed #ddd",
                    borderRadius: 12,
                    padding: 18,
                    textAlign: "center",
                    fontSize: 13,
                    opacity: 0.55,
                  }}
                >
                  Todavía no agregaste productos.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {orderItems.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        border: "1px solid #e5e5e5",
                        borderRadius: 10,
                        padding: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>
                          {row.name}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                          {formatMoney(row.price)} c/u ·{" "}
                          {formatMoney(row.price * row.qty)}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => changeQty(row.id, -1)}
                          style={{
                            ...buttonStyle,
                            padding: "6px 10px",
                          }}
                        >
                          −
                        </button>

                        <strong
                          style={{
                            minWidth: 24,
                            textAlign: "center",
                          }}
                        >
                          {row.qty}
                        </strong>

                        <button
                          type="button"
                          onClick={() => changeQty(row.id, 1)}
                          style={{
                            ...buttonStyle,
                            padding: "6px 10px",
                          }}
                        >
                          +
                        </button>

                        <button
                          type="button"
                          aria-label={`Quitar ${row.name}`}
                          onClick={() => removeItem(row.id)}
                          style={{
                            ...buttonStyle,
                            padding: "6px 10px",
                            color: "#777",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <textarea
              placeholder="Notas del pedido, variantes, dirección, elección de rolls del combo, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              style={{
                ...fieldStyle,
                resize: "vertical",
                lineHeight: 1.45,
              }}
            />

            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
              />
              Ya pagó
            </label>

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
                  background: canSubmit ? "#111" : "#f1f1f1",
                  color: canSubmit ? "#fff" : "#888",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                }}
              >
                {sending
                  ? "Creando pedido…"
                  : `Crear pedido · ${formatMoney(total)}`}
              </button>

              <button
                onClick={clearForm}
                disabled={sending}
                style={buttonStyle}
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
              <h2 style={{ fontSize: 14, margin: 0 }}>
                PRÓXIMO SIN IMPRIMIR
              </h2>

              <button
                onClick={() => copyOrder(nextOrder)}
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
              <h2 style={{ fontSize: 14, margin: 0 }}>
                CREADOS DESDE ADMIN
              </h2>

              <div style={{ fontSize: 12, opacity: 0.55, marginTop: 3 }}>
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
            <div style={{ display: "grid", gap: 10 }}>
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
                      onClick={() => copyOrder(order)}
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
            <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
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
                style={buttonStyle}
              >
                Ping / buildId
              </button>

              <button
                onClick={peekNext}
                disabled={checking}
                style={buttonStyle}
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

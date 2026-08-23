import React, { useMemo, useReducer, useState, useRef, useEffect } from "react";

/**
 * Secto Café – Página de pedidos
 */

// ===== CONFIG =====
const PHONE_URUGUAY = "099079595";
const ORDERS_ENDPOINT = "/api/secto";

// Galería de fotos (opcional)
const GALLERY = [];

// ===== APERTURA =====
const TZ = "America/Montevideo";
const OPEN_DAYS = [1, 2, 3, 4, 5, 6];
const OPEN_HOUR_START = 12;
const OPEN_HOUR_END = 24;
const FORCE_OPEN = false;
const FORCE_CLOSED = false;

function getNowInTZ() {
  const now = new Date();

  const weekdayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(now);

  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[weekdayStr];

  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  }).format(now);

  const hour = Number(hourStr);

  return { day, hour };
}

function isOpenBySchedule() {
  const { day, hour } = getNowInTZ();
  return OPEN_DAYS.includes(day) && hour >= OPEN_HOUR_START && hour < OPEN_HOUR_END;
}

// ===== MENU =====
const MENU = [
   {
    id: "combos",
    name: "COMBOS",
    items: [
      { id: "c01", name: "Combo individual", price: 440, img: "/Photos/combo ind.jpeg"  },
      { id: "c02", name: "Combo pareja", price: 860, img: "/Photos/combo pareja.jpeg"  },
      { id: "c03", name: "Combo doble", price: 650, img: "/Photos/combo doble.jpeg"  },
      { id: "c04", name: "Combo triple", price: 930, img: "/Photos/combo triple.jpg"  },
      { id: "c05", name: "3x2 Phila hot roll", price: 760, img: "/Photos/3x2.jpg"  },
      
    ],
  },
  {
    id: "rolls",
    name: "ROLLS 10 piezas",
    items: [
      { id: "r01", name: "Mango Roll - Mango | Palta | Pepino | Sésamo | Mayo wasabi", price: 350, img: "/Photos/mango.jpg" },
      { id: "r02", name: "Green Roll - Palta | Pepino | Rúcula | Philadelphia vegano | Sésamo", price: 350, img: "/Photos/green.jpg" },
      { id: "r03", name: "Philadelphia Roll - Boniato | Palta | Philadelphia vegano | Sésamo", price: 350, img: "/Photos/phila.jpg" },
      { id: "r04", name: "Philadelphia Hot Roll - Boniato | Palta | Philadelphia vegano | Sésamo | Frito en panko | Taré | Verdeo", price: 380, img: "/Photos/hotroll.jpg" },
      { id: "r05", name: "Sweet Crunch - Boniato | Mango | Philadelphia vegano | Quinoa frita | Batayaki | Boniato frito", price: 380, img: "/Photos/sweet.jpg" },
      { id: "r06", name: "Tempura Veggie - Zucchini tempura | Palta | Philadelphia vegano | Sésamo | Verdeo", price: 380, img: "/Photos/tempura.jpg" },
      { id: "r07", name: "Spicy carrot - Boniato | Palta | Philadelphia vegano | Spicy carrot | Verdeo", price: 380, img: "/Photos/spicy.jpg" },
      { id: "r08", name: "Nori furai - Boniato | Palta | Spicy carrot | Verdeo | Sésamo", price: 420, img: "/Photos/nori.jpg" },
      { id: "r09", name: "Creamy Tomato - Tomate seco | Palta | Rúcula | Philadelphia vegano | Batayaki | Verdeo", price: 380, img: "/Photos/creamy.jpg" },
      { id: "r10", name: "Teriyaki Roll - Boniato tempura | Mango | Quinoa frita | Verdeo | Teriyaki", price: 420, img: "/Photos/teri.jpg" },
    ],
  },

  {
    id: "acompañamientos",
    name: "ACOMPAÑAMIENTOS",
    items: [
      { id: "a01", name: "Gyozas fritas (veganas)", price: 215, img: "/Photos/gyoza.JPG" },
    ],
  },
  
  {
    id: "extras",
    name: "EXTRAS",
    items: [
      { id: "e01", name: "Salsa de soja", price: 60, img: "/Photos/soja.jpeg" },
      { id: "e03", name: "Wasabi", price: 60, img: "/Photos/wasabi.jpeg" },
      { id: "e04", name: "Gari (Jengibre)", price: 60, img: "/Photos/gari.jpeg" },
    ],
  },
  {
    id: "bebidas",
    name: "BEBIDAS",
    items: [
      { id: "b03", name: "Coca Cola 600cc", price: 135, img: "/Photos/coca.png" },
      { id: "b02", name: "Coca Cola Zero 600cc", price: 135, img: "/Photos/coca zero.png" },
      { id: "b05", name: "Sprite 600cc", price: 135, img: "/Photos/sprite.png" },
       { id: "b06", name: "Sprite Zero 600cc", price: 135, img: "/Photos/sprite zero.png" },
    ],
  },
];

// ===== ZONAS =====
const ZONES = [
  { id: "cv", name: "Ciudad Vieja", fee: 0 },
  { id: "centro", name: "Centro / Cordón / Aguada", fee: 140 },
  { id: "pocitos", name: "Parque Rodó / Punta Carretas / Pocitos", fee: 220 },
  { id: "otras", name: "Otras zonas coordinar", fee: 300 },
];

// ===== HORARIOS =====
function buildHours(start = "12:00", end = "23:59", stepMin = 60) {
  const toMin = (h) => {
    const [H, M] = h.split(":").map(Number);
    return H * 60 + M;
  };

  const fromMin = (m) => {
    const H = String(Math.floor(m / 60)).padStart(2, "0");
    const M = String(m % 60).padStart(2, "0");
    return `${H}:${M}`;
  };

  const out = [];
  for (let m = toMin(start); m <= toMin(end); m += stepMin) {
    out.push(fromMin(m));
  }

  return out;
}

const HOURS = buildHours("12:00", "23:59", 60);

const COMBO_CONFIG = {
  c01: { rolls: 1, drinks: 1 },
  c02: { rolls: 2, drinks: 2 },
  c03: { rolls: 2, drinks: 0 },
  c04: { rolls: 3, drinks: 0 },
};

const ROLL_OPTIONS =
  MENU.find((cat) => cat.id === "rolls")?.items.map((item) => ({
    id: item.id,
    name: item.name.split(" - ")[0],
  })) || [];

const DRINK_OPTIONS =
  MENU.find((cat) => cat.id === "bebidas")?.items.map((item) => ({
    id: item.id,
    name: item.name,
  })) || [];

function getCurrentMinutesInTZ() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function futureHours() {
  const nowMin = getCurrentMinutesInTZ();
  return HOURS.filter((h) => {
    const [H, M] = h.split(":").map(Number);
    return H * 60 + M > nowMin;
  });
}

const currency = (uy) =>
  new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(uy);

// ===== CARRITO =====
function reducer(state, action) {
  const next = { ...state };

  if (action.type === "add") {
    const key = action.item.id;
    const delta = typeof action.qty === "number" && action.qty > 0 ? action.qty : 1;
    const qty = (state[key]?.qty || 0) + delta;
    next[key] = { item: action.item, qty };
  }

  if (action.type === "remove") {
    const key = action.item.id;
    const qty = Math.max(0, (state[key]?.qty || 0) - 1);

    if (qty > 0) next[key] = { item: action.item, qty };
    else delete next[key];
  }

  if (action.type === "clear") {
    return {};
  }

  return next;
}

function buildWhatsAppText(order) {
  const {
    items,
    subtotal,
    zone,
    fee,
    total,
    method,
    name,
    phone,
    address,
    notes,
    time,
    comboSelections = [],
    paid,
  } = order;

  const header = "Pedido Secto Cafe — " + new Date().toLocaleString("es-UY");

  const lines = items.map(
    ({ item, qty }) =>
      "• " + item.name + " x" + qty + " — " + currency(item.price * qty)
  );

  const comboLines = comboSelections.flatMap((combo) => {
    const details = [];
    if (combo.rolls?.length) details.push("Rolls: " + combo.rolls.join(" / "));
    if (combo.drinks?.length) details.push("Bebidas: " + combo.drinks.join(" / "));
    return details.length ? ["  ↳ " + combo.comboName + " — " + details.join(" · ")] : [];
  });

  const zona = ZONES.find((z) => z.id === zone)?.name || "";

  const info = [
    "Metodo: " + (method === "pickup" ? "Retiro en local" : "Delivery"),
    method === "delivery" ? "Zona: " + zona + " (" + currency(fee) + ")" : null,
    "Horario: " + (time === "asap" ? "Lo antes posible" : time),
    "Nombre: " + name,
    "Tel: " + phone,
    method === "delivery" ? "Direccion: " + address : null,
    notes ? "Notas: " + notes : null,
    paid ? "Estado: Pagado" : "Estado: A pagar",
  ].filter(Boolean);

  return [
    header,
    "",
    "Items:",
    ...lines,
    ...comboLines,
    "",
    "Subtotal: " + currency(subtotal),
    "Total: " + currency(total),
    ...info,
  ].join("\n");
}

export default function SectoCafePedidos() {
  const [cart, dispatch] = useReducer(reducer, {});
  const [method, setMethod] = useState("delivery");
  const [zone, setZone] = useState(ZONES[0].id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState("asap");
  const [comboSelections, setComboSelections] = useState({});

  const cartRef = useRef(null);
  const [cartHighlight, setCartHighlight] = useState(false);
  const [cartPeek, setCartPeek] = useState(false);
  const [sending, setSending] = useState(false);

  const items = useMemo(() => Object.values(cart), [cart]);


  const comboInstances = useMemo(() => {
    const result = [];
    items.forEach(({ item, qty }) => {
      const config = COMBO_CONFIG[item.id];
      if (!config) return;
      for (let i = 0; i < qty; i += 1) {
        result.push({ item, index: i, key: `${item.id}-${i}`, config });
      }
    });
    return result;
  }, [items]);

  const setComboChoice = (key, type, index, value) => {
    setComboSelections((prev) => {
      const current = prev[key] || { rolls: [], drinks: [] };
      const nextValues = [...(current[type] || [])];
      nextValues[index] = value;
      return {
        ...prev,
        [key]: {
          ...current,
          [type]: nextValues,
        },
      };
    });
  };

  const combosComplete = comboInstances.every(({ key, config }) => {
    const selection = comboSelections[key] || {};
    const rolls = selection.rolls || [];
    const drinks = selection.drinks || [];
    return (
      rolls.slice(0, config.rolls).filter(Boolean).length === config.rolls &&
      drinks.slice(0, config.drinks).filter(Boolean).length === config.drinks
    );
  });

  const subtotal = useMemo(
    () => items.reduce((s, { item, qty }) => s + item.price * qty, 0),
    [items]
  );

  const fee = useMemo(
    () => (method === "delivery" ? ZONES.find((z) => z.id === zone)?.fee || 0 : 0),
    [method, zone]
  );

  const total = subtotal + fee;

  const scheduleOpen = isOpenBySchedule();

  const isOpen =
    (FORCE_OPEN && !FORCE_CLOSED) ||
    (!FORCE_CLOSED && scheduleOpen);

  const canSend =
    subtotal > 0 &&
    name &&
    phone &&
    time &&
    combosComplete &&
    (method === "pickup" || address || zone === "cv");

  const canSendNow = canSend && isOpen && !sending;

  const showCartPeek = () => {
    setCartPeek(true);
  };

  const getOrder = (extra = {}) => ({
    items,
    subtotal,
    zone,
    fee,
    total,
    method,
    name,
    phone,
    address,
    notes,
    time,
    comboSelections: comboInstances.map(({ item, key }) => {
      const selection = comboSelections[key] || {};
      return {
        comboId: item.id,
        comboName: item.name,
        rolls: (selection.rolls || []).map(
          (id) => ROLL_OPTIONS.find((r) => r.id === id)?.name || id
        ),
        drinks: (selection.drinks || []).map(
          (id) => DRINK_OPTIONS.find((d) => d.id === id)?.name || id
        ),
      };
    }),
    ...extra,
  });

  const getWhatsAppUrl = (order) => {
    const text = buildWhatsAppText(order);
    const encoded = encodeURIComponent(text);
    const phoneDigits = PHONE_URUGUAY.replace(/\D/g, "");
    return "https://wa.me/598" + phoneDigits + "?text=" + encoded;
  };

  const openWhatsAppWithOrder = (order) => {
    window.location.href = getWhatsAppUrl(order);
  };

  useEffect(() => {
    if (items.length === 0) {
      setCartPeek(false);
    }
  }, [items.length]);

  const sendOrder = async (paid = false) => {
    if (!canSendNow) {
      alert("Revisá los datos del pedido. Completá nombre, teléfono, dirección/zona y todas las opciones de los combos.");
      return;
    }

    const order = getOrder({
      paid,
      createdAt: Date.now(),
      source: "web",
    });

    try {
      setSending(true);

      const res = await fetch(ORDERS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "new_order",
          order,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "No se pudo guardar el pedido");
      }

      openWhatsAppWithOrder({
        ...order,
        id: data?.id || order.id,
      });
    } catch (err) {
      alert("No se pudo registrar el pedido para impresión: " + (err?.message || err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-800">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" aria-label="Inicio Secto Cafe">
              <img
                src="/logo-secto.png"
                alt="Secto Cafe"
                className="h-10 w-auto max-w-[140px] object-contain"
              />
            </a>

            <div className="leading-tight">
              <p className="text-xs tracking-[0.25em] text-neutral-500">
                {isOpen
                  ? "Sushi vegano — pedidos de 12:00 a 00:00"
                  : "Sushi vegano — pedidos abiertos lunes a sábado de 12:00 a 00:00"}
              </p>
              <h1 className="text-lg text-neutral-900"></h1>
            </div>
          </div>

          <div className="hidden sm:block text-sm text-neutral-500">
            SECTO CAFE — Piedras 276
          </div>
        </div>
      </header>

      {GALLERY?.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pt-6">
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
            {GALLERY.map((src, i) => (
              <img
                key={i}
                src={src}
                alt="Secto Café"
                className="mb-4 w-full rounded-2xl border border-neutral-900 object-cover hover:opacity-90 transition"
              />
            ))}
          </div>
        </section>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-8">
          {MENU.map((cat) => (
            <div key={cat.id}>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm tracking-[0.2em] text-neutral-500">
                  {cat.name}
                </h2>
                <span className="h-[1px] flex-1 ml-4 bg-neutral-200"></span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cat.items.map((item) => (
                  <article
                    key={item.id}
                    className="group border border-neutral-200 rounded-2xl overflow-hidden bg-white"
                  >
                    {typeof item.img === "string" && item.img.trim().length > 0 ? (
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={item.img}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ) : null}

                    <div className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-neutral-900 leading-tight">
                          {item.name}
                        </h3>
                        <p className="text-sm text-neutral-500 mt-1">
                          {currency(item.price)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => dispatch({ type: "remove", item })}
                          className="px-3 py-2 rounded-xl border border-neutral-200"
                        >
                          -
                        </button>

                        <span className="w-6 text-center text-neutral-600">
                          {cart[item.id]?.qty || 0}
                        </span>

                        <button
                          onClick={() => {
                            dispatch({ type: "add", item });
                            showCartPeek();
                            setCartHighlight(true);
                            setTimeout(() => setCartHighlight(false), 600);
                          }}
                          className={`px-3 py-2 rounded-xl border ${
                            isOpen
                              ? "border-neutral-200 bg-neutral-50"
                              : "border-neutral-200 text-neutral-400 cursor-not-allowed"
                          }`}
                          disabled={!isOpen}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>

        <aside className="lg:col-span-1">
          <div
            ref={cartRef}
            className={
              "border border-neutral-200 rounded-2xl p-4 sticky top-20 bg-white transition-shadow " +
              (cartHighlight ? "shadow-[0_0_0_1px_rgba(0,0,0,0.6)]" : "")
            }
          >
            <h2 className="text-sm tracking-[0.2em] text-neutral-500">
              TU PEDIDO
            </h2>

            <div className="space-y-3 max-h-[45vh] overflow-auto pr-1 mt-1">
              {items.length === 0 && (
                <p className="text-sm text-neutral-500">
                  Agregá items del catálogo
                </p>
              )}

              {items.map(({ item, qty }) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="pr-2">
                    <p className="text-neutral-800">{item.name}</p>
                    <p className="text-neutral-500">x{qty}</p>
                  </div>

                  <div className="text-neutral-700">
                    {currency(item.price * qty)}
                  </div>
                </div>
              ))}
            </div>


            {comboInstances.length > 0 && (
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="text-xs tracking-[0.16em] text-neutral-500">
                    ELEGÍ TU COMBO
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Completá las opciones de cada combo antes de enviar.
                  </p>
                </div>

                {comboInstances.map(({ item, index, key, config }) => {
                  const selection = comboSelections[key] || { rolls: [], drinks: [] };

                  return (
                    <div key={key} className="rounded-xl border border-neutral-200 p-3 space-y-2">
                      <div className="text-sm font-medium text-neutral-800">
                        {item.name}{cart[item.id]?.qty > 1 ? ` #${index + 1}` : ""}
                      </div>

                      {Array.from({ length: config.rolls }).map((_, rollIndex) => (
                        <select
                          key={`roll-${rollIndex}`}
                          value={selection.rolls?.[rollIndex] || ""}
                          onChange={(e) =>
                            setComboChoice(key, "rolls", rollIndex, e.target.value)
                          }
                          className="w-full bg-white border border-neutral-200 rounded-xl p-2 text-sm"
                        >
                          <option value="">Elegí roll {rollIndex + 1}</option>
                          {ROLL_OPTIONS.map((roll) => (
                            <option key={roll.id} value={roll.id}>
                              {roll.name}
                            </option>
                          ))}
                        </select>
                      ))}

                      {Array.from({ length: config.drinks }).map((_, drinkIndex) => (
                        <select
                          key={`drink-${drinkIndex}`}
                          value={selection.drinks?.[drinkIndex] || ""}
                          onChange={(e) =>
                            setComboChoice(key, "drinks", drinkIndex, e.target.value)
                          }
                          className="w-full bg-white border border-neutral-200 rounded-xl p-2 text-sm"
                        >
                          <option value="">Elegí bebida {drinkIndex + 1}</option>
                          {DRINK_OPTIONS.map((drink) => (
                            <option key={drink.id} value={drink.id}>
                              {drink.name}
                            </option>
                          ))}
                        </select>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            <hr className="my-4 border-neutral-200" />

            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <button
                className={`rounded-xl p-2 border ${
                  method === "delivery"
                    ? "bg-neutral-100 border-neutral-300"
                    : "border-neutral-200"
                }`}
                onClick={() => setMethod("delivery")}
              >
                Delivery
              </button>

              <button
                className={`rounded-xl p-2 border ${
                  method === "pickup"
                    ? "bg-neutral-100 border-neutral-300"
                    : "border-neutral-200"
                }`}
                onClick={() => setMethod("pickup")}
              >
                Retiro
              </button>
            </div>

            {method === "delivery" && (
              <div className="space-y-2">
                <label className="text-xs text-neutral-500">
                  Zona de entrega
                </label>

                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl p-2"
                >
                  {ZONES.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} — {currency(z.fee)}
                    </option>
                  ))}
                </select>

                <label className="text-xs text-neutral-500">
                  Dirección
                </label>

                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, número, apto, referencia"
                  className="w-full bg-white border border-neutral-200 rounded-xl p-2 placeholder-neutral-400"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <label className="text-xs text-neutral-500">Nombre</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full bg-white border border-neutral-200 rounded-xl p-2 placeholder-neutral-400"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500">Teléfono</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xxxxxxx"
                  className="w-full bg-white border border-neutral-200 rounded-xl p-2 placeholder-neutral-400"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs text-neutral-500">¿Cuándo lo querés?</label>

              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={!isOpen}
                className="w-full bg-white border border-neutral-200 rounded-xl p-2 disabled:bg-neutral-100 disabled:text-neutral-500"
              >
                {isOpen ? (
                  <>
                    <option value="asap">Lo antes posible</option>
                    {futureHours().map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </>
                ) : (
                  <option value="">Pedidos cerrados</option>
                )}
              </select>
            </div>

            <div className="mt-3">
              <label className="text-xs text-neutral-500">Notas</label>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Timbre roto, indicaciones de entrega, etc."
                className="w-full bg-white border border-neutral-200 rounded-xl p-2 placeholder-neutral-400"
                rows={2}
              />
            </div>

            <div className="text-sm space-y-1 mt-4">
              <div className="flex justify-between">
                <span className="text-neutral-500">Subtotal</span>
                <span>{currency(subtotal)}</span>
              </div>

              {method === "delivery" && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Envío</span>
                  <span>{currency(fee)}</span>
                </div>
              )}

              <div className="flex justify-between text-neutral-900 font-medium">
                <span>Total</span>
                <span>{currency(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 mt-4">
              <button
                onClick={() => sendOrder(false)}
                disabled={!canSendNow}
                className={`w-full rounded-2xl py-3 text-center ${
                  canSendNow
                    ? "bg-black text-white"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {sending ? "Registrando pedido..." : "Enviar pedido por WhatsApp"}
              </button>

              <button
                onClick={() => { dispatch({ type: "clear" }); setComboSelections({}); }}
                className="w-full rounded-2xl py-2 text-sm border border-neutral-200"
              >
                Vaciar carrito
              </button>

              {!isOpen && (
                <p className="text-xs text-red-600 mt-1">
                  Cerrado — pedidos habilitados lunes a sábado de 12:00 a 00:00.
                </p>
              )}

              <p className="text-xs text-neutral-500 mt-1">
                Pagás por transferencia o al recibir (efectivo | POS).
              </p>
            </div>
          </div>
        </aside>
      </main>

      {items.length > 0 && (
        <div
          className={
            "fixed right-3 top-24 z-50 w-[340px] max-w-[90vw] rounded-2xl border border-neutral-200 bg-white shadow-lg p-4 transition-transform duration-300 " +
            (cartPeek ? "translate-x-0" : "translate-x-[120%]")
          }
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm tracking-[0.2em] text-neutral-500">
                TU PEDIDO
              </div>
              <div className="text-xs text-neutral-400 mt-1">
                Elegí si querés seguir agregando o completar los datos
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCartPeek(false)}
              className="text-sm border border-neutral-200 rounded-xl px-2 py-1 text-neutral-500"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 max-h-[34vh] overflow-auto pr-1">
            <div className="space-y-2">
              {items.map(({ item, qty }) => (
                <div key={item.id} className="flex justify-between gap-3 text-sm">
                  <div className="text-neutral-800 leading-tight">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-neutral-500">x{qty}</div>
                  </div>

                  <div className="text-neutral-700 whitespace-nowrap">
                    {currency(item.price * qty)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-neutral-200 text-sm space-y-3">
            <div className="flex justify-between">
              <span className="text-neutral-500">Total</span>
              <span className="text-neutral-900 font-medium">
                {currency(total)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setCartPeek(false)}
                className="w-full rounded-2xl py-2 border border-neutral-200 text-sm"
              >
                Seguir comprando
              </button>

              <button
                type="button"
                onClick={() => {
                  setCartPeek(false);
                  if (cartRef.current) {
                    cartRef.current.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }
                }}
                className="w-full rounded-2xl py-3 text-center bg-black text-white"
              >
                Enviar pedido
              </button>
            </div>

            <p className="text-[11px] text-neutral-500">
              Vas a completar nombre, teléfono y dirección antes de enviarlo.
            </p>
          </div>
        </div>
      )}

      {items.length > 0 && !cartPeek && (
        <button
          type="button"
          onClick={() => setCartPeek(true)}
          className="fixed right-3 top-24 z-40 rounded-2xl bg-black text-white px-4 py-3 shadow-lg text-sm"
        >
          Tu pedido · {currency(total)}
        </button>
      )}

      <footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-neutral-500">
        <hr className="border-neutral-200 mb-4" />
        © {new Date().getFullYear()} - Secto Cafe · Lun - Sab | 12hs - 00hs
      </footer>
    </div>
  );
}

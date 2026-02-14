import React, { useMemo, useReducer, useState, useRef, useEffect } from "react";

/**
 * Secto Café – Página de pedidos
 */

// ===== CONFIG =====
const PHONE_URUGUAY = "099079595"; // WhatsApp sin +598

// URL buena (web app /exec)
const MP_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxrWgSPWPjDqelx1-_iaxvjDLW7ZL6W647UsZVm-ZaxREwY7E4MiQHNOvyNPXXbmHpQzA/exec";

// Usamos el mismo endpoint para cola de impresión
const ORDERS_ENDPOINT = MP_ENDPOINT;

// Galería de fotos (opcional)
const GALLERY = [];

// Foto para la sección POKES
const POKE_IMAGE = "/Photos/10.jpg";

// ===== APERTURA =====
const TZ = "America/Montevideo";
const OPEN_DAYS = [1, 2, 3, 4, 5, 6]; // 0=Dom, 1=Lun, ...
const OPEN_HOUR_START = 11;
const OPEN_HOUR_END = 15;
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
  const isOpenDay = OPEN_DAYS.includes(day);
  const isOpenHour = hour >= OPEN_HOUR_START && hour < OPEN_HOUR_END;
  return isOpenDay && isOpenHour;
}

// ===== MENU =====
const MENU = [
  {
    id: "rolls",
    name: "ROLLS 10 piezas",
    items: [
      { id: "r01", name: "01 - Salmón | Palta | Queso", price: 440, img: "/Photos/01.JPG" },
      { id: "r02", name: "02 - Atún | Palta | Queso", price: 440, img: "/Photos/02.JPG" },
      { id: "r03", name: "03 - Atún | Mango | Pepino | Cilantro", price: 460, img: "/Photos/03.JPG" },
      { id: "r04", name: "04 - Salmón | Mango | Ciboulette | Queso | Quinoa frita", price: 460, img: "/Photos/04.JPG" },
      { id: "r05", name: "05 - Tomate seco | Palta | Rúcula | Queso", price: 460, img: "/Photos/05.JPG" },
      { id: "r06", name: "06 - Langostino | Mango | Queso | Praline | Sweet chilli", price: 480, img: "/Photos/06.JPG" },
      { id: "r07", name: "07 - Salmón | Palta | Mayo spicy | Verdeo", price: 480, img: "/Photos/07.JPG" },
      { id: "r08", name: "08 - Boniato | Palta | Ciboulette | Quinoa frita", price: 440, img: "/Photos/08.JPG" },
      { id: "r09", name: "09 - Langostinos | Palta | Queso", price: 440, img: "/Photos/09.JPG" },
    ],
  },
  {
    id: "temakis",
    name: "TEMAKI 1 pieza",
    items: [{ id: "t01", name: "Salmón | Palta | Queso | Pepino | Sésamo", price: 260, img: "/Photos/11.jpg" }],
  },
  {
    id: "onigirazu",
    name: "ONIGIRAZU",
    items: [{ id: "s01", name: "Tuna mayo | Palta | Zanahoria | Pepino | Repollo | Verdeo", price: 420, img: "/Photos/12.jpg" }],
  },
  {
    id: "combos",
    name: "COMBINADOS",
    items: [
      { id: "c01", name: "Combinado 14 piezas", price: 680 },
      { id: "c02", name: "Combinado 24 piezas", price: 1100 },
      { id: "c03", name: "Combinado 36 piezas", price: 1580 },
    ],
  },
  {
    id: "extras",
    name: "EXTRAS",
    items: [
      { id: "e01", name: "Salsa de soja (1 incluida)", price: 30 },
      { id: "e02", name: "Teriyaki", price: 40 },
      { id: "e03", name: "Wasabi", price: 40 },
      { id: "e04", name: "Gari (Jengibre)", price: 40 },
      { id: "e05", name: "Sweet chilli", price: 60 },
    ],
  },
  {
    id: "bebidas",
    name: "BEBIDAS",
    items: [
      { id: "b01", name: "Agua Salus sin gas 600cc", price: 100 },
      { id: "b02", name: "Agua Salus con gas 600cc", price: 100 },
      { id: "b03", name: "Lata Pepsi 600cc", price: 100 },
      { id: "b04", name: "Lata Pepsi black 600cc", price: 100 },
    ],
  },
];

// ===== ZONAS =====
const ZONES = [
  { id: "cv", name: "Ciudad Vieja", fee: 0 },
  { id: "centro", name: "Centro / Cordón / Aguada", fee: 170 },
  { id: "pocitos", name: "Parque Rodó / Punta Carretas / Pocitos", fee: 220 },
  { id: "otras", name: "Otras zonas coordinar", fee: 270 },
];

// ✅ Horarios cada 30 min (incluye 12:30, 13:30, etc.)
function buildHours(start = "12:00", end = "15:00", stepMin = 30) {
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
  for (let m = toMin(start); m <= toMin(end); m += stepMin) out.push(fromMin(m));
  return out;
}
const HOURS = buildHours("12:00", "15:00", 30);

const currency = (uy) =>
  new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" }).format(uy);

// ===== CARRITO =====
function reducer(state, action) {
  const next = { ...state };
  if (action.type === "add") {
    const key = action.item.id;
    const delta = typeof action.qty === "number" && action.qty > 0 ? action.qty : 1;
    const qty = (state[key]?.qty || 0) + delta;
    next[key] = { item: action.item, qty };
  } else if (action.type === "remove") {
    const key = action.item.id;
    const qty = Math.max(0, (state[key]?.qty || 0) - 1);
    if (qty > 0) next[key] = { item: action.item, qty };
    else delete next[key];
  } else if (action.type === "clear") {
    return {};
  }
  return next;
}

function buildWhatsAppText(order) {
  const { items, subtotal, zone, fee, total, method, name, phone, address, notes, time, paid } = order;
  const header = "Pedido Secto Cafe — " + new Date().toLocaleString("es-UY");
  const lines = items.map(({ item, qty }) => "• " + item.name + " x" + qty + " — " + currency(item.price * qty));
  const zona = ZONES.find((z) => z.id === zone)?.name || "";
  const info = [
    "Metodo: " + (method === "pickup" ? "Retiro en local" : "Delivery"),
    method === "delivery" ? "Zona: " + zona + " (" + currency(fee) + ")" : null,
    "Horario: " + (time || "(no especificado)"),
    "Nombre: " + name,
    "Tel: " + phone,
    method === "delivery" ? "Direccion: " + address : null,
    notes ? "Notas: " + notes : null,
    paid ? "Estado: Pagado (Mercado Pago)" : "Estado: A pagar al recibir",
  ].filter(Boolean);

  return [
    header,
    "",
    "Items:",
    ...lines,
    "",
    "Subtotal: " + currency(subtotal),
    "Total: " + currency(total),
    ...info,
  ].join("\n");
}

// ===== POKES =====
const POKE_BASE_PRICE = 440;
const POKE_EXTRA_PROTEIN = 80;
const POKE_EXTRA_TOPPING = 40;
const POKE_EXTRA_SAUCE = 40;

const POKE_BASES = ["Arroz de sushi", "Arroz sin aderezar", "Mix de verdes"];

const POKE_PROTEINS = [
  "Langostinos",
  "Salmón",
  "Salmón spicy",
  "Tuna mayo",
  "Tuna mayo spicy",
  "Atún rojo",
  "Garbanzos",
  "Tofu",
];

const POKE_TOPPINGS = [
  "Palta",
  "Queso crema",
  "Cebolla morada",
  "Zanahoria",
  "Cherrys",
  "Pepino",
  "Cebolla de verdeo",
  "Choclo",
  "Repollo",
  "Cilantro",
  "Alga nori",
  "Cebolla crispy",
  "Maíz frito",
  "Sésamo",
];

const POKE_SAUCES = ["Soja", "Teriyaki", "Taré", "Alioli", "Maracuyá", "Spicy mayo", "Mayo de wasabi", "Sriracha"];

function PokeBuilder({ onAdd, isOpen }) {
  const [base, setBase] = useState("");
  const [proteins, setProteins] = useState([]);
  const [toppings, setToppings] = useState([]);
  const [sauces, setSauces] = useState([]);
  const [feedback, setFeedback] = useState("");

  const toggleInArray = (value, setFn) => {
    setFn((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  };

  const extraProteins = Math.max(0, proteins.length - 1);

  // ✅ Sésamo gratis: no cuenta para el cálculo de extras
  const chargeableToppingsCount = toppings.filter((t) => t !== "Sésamo").length;
  const extraToppings = Math.max(0, chargeableToppingsCount - 3);

  const extraSauces = Math.max(0, sauces.length - 1);

  const unitPrice =
    POKE_BASE_PRICE +
    extraProteins * POKE_EXTRA_PROTEIN +
    extraToppings * POKE_EXTRA_TOPPING +
    extraSauces * POKE_EXTRA_SAUCE;

  // ✅ exige salsa
  const canAdd = Boolean(base) && proteins.length >= 1 && toppings.length >= 3 && sauces.length >= 1;

  const handleAdd = () => {
    // ✅ feedback claro si falta algo (especialmente salsa)
    if (!base) return setFeedback("Elegí una base");
    if (proteins.length < 1) return setFeedback("Elegí al menos 1 proteína");
    if (toppings.length < 3) return setFeedback("Elegí al menos 3 toppings");
    if (sauces.length < 1) return setFeedback("Elegí al menos 1 salsa");

    const description =
      "Poke personalizado — Base: " +
      base +
      " | Proteínas: " +
      proteins.join(", ") +
      " | Toppings: " +
      toppings.join(", ") +
      " | Salsas: " +
      sauces.join(", ");

    const item = { id: "poke-" + Date.now(), name: description, price: unitPrice };
    onAdd(item, 1);

    setBase("");
    setProteins([]);
    setToppings([]);
    setSauces([]);

    setFeedback("Poke agregado al pedido");
    setTimeout(() => setFeedback(""), 1500);
  };

  return (
    <section className="mb-10 border border-neutral-200 rounded-2xl p-4 bg-white">
      {typeof POKE_IMAGE === "string" && POKE_IMAGE.trim().length > 0 && (
        <div className="mb-4 aspect-[4/3] overflow-hidden rounded-xl border border-neutral-200">
          <img src={POKE_IMAGE} alt="Poke" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>
      )}

      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm tracking-[0.2em] text-neutral-500">POKES — ARMA TU BOWL</h2>
        <div className="text-right">
          <p className="text-xs text-neutral-500">Desde {currency(POKE_BASE_PRICE)}</p>
          <p className="text-[11px] text-neutral-400">Precio actual: {currency(unitPrice)}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs text-neutral-500 uppercase tracking-[0.15em]">Base (x1 incluida)</p>
          <div className="space-y-1">
            {POKE_BASES.map((b) => (
              <label key={b} className="flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="radio"
                  name="poke-base"
                  value={b}
                  checked={base === b}
                  onChange={() => setBase(b)}
                  className="accent-black"
                />
                <span>{b}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-neutral-500 uppercase tracking-[0.15em]">
            Proteínas (x1 incluida, extra {currency(POKE_EXTRA_PROTEIN)})
          </p>
          <div className="flex flex-wrap gap-2">
            {POKE_PROTEINS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => toggleInArray(p, setProteins)}
                className={
                  "text-xs border rounded-xl px-3 py-1 " +
                  (proteins.includes(p)
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "border-neutral-200 text-neutral-700")
                }
              >
                {p}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500">
            Elegidas: {proteins.length} (extras: {extraProteins})
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <p className="text-xs text-neutral-500 uppercase tracking-[0.15em]">
            Toppings (x3 incluidos, extra {currency(POKE_EXTRA_TOPPING)})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {POKE_TOPPINGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleInArray(t, setToppings)}
                className={
                  "text-xs border rounded-xl px-2 py-1 text-left " +
                  (toppings.includes(t)
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "border-neutral-200 text-neutral-700")
                }
              >
                {t === "Sésamo" ? "Sésamo (gratis)" : t}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500">
            Elegidos: {toppings.length} (extras: {extraToppings})
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <p className="text-xs text-neutral-500 uppercase tracking-[0.15em]">
            Salsas (x1 incluida, extra {currency(POKE_EXTRA_SAUCE)})
          </p>
          <div className="flex flex-wrap gap-2">
            {POKE_SAUCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleInArray(s, setSauces)}
                className={
                  "text-xs border rounded-xl px-3 py-1 " +
                  (sauces.includes(s)
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "border-neutral-200 text-neutral-700")
                }
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500">
            Elegidas: {sauces.length} (extras: {Math.max(0, sauces.length - 1)})
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd || !isOpen}
          className={
            "rounded-2xl px-4 py-2 text-sm " +
            (canAdd && isOpen ? "bg-black text-white" : "bg-neutral-100 text-neutral-400 cursor-not-allowed")
          }
        >
          Agregar poke al pedido
        </button>
        {feedback && <p className="text-[11px] text-neutral-500">{feedback}</p>}
      </div>

      {!isOpen && (
        <p className="mt-2 text-[11px] text-red-600">
          Cerrado — pedidos habilitados lunes a sábado de {OPEN_HOUR_START}:00 a {OPEN_HOUR_END}:00 (hora Montevideo).
        </p>
      )}
    </section>
  );
}

export default function SectoCafePedidos() {
  const [cart, dispatch] = useReducer(reducer, {});
  const [method, setMethod] = useState("delivery");
  const [zone, setZone] = useState(ZONES[0].id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState("");

  const cartRef = useRef(null);
  const [cartHighlight, setCartHighlight] = useState(false);

  // ✅ cart peek (slide-in)
  const [cartPeek, setCartPeek] = useState(false);
  const cartPeekT = useRef(null);
  const showCartPeek = () => {
    setCartPeek(true);
    if (cartPeekT.current) clearTimeout(cartPeekT.current);
    cartPeekT.current = setTimeout(() => setCartPeek(false), 2200);
  };

  const items = useMemo(() => Object.values(cart), [cart]);
  const subtotal = useMemo(() => items.reduce((s, { item, qty }) => s + item.price * qty, 0), [items]);
  const fee = useMemo(() => (method === "delivery" ? ZONES.find((z) => z.id === zone)?.fee || 0 : 0), [method, zone]);
  const total = subtotal + fee;

  const canSend = subtotal > 0 && name && phone && (method === "pickup" || address || zone === "cv");
  const hasMP = typeof MP_ENDPOINT === "string" && MP_ENDPOINT.trim().length > 0;

  const scheduleOpen = isOpenBySchedule();
  const isOpen = (FORCE_OPEN && !FORCE_CLOSED) || (!FORCE_CLOSED && scheduleOpen);
  const canSendNow = canSend && isOpen;

  const pokeCount = useMemo(
    () =>
      items.reduce((n, { item, qty }) => (item.id && item.id.toString().startsWith("poke-") ? n + qty : n), 0),
    [items]
  );

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
    ...extra,
  });

  // ✅ Safari-safe WhatsApp
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
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const mp = params.get("mp");
    if (mp !== "success") return;

    const raw = sessionStorage.getItem("secto_order");
    if (!raw) return;

    let order;
    try {
      order = JSON.parse(raw);
    } catch {
      return;
    }

    const paidOrder = { ...order, paid: true, createdAt: Date.now() };

    fetch(ORDERS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "new_order", order: paidOrder }),
      keepalive: true,
    }).catch(() => {});

    openWhatsAppWithOrder(paidOrder);

    sessionStorage.removeItem("secto_order");
    params.delete("mp");
    const cleanUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState({}, "", cleanUrl);
  }, []);

  const sendOrder = (paid = false) => {
    if (!canSendNow) {
      alert("Te falta completar datos (nombre, teléfono y dirección/zona) o el local está cerrado.");
      return;
    }

    const order = getOrder({ paid, createdAt: Date.now() });

    // 1) abrir WA YA (gesto del usuario)
    openWhatsAppWithOrder(order);

    // 2) guardar en background
    fetch(ORDERS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "new_order", order }),
      keepalive: true,
    }).catch(() => {});
  };

  const payWithMP = () => {
    if (!hasMP) return;
    if (!canSendNow) {
      alert("Te falta completar datos (nombre, teléfono y dirección/zona) o el local está cerrado.");
      return;
    }

    const order = getOrder({ paid: false, createdAt: Date.now() });

    sessionStorage.setItem("secto_order", JSON.stringify(order));

    const payload = {
      items: order.items.map(({ item, qty }) => ({
        title: item.name,
        unit_price: item.price,
        quantity: qty,
      })),
      total: order.total,
      name: order.name,
      phone: order.phone,
      method: order.method,
      zone: order.zone,
      address: order.address,
      notes: order.notes,
      time: order.time,
      back_urls: {
        success: window.location.origin + "?mp=success",
        failure: window.location.origin + "?mp=failure",
      },
    };

    const form = document.createElement("form");
    form.method = "POST";
    form.action = MP_ENDPOINT;
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "data";
    input.value = JSON.stringify(payload);

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div className="min-h-screen bg-white text-neutral-800">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" aria-label="Inicio Secto Cafe">
              <img src="/logo-secto.png" alt="Secto Cafe" className="h-10 w-auto max-w-[140px] object-contain" />
            </a>
            <div className="leading-tight">
              <p className="text-xs tracking-[0.25em] text-neutral-500">
                {isOpen
                  ? "Abierto — Ejecutivo de 12:00 a 15:00"
                  : "Cerrado — pedidos habilitados lunes a sábado de 11:00 a 15:00"}
              </p>
              <h1 className="text-lg text-neutral-900"></h1>
            </div>
          </div>
          <div className="hidden sm:block text-sm text-neutral-500">SECTO CAFE — Piedras 276</div>
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
          <PokeBuilder
            isOpen={isOpen}
            onAdd={(item, qty) => {
              dispatch({ type: "add", item, qty });
              showCartPeek(); // ✅ mostrar carrito desde derecha
              setCartHighlight(true);
              setTimeout(() => setCartHighlight(false), 600);
              if (cartRef.current) {
                cartRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
          />

          {MENU.map((cat) => (
            <div key={cat.id}>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm tracking-[0.2em] text-neutral-500">{cat.name}</h2>
                <span className="h-[1px] flex-1 ml-4 bg-neutral-200"></span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cat.items.map((item) => (
                  <article key={item.id} className="group border border-neutral-200 rounded-2xl overflow-hidden bg-white">
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
                        <h3 className="text-neutral-900 leading-tight">{item.name}</h3>
                        <p className="text-sm text-neutral-500 mt-1">{currency(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => dispatch({ type: "remove", item })}
                          className="px-3 py-2 rounded-xl border border-neutral-200"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-neutral-600">{cart[item.id]?.qty || 0}</span>
                        <button
                          onClick={() => {
                            dispatch({ type: "add", item });
                            showCartPeek(); // ✅
                          }}
                          className={`px-3 py-2 rounded-xl border ${
                            isOpen ? "border-neutral-200 bg-neutral-50" : "border-neutral-200 text-neutral-400 cursor-not-allowed"
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
            <h2 className="text-sm tracking-[0.2em] text-neutral-500">TU PEDIDO</h2>

            {pokeCount > 0 && (
              <p className="text-[11px] text-neutral-500 mb-3">
                {pokeCount} poke{pokeCount > 1 ? "s" : ""} en el carrito
              </p>
            )}

            <div className="space-y-3 max-h-[45vh] overflow-auto pr-1 mt-1">
              {items.length === 0 && <p className="text-sm text-neutral-500">Agregá items del catálogo</p>}
              {items.map(({ item, qty }) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="pr-2">
                    <p className="text-neutral-800">{item.name}</p>
                    <p className="text-neutral-500">x{qty}</p>
                  </div>
                  <div className="text-neutral-700">{currency(item.price * qty)}</div>
                </div>
              ))}
            </div>

            <hr className="my-4 border-neutral-200" />

            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <button
                className={`rounded-xl p-2 border ${
                  method === "delivery" ? "bg-neutral-100 border-neutral-300" : "border-neutral-200"
                }`}
                onClick={() => setMethod("delivery")}
              >
                Delivery
              </button>
              <button
                className={`rounded-xl p-2 border ${
                  method === "pickup" ? "bg-neutral-100 border-neutral-300" : "border-neutral-200"
                }`}
                onClick={() => setMethod("pickup")}
              >
                Retiro
              </button>
            </div>

            {method === "delivery" && (
              <div className="space-y-2">
                <label className="text-xs text-neutral-500">Zona de entrega</label>
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

                <label className="text-xs text-neutral-500">Dirección</label>
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
              <label className="text-xs text-neutral-500">Horario</label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-xl p-2"
              >
                <option value="">{isOpen ? "Seleccioná horario" : "Cerrado (no disponible)"}</option>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3">
              <label className="text-xs text-neutral-500">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sin sésamo, timbre roto, etc."
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
                className={`w-full rounded-2xl py-3 text-center ${
                  canSendNow ? "bg-black text-white" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                Enviar pedido por WhatsApp
              </button>

              {hasMP && (
                <button
                  onClick={payWithMP}
                  className={`w-full rounded-2xl py-3 text-center border ${
                    canSendNow ? "border-neutral-300" : "border-neutral-200 text-neutral-600"
                  }`}
                >
                  Pagar con Mercado Pago
                </button>
              )}

              <button
                onClick={() => dispatch({ type: "clear" })}
                className="w-full rounded-2xl py-2 text-sm border border-neutral-200"
              >
                Vaciar carrito
              </button>

              {!isOpen && (
                <p className="text-xs text-red-600 mt-1">
                  Cerrado — pedidos habilitados lunes a sábado de {OPEN_HOUR_START}:00 a {OPEN_HOUR_END}:00 (hora Montevideo).
                </p>
              )}

              <p className="text-xs text-neutral-500 mt-1">
                Pagás por transferencia, al recibir (efectivo | POS) o Mercado Pago.
              </p>
            </div>
          </div>
        </aside>
      </main>

      {/* ✅ CART PEEK (aparece desde derecha al agregar) */}
      <div
        onClick={() => {
          setCartPeek(false);
          if (cartRef.current) cartRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        className={
          "fixed right-3 top-24 z-50 w-[320px] max-w-[88vw] rounded-2xl border border-neutral-200 bg-white shadow-lg p-4 cursor-pointer transition-transform duration-300 " +
          (cartPeek ? "translate-x-0" : "translate-x-[120%]")
        }
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <div className="flex items-baseline justify-between">
          <div className="text-sm tracking-[0.2em] text-neutral-500">TU PEDIDO</div>
          <div className="text-xs text-neutral-400">Toca para ver</div>
        </div>

        <div className="mt-3 max-h-[40vh] overflow-auto pr-1">
          {items.length === 0 ? (
            <div className="text-sm text-neutral-500">Carrito vacío</div>
          ) : (
            <div className="space-y-2">
              {items.map(({ item, qty }) => (
                <div key={item.id} className="flex justify-between gap-3 text-sm">
                  <div className="text-neutral-800 leading-tight">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-neutral-500">x{qty}</div>
                  </div>
                  <div className="text-neutral-700 whitespace-nowrap">{currency(item.price * qty)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-neutral-200 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Total</span>
            <span className="text-neutral-900 font-medium">{currency(total)}</span>
          </div>
        </div>
      </div>

      <footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-neutral-500">
        <hr className="border-neutral-200 mb-4" />
        © {new Date().getFullYear()} - Secto Cafe · Lun - Sab: Almuerzo 12:00 a 15:00 - Merienda 17:00 a 19:00
      </footer>
    </div>
  );
}

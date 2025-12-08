import React, { useMemo, useReducer, useState, useRef } from "react";

/**
 * Secto Café – Página de pedidos
 * Modo claro tipo feiqui
 */

// ===== CONFIG =====
const PHONE_URUGUAY = "099079595"; // WhatsApp sin +598
const MP_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxSsx8LL11V2S1wjytNzzNTBVwnk_9P1SE37UGynJMq4IEWXdtmEoE0bL3CukF4rHsQfg/exec";

// Galería de fotos (opcional)
const GALLERY = [
  // "/photos/secto_02.jpg",
];

// ===== APERTURA (días/horas + on/off) =====
// Martes (2) a sábado (6)
const TZ = "America/Montevideo";
const OPEN_DAYS = [2, 3, 4, 5, 6]; // 0=Dom, 1=Lun, 2=Mar, ... 6=Sab
const OPEN_HOUR_START = 12; // 12:00
const OPEN_HOUR_END = 23; // hasta 23:00 (23 exclusivo para la lógica)

// Cambiá estos flags para forzar ON/OFF manual (sin tocar días/horas)
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

// ===== MENU SUSHI =====
const MENU = [
  {
    id: "rolls",
    name: "ROLLS 10 piezas",
    items: [
      { id: "r01", name: "01 - Salmón | Palta | Queso", price: 420, img: "/Photos/01.JPG" },
      { id: "r02", name: "02 - Atún | Palta | Queso", price: 440, img: "/Photos/02.JPG" },
      { id: "r03", name: "03 - Atún | Mango | Pepino | Crema palta | Cilantro", price: 440, img: "/Photos/03.JPG" },
      { id: "r04", name: "04 - Salmón | Mango | Ciboulette | Queso | Quinoa frita", price: 440, img: "/Photos/04.JPG" },
      { id: "r05", name: "05 - Tomate seco | Palta | Rúcula | Queso", price: 440, img: "/Photos/05.JPG" },
      { id: "r06", name: "06 - Langostino | Mango | Queso | Praline | Sweet chilli", price: 460, img: "/Photos/06.JPG" },
      { id: "r07", name: "07 - Salmón | Palta | Mayo spicy | Verdeo", price: 460, img: "/Photos/07.JPG" },
      { id: "r08", name: "08 - Boniato | Palta | Ciboulette | Quinoa frita", price: 440, img: "/Photos/08.JPG" },
      { id: "r09", name: "09 - Langostinos | Palta | Queso", price: 440, img: "/Photos/09.JPG" },
    ],
  },
  {
    id: "temakis",
    name: "TEMAKI 1 pieza",
    items: [{ id: "t01", name: "Salmón | Palta | Queso", price: 200 }],
  },
  {
    id: "onigirazu",
    name: "ONIGIRAZU",
    items: [
      { id: "s01", name: "Salmón 4 piezas", price: 320 },
    ],
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
      { id: "e01", name: "Salsa de soja", price: 30 },
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
      { id: "b01", name: "Agua Salus sin gas 600cc", price: 120 },
      { id: "b02", name: "Agua Salus con gas 600cc", price: 120 },
      { id: "b03", name: "Coca Cola 600cc", price: 140 },
      { id: "b04", name: "Coca Cola black 600cc", price: 140 },
      { id: "b05", name: "Sprite 600cc", price: 140 },
    ],
  },
];

// ===== ZONAS Y HORARIOS DELIVERY =====
const ZONES = [
  { id: "cv", name: "Ciudad Vieja", fee: 0 },
  { id: "centro", name: "Centro / Cordón / Aguada", fee: 70 },
  { id: "pocitos", name: "Parque Rodó / Punta Carretas / Pocitos", fee: 100 },
  { id: "otras", name: "Otras zonas coordinar", fee: 170 },
];

// Horarios seleccionables
const HOURS = [
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

const currency = (uy) =>
  new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" }).format(uy);

// ===== LOGICA CARRITO =====
function reducer(state, action) {
  const next = { ...state };
  if (action.type === "add") {
    const key = action.item.id;
    const delta =
      typeof action.qty === "number" && action.qty > 0 ? action.qty : 1;
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
    paid,
  } = order;
  const header = "Pedido Secto Cafe — " + new Date().toLocaleString("es-UY");
  const lines = items.map(
    ({ item, qty }) =>
      "• " + item.name + " x" + qty + " — " + currency(item.price * qty)
  );
  const zona = ZONES.find((z) => z.id === zone)?.name || "";
  const info = [
    "Metodo: " + (method === "pickup" ? "Retiro en local" : "Delivery"),
    method === "delivery"
      ? "Zona: " + zona + " (" + currency(fee) + ")"
      : null,
    "Horario: " + (time || "Lo antes posible"),
    "Nombre: " + name,
    "Tel: " + phone,
    method === "delivery" ? "Direccion: " + address : null,
    notes ? "Notas: " + notes : null,
    paid ? "Estado: Pagado" : "Estado: A pagar al recibir",
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

// Base del bowl (incluye 1 base, 1 proteína, 3 toppings, 2 salsas)
const POKE_BASE_PRICE = 380;
const POKE_EXTRA_PROTEIN = 100;
const POKE_EXTRA_TOPPING = 60;
const POKE_EXTRA_SAUCE = 40;

const POKE_BASES = [
  "Arroz de sushi",
  "Arroz sin aderezar",
  "Mix de verdes",
];

const POKE_PROTEINS = [
  "Langostinos",
  "Salmón",
  "Salmón spicy",
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
  "Cebolla crispy",
  "Maíz frito",
  "Sésamo",
];

const POKE_SAUCES = [
  "Soja",
  "Teriyaki",
  "Taré",
  "Alioli",
  "Maracuyá",
  "Spicy mayo",
  "Sriracha",
];

function PokeBuilder({ onAdd, isOpen }) {
  const [base, setBase] = useState("");
  const [proteins, setProteins] = useState([]);
  const [toppings, setToppings] = useState([]);
  const [sauces, setSauces] = useState([]);
  const [feedback, setFeedback] = useState("");

  const toggleInArray = (value, setFn) => {
    setFn((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );
  };

  const toggleProtein = (p) => toggleInArray(p, setProteins);
  const toggleTopping = (t) => toggleInArray(t, setToppings);
  const toggleSauce = (s) => toggleInArray(s, setSauces);

  const extraProteins = Math.max(0, proteins.length - 1);
  const extraToppings = Math.max(0, toppings.length - 3);
  const extraSauces = Math.max(0, sauces.length - 1);

  const unitPrice =
    POKE_BASE_PRICE +
    extraProteins * POKE_EXTRA_PROTEIN +
    extraToppings * POKE_EXTRA_TOPPING +
    extraSauces * POKE_EXTRA_SAUCE;

  const canAdd =
    Boolean(base) &&
    proteins.length >= 1 &&
    toppings.length >= 3 &&
    sauces.length >= 1;

  const handleAdd = () => {
    if (!canAdd) return;

    const description =
      "Poke personalizado — Base: " +
      base +
      " | Proteínas: " +
      proteins.join(", ") +
      " | Toppings: " +
      toppings.join(", ") +
      " | Salsas: " +
      sauces.join(", ");

    const item = {
      id: "poke-" + Date.now(),
      name: description,
      price: unitPrice,
    };

    onAdd(item, 1);

    // Reset total
    setBase("");
    setProteins([]);
    setToppings([]);
    setSauces([]);

    // Mensajito de feedback
    setFeedback("Poke agregado al pedido");
    setTimeout(() => setFeedback(""), 1500);
  };

  return (
    <section className="mb-10 border border-neutral-200 rounded-2xl p-4 bg-white">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm tracking-[0.2em] text-neutral-500">
          POKES — ARMA TU BOWL
        </h2>
        <div className="text-right">
          <p className="text-xs text-neutral-500">
            Desde {currency(POKE_BASE_PRICE)}
          </p>
          <p className="text-[11px] text-neutral-400">
            Precio actual: {currency(unitPrice)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Base */}
        <div className="space-y-2">
          <p className="text-xs text-neutral-500 uppercase tracking-[0.15em]">
            Base (x1 incluida)
          </p>
          <div className="space-y-1">
            {POKE_BASES.map((b) => (
              <label
                key={b}
                className="flex items-center gap-2 text-sm text-neutral-800"
              >
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

        {/* Proteínas */}
        <div className="space-y-2">
          <p className="text-xs text-neutral-500 uppercase tracking-[0.15em]">
            Proteínas (x1 incluida, extra {currency(POKE_EXTRA_PROTEIN)})
          </p>
          <div className="flex flex-wrap gap-2">
            {POKE_PROTEINS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => toggleProtein(p)}
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

        {/* Toppings */}
        <div className="space-y-2 sm:col-span-2">
          <p className="text-xs text-neutral-500 uppercase tracking-[0.15em]">
            Toppings (x3 incluidos, extra {currency(POKE_EXTRA_TOPPING)})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {POKE_TOPPINGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTopping(t)}
                className={
                  "text-xs border rounded-xl px-2 py-1 text-left " +
                  (toppings.includes(t)
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "border-neutral-200 text-neutral-700")
                }
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500">
            Elegidos: {toppings.length} (extras: {extraToppings})
          </p>
        </div>

        {/* Salsas */}
        <div className="space-y-2 sm:col-span-2">
          <p className="text-xs text-neutral-500 uppercase tracking-[0.15em]">
            Salsas (x1 incluidas, extra {currency(POKE_EXTRA_SAUCE)})
          </p>
          <div className="flex flex-wrap gap-2">
            {POKE_SAUCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSauce(s)}
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
            Elegidas: {sauces.length} (extras: {extraSauces})
          </p>
        </div>
      </div>

      {/* Botón */}
      <div className="mt-4 flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd || !isOpen}
          className={
            "rounded-2xl px-4 py-2 text-sm " +
            (canAdd && isOpen
              ? "bg-black text-white"
              : "bg-neutral-100 text-neutral-400 cursor-not-allowed")
          }
        >
          Agregar poke al pedido
        </button>
        {feedback && (
          <p className="text-[11px] text-neutral-500">{feedback}</p>
        )}
      </div>

      {!isOpen && (
        <p className="mt-2 text-[11px] text-red-600">
          Cerrado — pedidos habilitados martes a sábado de {OPEN_HOUR_START}:00 a{" "}
          {OPEN_HOUR_END}:00 (hora Montevideo).
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

  // Estado calculado
  const items = useMemo(() => Object.values(cart), [cart]);
  const subtotal = useMemo(
    () => items.reduce((s, { item, qty }) => s + item.price * qty, 0),
    [items]
  );
  const fee = useMemo(
    () => (method === "delivery" ? ZONES.find((z) => z.id === zone)?.fee || 0 : 0),
    [method, zone]
  );
  const total = subtotal + fee;
  const canSend =
    subtotal > 0 &&
    name &&
    phone &&
    (method === "pickup" || address || zone === "cv");
  const hasMP = typeof MP_ENDPOINT === "string" && MP_ENDPOINT.trim().length > 0;

  // Apertura (schedule + overrides)
  const scheduleOpen = isOpenBySchedule();
  const isOpen = (FORCE_OPEN && !FORCE_CLOSED) || (!FORCE_CLOSED && scheduleOpen);

  const canSendNow = canSend && isOpen;

  const pokeCount = useMemo(
    () =>
      items.reduce(
        (n, { item, qty }) =>
          item.id && item.id.toString().startsWith("poke-") ? n + qty : n,
        0
      ),
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

  const sendOrder = (paid = false) => {
    const text = buildWhatsAppText(getOrder({ paid }));
    const encoded = encodeURIComponent(text);
    const phoneDigits = PHONE_URUGUAY.replace(/\D/g, "");
    window.open("https://wa.me/598" + phoneDigits + "?text=" + encoded, "_blank");
  };

  const payWithMP = () => {
    if (hasMP === false) return;

    const order = getOrder();
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

    // Envio por formulario para evitar CORS
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
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" aria-label="Inicio Secto Cafe">
              <img src="/logo-secto.png" alt="Secto Cafe" className="h-10 w-auto" />
            </a>
            <div className="leading-tight">
              <p className="text-xs tracking-[0.25em] text-neutral-500">
                {isOpen
                  ? "Abierto — martes a sábado 12:00 a 23:00"
                  : "Cerrado — pedidos habilitados martes a sábado de 12:00 a 23:00"}
              </p>
              <h1 className="text-lg text-neutral-900"></h1>
            </div>
          </div>
          <div className="hidden sm:block text-sm text-neutral-500">
            SECTO CAFE — Piedras 276
          </div>
        </div>
      </header>

      {/* Galería */}
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

      {/* Contenido principal */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Catálogo */}
        <section className="lg:col-span-2 space-y-8">
          {/* Pokes */}
          <PokeBuilder
            isOpen={isOpen}
            onAdd={(item, qty) => {
              dispatch({ type: "add", item, qty });
              setCartHighlight(true);
              setTimeout(() => setCartHighlight(false), 600);
              if (cartRef.current) {
                cartRef.current.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }
            }}
          />

          {/* Sushi */}
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
                          onClick={() => dispatch({ type: "add", item })}
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

        {/* Checkout */}
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
            {pokeCount > 0 && (
              <p className="text-[11px] text-neutral-500 mb-3">
                {pokeCount} poke{pokeCount > 1 ? "s" : ""} en el carrito
              </p>
            )}

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
                <option value="">
                  {isOpen
                    ? "Lo antes posible"
                    : "Pedidos habilitados mar/sáb 12:00–23:00"}
                </option>
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
                disabled={!canSendNow}
                className={`w-full rounded-2xl py-3 text-center ${
                  canSendNow
                    ? "bg-black text-white"
                    : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                }`}
              >
                Enviar pedido por WhatsApp
              </button>

              {hasMP && (
                <button
                  onClick={payWithMP}
                  disabled={!canSendNow}
                  className={`w-full rounded-2xl py-3 text-center border ${
                    canSendNow
                      ? "border-neutral-300"
                      : "border-neutral-200 text-neutral-400 cursor-not-allowed"
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
                  Cerrado — pedidos habilitados martes a sábado de{" "}
                  {OPEN_HOUR_START}:00 a {OPEN_HOUR_END}:00 (hora Montevideo).
                </p>
              )}

              <p className="text-xs text-neutral-500 mt-1">
                Pagás por transferencia, al recibir (efectivo | POS) o Mercado
                Pago.
              </p>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-neutral-500">
        <hr className="border-neutral-200 mb-4" />
        © {new Date().getFullYear()} - Secto Cafe · Mar - Sab 12:00 a 23:00
      </footer>
    </div>
  );
}

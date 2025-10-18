import React, { useMemo, useReducer, useState } from "react";

/**
 * Secto Café – Página de pedidos (sin signos de admiracion)
 * Modo claro tipo feiqui
 */

// ===== CONFIG =====
const PHONE_URUGUAY = "099079595"; // WhatsApp sin +598
const MP_ENDPOINT = "https://script.google.com/macros/s/AKfycbxSsx8LL11V2S1wjytNzzNTBVwnk_9P1SE37UGynJMq4IEWXdtmEoE0bL3CukF4rHsQfg/exec";

// Galeria de fotos
const GALLERY = [
  // "/photos/secto_02.jpg",
];

// ===== APERTURA (días/horas + on/off) =====
const TZ = "America/Montevideo";
const OPEN_DAYS = [5, 6]; // 0=Dom, 1=Lun, ... 5=Vie, 6=Sab
const OPEN_HOUR_START = 9; // 9:00
const OPEN_HOUR_END = 24;   // hasta 23:59 (24 exclusivo)

// Cambiá estos flags para forzar ON/OFF manual (sin tocar días/horas)
const FORCE_OPEN = false;
const FORCE_CLOSED = false;

function getNowInTZ() {
  const now = new Date();
  const weekdayStr = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(now);
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[weekdayStr];
  const hourStr = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }).format(now);
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
      { id: "r01", name: "01 - Salmón | Palta | Queso", price: 420, img: "/Photos/01.JPG" },
      { id: "r02", name: "02 - Atún | Palta | Queso", price: 440, img: "/Photos/02.JPG"},
      { id: "r03", name: "03 - Atun | Mango | Pepino | Crema palta | Cilantro", price: 440, img: "/Photos/03.JPG" },
      { id: "r04", name: "04 - Salmon | Mango | Ciboulette | Queso | Quinoa frita", price: 440, img: "/Photos/04.JPG" },
      { id: "r05", name: "05 - Tomate seco | Palta | Rucula | Queso", price: 440, img: "/Photos/05.JPG" },
      { id: "r06", name: "06 - Langostino | Mango | Queso | Praline | Sweet chilli", price: 460, img: "/Photos/06.JPG" },
      { id: "r07", name: "07 - Salmon | Palta | Mayo spicy | Verdeo", price: 460, img: "/Photos/07.JPG" },
      { id: "r08", name: "08 - Boniato | Palta | Ciboulette | Quinoa frita", price: 440, img: "/Photos/08.JPG" },
      { id: "r09", name: "09 - Langostinos | Palta | Queso", price: 440, img: "/Photos/09.JPG" },
    ],
  },
  {
    id: "temakis",
    name: "TEMAKI 1 pieza",
    items: [{ id: "t01", name: "Salmon | Palta | Queso", price: 200 }],
  },
  {
    id: "sashimi",
    name: "SASHIMI",
    items: [
      { id: "s01", name: "Salmon 4 piezas", price: 360 },
      { id: "s02", name: "Atún 4 piezas", price: 380 },
    ],
  },
  {
    id: "nigiris",
    name: "NIGIRIS",
    items: [
      { id: "n01", name: "Nigiri salmón 2 piezas", price: 180 },
      { id: "n02", name: "Nigiri salmón tataki 2 piezas", price: 180 },
      { id: "n03", name: "Nigiri atún 2 piezas", price: 190 },
      { id: "n04", name: "Nigiri langostino 2 piezas", price: 190 },
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
      { id: "e02", name: "teriyaki", price: 40 },
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

// ===== ZONAS Y HORARIOS =====
const ZONES = [
  { id: "cv", name: "Ciudad Vieja", fee: 0 },
  { id: "centro", name: "Centro / Cordon / Aguada", fee: 70 },
  { id: "pocitos", name: "Parque Rodo / Punta Carretas / Pocitos", fee: 100 },
  { id: "otras", name: "Otras zonas coordinar", fee: 170 },
];

const HOURS = ["19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"];

const currency = (uy) => new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" }).format(uy);

// ===== LOGICA =====
function reducer(state, action) {
  const next = { ...state };
  if (action.type === "add") {
    const key = action.item.id;
    const qty = (state[key]?.qty || 0) + 1;
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
    "Horario: " + (time || "Lo antes posible (A partir de las 19hs)"),
    "Nombre: " + name,
    "Tel: " + phone,
    method === "delivery" ? "Direccion: " + address : null,
    notes ? "Notas: " + notes : null,
    paid ? "Estado: Pagado" : "Estado: A pagar al recibir",
  ].filter(Boolean);
  return [header, "", "Items:", ...lines, "", "Subtotal: " + currency(subtotal), "Total: " + currency(total), ...info].join("\n");
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

  // Estado calculado
  const items = useMemo(() => Object.values(cart), [cart]);
  const subtotal = useMemo(() => items.reduce((s, { item, qty }) => s + item.price * qty, 0), [items]);
  const fee = useMemo(() => (method === "delivery" ? ZONES.find((z) => z.id === zone)?.fee || 0 : 0), [method, zone]);
  const total = subtotal + fee;
  const canSend = subtotal > 0 && name && phone && (method === "pickup" || address || zone === "cv");
  const hasMP = typeof MP_ENDPOINT === "string" && MP_ENDPOINT.trim().length > 0;

  // Apertura (schedule + overrides)
  const scheduleOpen = isOpenBySchedule();
  const isOpen =
    (FORCE_OPEN && !FORCE_CLOSED) ||
    (!FORCE_CLOSED && scheduleOpen);

  const canSendNow = canSend && isOpen;

  const getOrder = (extra = {}) => ({ items, subtotal, zone, fee, total, method, name, phone, address, notes, time, ...extra });

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
      items: order.items.map(({ item, qty }) => ({ title: item.name, unit_price: item.price, quantity: qty })),
      total: order.total,
      name: order.name,
      phone: order.phone,
      method: order.method,
      zone: order.zone,
      address: order.address,
      notes: order.notes,
      time: order.time,
      back_urls: { success: window.location.origin + "?mp=success", failure: window.location.origin + "?mp=failure" },
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
                  ? "Abierto - Entregas a partir de las 19hs"
                  : "Cerrado — pedidos habilitados viernes y sábado de 9:00 a 23:59"}
              </p>
              <h1 className="text-lg text-neutral-900"></h1>
            </div>
          </div>
          <div className="hidden sm:block text-sm text-neutral-500">SECTO CAFE — Piedras 276</div>
        </div>
      </header>

      {/* Galeria */}
      {GALLERY.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pt-6">
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {GALLERY.map((src, i) => (
              <img key={i} src={src} alt="Secto Cafe" className="mb-4 w-full rounded-2xl border border-neutral-200 object-cover" />
            ))}
          </div>
        </section>
      )}

      {/* Contenido principal */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Catalogo */}
        <section className="lg:col-span-2 space-y-8">
          {MENU.map((cat) => (
            <div key={cat.id}>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm tracking-[0.2em] text-neutral-500">{cat.name}</h2>
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
                        <span className="w-6 text-center text-neutral-600">
                          {cart[item.id]?.qty || 0}
                        </span>
                        <button
                          onClick={() => dispatch({ type: "add", item })}
                          className={`px-3 py-2 rounded-xl border ${isOpen ? "border-neutral-200 bg-neutral-50" : "border-neutral-200 text-neutral-400 cursor-not-allowed"}`}
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
          <div className="border border-neutral-200 rounded-2xl p-4 sticky top-20 bg-white">
            <h2 className="text-sm tracking-[0.2em] text-neutral-500 mb-3">TU PEDIDO</h2>

            <div className="space-y-3 max-h-[45vh] overflow-auto pr-1">
              {items.length === 0 && <p className="text-sm text-neutral-500">Agrega items del catalogo</p>}
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
              <button className={`rounded-xl p-2 border ${method === "delivery" ? "bg-neutral-100 border-neutral-300" : "border-neutral-200"}`} onClick={() => setMethod("delivery")}>Delivery</button>
              <button className={`rounded-xl p-2 border ${method === "pickup" ? "bg-neutral-100 border-neutral-300" : "border-neutral-200"}`} onClick={() => setMethod("pickup")}>Retiro</button>
            </div>

            {method === "delivery" && (
              <div className="space-y-2">
                <label className="text-xs text-neutral-500">Zona de entrega</label>
                <select value={zone} onChange={(e) => setZone(e.target.value)} className="w-full bg-white border border-neutral-200 rounded-xl p-2">
                  {ZONES.map((z) => (
                    <option key={z.id} value={z.id}>{z.name} — {currency(z.fee)}</option>
                  ))}
                </select>

                <label className="text-xs text-neutral-500">Direccion</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, numero, apto, referencia" className="w-full bg-white border border-neutral-200 rounded-xl p-2 placeholder-neutral-400" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <label className="text-xs text-neutral-500">Nombre</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="w-full bg-white border border-neutral-200 rounded-xl p-2 placeholder-neutral-400" />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Telefono</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxx" className="w-full bg-white border border-neutral-200 rounded-xl p-2 placeholder-neutral-400" />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs text-neutral-500">Horario</label>
              <select value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-white border border-neutral-200 rounded-xl p-2">
                <option value="">{isOpen ? "Lo antes posible (a partir de las 19hs)" : "Pedidos habilitados vie/sáb 19:00–23:59"}</option>
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="mt-3">
              <label className="text-xs text-neutral-500">Notas</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sin sesamo, timbre roto, etc." className="w-full bg-white border border-neutral-200 rounded-xl p-2 placeholder-neutral-400" rows={2} />
            </div>

            <div className="text-sm space-y-1 mt-4">
              <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span>{currency(subtotal)}</span></div>
              {method === "delivery" && <div className="flex justify-between"><span className="text-neutral-500">Envio</span><span>{currency(fee)}</span></div>}
              <div className="flex justify-between text-neutral-900 font-medium"><span>Total</span><span>{currency(total)}</span></div>
            </div>

            <div className="grid grid-cols-1 gap-2 mt-4">
              <button
                onClick={() => sendOrder(false)}
                disabled={!canSendNow}
                className={`w-full rounded-2xl py-3 text-center ${canSendNow ? "bg-black text-white" : "bg-neutral-100 text-neutral-400 cursor-not-allowed"}`}
              >
                Enviar pedido por WhatsApp
              </button>

              {hasMP && (
                <button
                  onClick={payWithMP}
                  disabled={!canSendNow}
                  className={`w-full rounded-2xl py-3 text-center border ${canSendNow ? "border-neutral-300" : "border-neutral-200 text-neutral-400 cursor-not-allowed"}`}
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
                  Cerrado — pedidos habilitados viernes y sábado de {OPEN_HOUR_START}:00 a {OPEN_HOUR_END === 24 ? "23:59" : `${OPEN_HOUR_END}:00`} (hora Montevideo).
                </p>
              )}

              <p className="text-xs text-neutral-500 mt-1">
                Pagas por transferencia, al recibir (efectivo|POS) o Mercado Pago.
              </p>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-neutral-500">
        <hr className="border-neutral-200 mb-4" />
        © {new Date().getFullYear()} - Secto Cafe · Mar - Dom 11:00 a 23:30
      </footer>
    </div>
  );
}

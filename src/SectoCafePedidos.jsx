import React, { useMemo, useReducer, useState, useEffect } from "react";

/**
 * Secto Café – Sushi (modo claro)
 * - Galería opcional
 * - Menú por categorías
 * - Carrito + WhatsApp
 * - Pago con MP vía Apps Script (POST por <form> para evitar CORS)
 */

// ====== CONFIG ======
const PHONE_URUGUAY = "091980245"; // WhatsApp destino (solo dígitos, sin +598)
const MP_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxSsx8LL11V2S1wjytNzzNTBVwnk_9P1SE37UGynJMq4IEWXdtmEoE0bL3CukF4rHsQfg/exec";

// Galería (dejar vacío si no hay fotos)
const GALLERY = [
  // "/photos/secto_01.jpg",
  // "/photos/secto_02.jpg",
];

// ====== MENÚ ======
const MENU = [
  {
    id: "rolls",
    name: "ROLLS (10 piezas)",
    items: [
      { id: "r01", name: "_01 - Tomate seco / Ciboulette / Phila", price: 420, img: "" },
      { id: "r02", name: "_02 - Salmón / Phila / Mango / Quinoa frita", price: 480, img: "" },
      { id: "r03", name: "_03 - Atún / Mango / Pepino / Sésamo / Crema palta / Cilantro", price: 480, img: "" },
      { id: "r04", name: "_04 - Salmón / Mango / Phila / Sésamo", price: 480, img: "" },
      { id: "r05", name: "_05 - Tomate seco / Palta / Phila / Rúcula / Sésamo / Maracuyá", price: 480, img: "" },
      { id: "r06", name: "_06 - Langostino / Phila / Mango / Praliné / Zest de lima", price: 560, img: "" },
      { id: "r07", name: "_07 - Mango / Palta / Pepino / Sésamo negro / Mayo de wasabi", price: 460, img: "" },
      { id: "r08", name: "_08 - Boniato tempura / Palta / Cebolla de verdeo / Teriyaki", price: 460, img: "" },
      { id: "r09", name: "_09 - Hongos / Cebolla caramelizada / Rúcula / Phila", price: 480, img: "" },
    ],
  },
  {
    id: "temakis",
    name: "TEMAKI (1 pieza)",
    items: [{ id: "t01", name: "Salmón / Palta / Phila", price: 240, img: "" }],
  },
  {
    id: "sashimi",
    name: "SASHIMI",
    items: [{ id: "s01", name: "Salmón 4 piezas", price: 390, img: "" }],
  },
  {
    id: "nigiri",
    name: "NIGIRIS",
    items: [
      { id: "n01", name: "Nigiri salmón 2 piezas", price: 190, img: "" },
      { id: "n02", name: "Nigiri salmón tataki 2 piezas", price: 220, img: "" },
      { id: "n03", name: "Nigiri atún 2 piezas", price: 220, img: "" },
      { id: "n04", name: "Nigiri langostino 2 piezas", price: 220, img: "" },
    ],
  },
  {
    id: "extras",
    name: "EXTRAS",
    items: [
      { id: "e01", name: "Palitos", price: 0 },
      { id: "e02", name: "Jengibre extra", price: 30 },
      { id: "e03", name: "Wasabi extra", price: 30 },
      { id: "e04", name: "Salsa de soja extra", price: 30 },
    ],
  },
  {
    id: "bebidas",
    name: "BEBIDAS",
    items: [
      { id: "b01", name: "Agua Salus sin gas", price: 120, img: "" },
      { id: "b02", name: "Agua Salus con gas", price: 120, img: "" },
      { id: "b03", name: "Pepsi 500cc", price: 120, img: "" },
      { id: "b04", name: "Pepsi black 500cc", price: 120, img: "" },
      { id: "b05", name: "Cerveza Índica West Coast IPA", price: 250, img: "" },
    ],
  },
];

// Zonas y costos de envío
const ZONES = [
  { id: "cv", name: "Ciudad Vieja", fee: 0 },
  { id: "centro", name: "Centro / Cordón / Aguada", fee: 90 },
  { id: "pocitos", name: "Parque Rodó / Punta Carretas / Pocitos", fee: 140 },
  { id: "otras", name: "Otras zonas (coordinar)", fee: 200 },
];

// Horarios
const HOURS = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30"];

// ====== LÓGICA ======
const currency = (uy) => new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" }).format(uy);

function reducer(state, action) {
  switch (action.type) {
    case "add": {
      const key = action.item.id;
      const qty = (state[key]?.qty || 0) + 1;
      return { ...state, [key]: { item: action.item, qty } };
    }
    case "remove": {
      const key = action.item.id;
      const qty = Math.max(0, (state[key]?.qty || 0) - 1);
      const next = { ...state, [key]: { item: action.item, qty } };
      if (qty === 0) delete next[key];
      return next;
    }
    case "clear":
      return {};
    default:
      return state;
  }
}

function buildWhatsAppText(order) {
  const { items, subtotal, zone, fee, total, method, name, phone, address, notes, time, paid } = order;
  const header = `Pedido Secto Café – ${new Date().toLocaleString("es-UY")}`;
  const lines = items.map(({ item, qty }) => `• ${item.name} x${qty} — ${currency(item.price * qty)}`);
  const zona = ZONES.find((z) => z.id === zone)?.name || "";
  const info = [
    `\nMétodo: ${method === "pickup" ? "Retiro en local" : "Delivery"}`,
    method === "delivery" ? `Zona: ${zona} (${currency(fee)})` : null,
    `Horario: ${time || "lo antes posible"}`,
    `Nombre: ${name}`,
    `Tel: ${phone}`,
    method === "delivery" ? `Dirección: ${address}` : null,
    notes ? `Notas: ${notes}` : null,
    paid ? `Estado: ✅ PAGADO` : `Estado: A pagar al recibir`,
  ].filter(Boolean);

  return [
    header,
    "\n\nItems:",
    ...lines,
    `\nSubtotal: ${currency(subtotal)}`,
    method === "delivery" ? `Envío: ${currency(fee)}` : null,
    `Total: ${currency(total)}`,
    ...info,
  ]
    .filter(Boolean)
    .join("\n");
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

  const items = useMemo(() => Object.values(cart), [cart]);
  const subtotal = useMemo(() => items.reduce((s, { item, qty }) => s + item.price * qty, 0), [items]);
  const fee = useMemo(() => (method === "delivery" ? ZONES.find((z) => z.id === zone)?.fee || 0 : 0), [method, zone]);
  const total = subtotal + fee;
  const canSend = subtotal > 0 && name && phone && (method === "pickup" || address || zone === "cv");

  const getOrder = (extra = {}) => ({ items, subtotal, zone, fee, total, method, name, phone, address, notes, time, ...extra });

  const sendOrder = (paid = false) => {
    const text = buildWhatsAppText(getOrder({ paid }));
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/598${PHONE_URUGUAY.replace(/\D/g, "")}?text=${encoded}`, "_blank");
  };

  const payWithMP = () => {
    if (!MP_ENDPOINT) {
      alert("Pago online no configurado.");
      return;
    }
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

    // Navegación por <form> para evitar CORS
    const form = document.createElement("form");
    form.method = "POST";
    form.action = MP_ENDPOINT;
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "data"; // GAS lee este campo
    input.value = JSON.stringify(payload);

    document.body.appendChild(form);
    form.appendChild(input);
    form.submit();
  };

  // ====== UI ======
  return (
    <div className="min-h-screen bg-white text-neutral-800">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo + texto */}
          <div className="flex items-center gap-3">
            <a href="/" aria-label="Inicio Secto Café">
              <img
                src="/logo-secto.png" // /public/logo-secto.png
                alt="Secto Café"
                className="h-10 w-auto"
                loading="eager"
                decoding="async"
              />
            </a>
            <div className="leading-tight">
              <p className="text-xs tracking-[0.25em] text-neutral-500">SECTO</p>
              <h1 className="text-lg text-neutral-900">Café · Sushi</h1>
            </div>
          </div>

          {/* Horario */}
          <div className="hidden sm:block text-sm text-neutral-500">
            SECTO CAFÉ — Piedras 276 · Mar–Dom 12:00–00:00
          </div>
        </div>
      </header>

      {/* Galería (sin comentarios HTML) */}
      {GALLERY.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pt-6">
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {/* masonry */}
            {GALLERY.map((src, i) => (
              <img
                key={i}
                src={src}
                alt="Secto Café"
                className="mb-4 w-full rounded-2xl border border-neutral-200 object-cover hover:opacity-90 transition"
              />
            ))}
          </div>
        </section>
      )}

      {/* Contenido principal */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Catálogo */}
        <section className="lg:col-span-2 space-y-8">
          {MENU.map((cat) => (
            <div key={cat.id}>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm tracking-[0.2em] text-neutral-500">{cat.name}</h2>
                <span className="h-[1px] flex-1 ml-4 bg-neutral-200" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cat.items.map((item) => (
                  <article
                    key={item.id}
                    className="group border border-neutral-200 rounded-2xl overflow-hidden bg-white"
                  >
                    {item.img ? (
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={item.img}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition"
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
                          className="px-3 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-100"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-neutral-600">
                          {cart[item.id]?.qty || 0}
                        </span>
                        <button
                          onClick={() => dispatch({ type: "add", item })}
                          className="px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100"
                        >
                          ＋
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
              {items.length === 0 && (
                <p className="text-sm text-neutral-500">Agregá items del catálogo.</p>
              )}
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
                <option value="">Lo antes posible</option>
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
                disabled={!canSend}
                className={`w-full rounded-2xl py-3 text-center transition ${
                  canSend
                    ? "bg-black text-white hover:opacity-90"
                    : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                }`}
              >
                Enviar pedido por WhatsApp
              </button>

              {MP_ENDPOINT && (
                <button
                  onClick={payWithMP}
                  disabled={!canSend}
                  className={`w-full rounded-2xl py-3 text-center border transition ${
                    canSend
                      ? "border-neutral-300 hover:bg-neutral-100"
                      : "border-neutral-200 text-neutral-400 cursor-not-allowed"
                  }`}
                >
                  Pagar con Mercado Pago
                </button>
              )}

              <button
                onClick={() => dispatch({ type: "clear" })}
                className="w-full rounded-2xl py-2 text-sm border border-neutral-200 hover:bg-neutral-50"
              >
                Vaciar carrito
              </button>

              <p className="text-xs text-neutral-500 mt-1">
                Pagás al recibir (efectivo/QR/POS). Si querés pagar online, activamos Mercado Pago.
              </p>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-neutral-500">
        <hr className="border-neutral-200 mb-4" />
        © {new Date().getFullYear()} Secto Café
      </footer>
    </div>
  );
}

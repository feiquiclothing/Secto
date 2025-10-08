import React, { useMemo, useReducer, useState, useEffect } from "react";

/**
 * Secto Café – Sushi · UI estilo feiqui.com
 * Paleta gris/negro, columnas para fotos, carrito + WhatsApp.
 * (Mercado Pago opcional con MP_ENDPOINT)
 */

// ====== CONFIG ======
const PHONE_URUGUAY = "091980245"; // WhatsApp destino (solo dígitos, sin +598)
const MP_ENDPOINT = "https://script.google.com/macros/s/AKfycbxSsx8LL11V2S1wjytNzzNTBVwnk_9P1SE37UGynJMq4IEWXdtmEoE0bL3CukF4rHsQfg/exec"; // Si tenés GAS de Mercado Pago, pegá la URL acá. Si está vacío, se oculta el botón MP.

// Galería de fotos (urls absolutas o /photos/*.jpg). Puede quedar vacío y no rompe.
const GALLERY = [
  // "/photos/secto_01.jpg",
  // "/photos/secto_02.jpg",
  // "/photos/secto_03.jpg",
];

// Menú
const MENU = [
  {
    id: "rolls",
    name: "ROLLS (10 piezas)",
    items: [
      { id: "r01", name: "Tomate seco / Ciboulette / Phila", price: 320, img: "" },
      { id: "r02", name: "Salmón / Phila / Mango / Quinoa frita", price: 520, img: "" },
      { id: "r03", name: "Atún / Mango / Pepino / Sésamo / Crema palta / Cilantro", price: 480, img: "" },
      { id: "r04", name: "Salmón / Mango / Phila / Sésamo", price: 520, img: "" },
      { id: "r05", name: "Tomate seco / Palta / Phila / Rúcula / Sésamo / Maracuyá", price: 440, img: "" },
      { id: "r06", name: "Langostino / Phila / Mango / Praliné / Zest de lima", price: 560, img: "" },
      { id: "r07", name: "Mango / Palta / Pepino / Sésamo negro / Mayo de wasabi", price: 420, img: "" },
      { id: "r08", name: "Boniato tempura / Palta / Cebolla de verdeo / Teriyaki", price: 420, img: "" },
      { id: "r09", name: "Hongos / Cebolla caramelizada / Rúcula / Phila", price: 430, img: "" },
    ],
  },
  {
    id: "temakis",
    name: "TEMAKI (4u)",
    items: [{ id: "t01", name: "Salmón / Palta / Phila", price: 240, img: "" }],
  },
  {
    id: "sashimi",
    name: "SASHIMI",
    items: [{ id: "s01", name: "Salmón 4 piezas", price: 390, img: "" }],
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
  if (!MP_ENDPOINT) { alert("Pago online no configurado."); return; }

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

  // 👉 Evita CORS: navegación con <form>, NO fetch
  const form = document.createElement("form");
  form.method = "POST";
  form.action = MP_ENDPOINT;
  form.style.display = "none";

  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "data"; // el Apps Script lee este campo
  input.value = JSON.stringify(payload);

  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
};

  // ====== UI ======
  return (
    <div className="min-h-screen bg-black text-neutral-300">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-900 bg-black/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-neutral-950 border border-neutral-800 flex items-center justify-center">◎</div>
            <div className="leading-tight">
              <p className="text-xs tracking-[0.25em] text-neutral-500">SECTO</p>
              <h1 className="text-lg text-neutral-100">Café · Sushi</h1>
            </div>
          </div>
          <div className="hidden sm:block text-sm text-neutral-500">SECTO CAFÉ - Piedras 276 · Mar – Dom 12:00–00:00</div>
        </div>
      </header>

      {/* Galería en columnas (sin comentarios HTML) */}
      {/* Galería en columnas (masonry simple) */}
{GALLERY.length > 0 && (
  <section className="max-w-6xl mx-auto px-4 pt-6">
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
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
          {MENU.map((cat) => (
            <div key={cat.id}>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm tracking-[0.2em] text-neutral-400">{cat.name}</h2>
                <span className="h-[1px] flex-1 ml-4 bg-neutral-900" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cat.items.map((item) => (
                  <article key={item.id} className="group border border-neutral-900 rounded-2xl overflow-hidden bg-neutral-950">
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
                        <h3 className="text-neutral-100 leading-tight">{item.name}</h3>
                        <p className="text-sm text-neutral-500 mt-1">{currency(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => dispatch({ type: "remove", item })}
                          className="px-3 py-2 rounded-xl border border-neutral-800 hover:border-neutral-700"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-neutral-400">{cart[item.id]?.qty || 0}</span>
                        <button
                          onClick={() => dispatch({ type: "add", item })}
                          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15"
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
          <div className="border border-neutral-900 rounded-2xl p-4 sticky top-20 bg-neutral-950">
            <h2 className="text-sm tracking-[0.2em] text-neutral-400 mb-3">TU PEDIDO</h2>

            <div className="space-y-3 max-h-[45vh] overflow-auto pr-1">
              {items.length === 0 && <p className="text-sm text-neutral-600">Agregá items del catálogo.</p>}
              {items.map(({ item, qty }) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="pr-2">
                    <p className="text-neutral-200">{item.name}</p>
                    <p className="text-neutral-500">x{qty}</p>
                  </div>
                  <div className="text-neutral-300">{currency(item.price * qty)}</div>
                </div>
              ))}
            </div>

            <hr className="my-4 border-neutral-900" />

            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <button
                className={`rounded-xl p-2 border ${method === "delivery" ? "bg-white/10 border-neutral-700" : "border-neutral-900"}`}
                onClick={() => setMethod("delivery")}
              >
                Delivery
              </button>
              <button
                className={`rounded-xl p-2 border ${method === "pickup" ? "bg-white/10 border-neutral-700" : "border-neutral-900"}`}
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
                  className="w-full bg-black border border-neutral-900 rounded-xl p-2"
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
                  className="w-full bg-black border border-neutral-900 rounded-xl p-2 placeholder-neutral-700"
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
                  className="w-full bg-black border border-neutral-900 rounded-xl p-2 placeholder-neutral-700"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Teléfono</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xxxxxxx"
                  className="w-full bg-black border border-neutral-900 rounded-xl p-2 placeholder-neutral-700"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs text-neutral-500">Horario</label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-black border border-neutral-900 rounded-xl p-2"
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
                className="w-full bg-black border border-neutral-900 rounded-xl p-2 placeholder-neutral-700"
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
              <div className="flex justify-between text-neutral-100 font-medium">
                <span>Total</span>
                <span>{currency(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 mt-4">
              <button
                onClick={() => sendOrder(false)}
                disabled={!canSend}
                className={`w-full rounded-2xl py-3 text-center transition ${
                  canSend ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 text-neutral-600 cursor-not-allowed"
                }`}
              >
                Enviar pedido por WhatsApp
              </button>

              {MP_ENDPOINT && (
                <button
                  onClick={payWithMP}
                  disabled={!canSend}
                  className={`w-full rounded-2xl py-3 text-center border transition ${
                    canSend ? "border-neutral-700 hover:bg-white/10" : "border-neutral-900 text-neutral-600 cursor-not-allowed"
                  }`}
                >
                  Pagar con Mercado Pago
                </button>
              )}

              <button
                onClick={() => dispatch({ type: "clear" })}
                className="w-full rounded-2xl py-2 text-sm border border-neutral-900 hover:border-neutral-800"
              >
                Vaciar carrito
              </button>

              <p className="text-xs text-neutral-600 mt-1">
                Pagás al recibir (efectivo/QR/POS). Si querés pagar online, activamos Mercado Pago.
              </p>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-neutral-600">
        <hr className="border-neutral-900 mb-4" />
        © {new Date().getFullYear()} Secto Café
      </footer>
    </div>
  );
}

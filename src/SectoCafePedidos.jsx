import React, { useMemo, useReducer, useState, useEffect } from "react";

/**
 * Secto Café – Sushi Web App con pedidos online
 * Incluye WhatsApp + Mercado Pago listos para deploy en sectocafe.com
 * Requisitos:
 * - TailwindCSS cargado en tu proyecto (ya incluido si usás Vite + Tailwind)
 * - Publicar el GAS con el script de Mercado Pago (ver README)
 */

// === CONFIGURACIÓN ===
const PHONE_URUGUAY = "091388682"; // Número WhatsApp
const MP_ENDPOINT = "https://script.google.com/macros/s/REEMPLAZAR_CON_TU_ID/exec"; // URL de tu Apps Script

const MENU = [
  {
    id: "rolls",
    name: "Rolls (8 u)",
    items: [
      { id: "r01", name: "Tomate seco / Ciboulette / Phila", price: 320 },
      { id: "r02", name: "Salmón / Phila / Mango / Quinoa frita", price: 520 },
      { id: "r03", name: "Atún / Mango / Pepino / Sésamo / Crema de palta / Cilantro", price: 480 },
      { id: "r04", name: "Salmón / Mango / Phila / Sésamo", price: 520 },
      { id: "r05", name: "Tomate seco / Palta / Phila / Rúcula / Sésamo / Maracuyá", price: 440 },
      { id: "r06", name: "Langostino / Phila / Mango / Praliné / Zest de lima", price: 560 },
      { id: "r07", name: "Mango / Palta / Pepino / Sésamo negro / Mayo de wasabi", price: 420 },
      { id: "r08", name: "Boniato tempura / Palta / Cebolla de verdeo / Teriyaki", price: 420 },
      { id: "r09", name: "Hongos salteados / Cebolla caramelizada / Rúcula / Phila", price: 430 },
    ],
  },
];

const ZONES = [
  { id: "cv", name: "Ciudad Vieja", fee: 0 },
  { id: "centro", name: "Centro / Cordón / Aguada", fee: 90 },
  { id: "pocitos", name: "Parque Rodó / Punta Carretas / Pocitos", fee: 140 },
  { id: "otras", name: "Otras zonas (coordinar)", fee: 200 },
];

const HOURS = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30"];

function currency(uy) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" }).format(uy);
}

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
  const header = `Pedido Secto Café Sushi – ${new Date().toLocaleString("es-UY")}`;
  const lines = items.map(({ item, qty }) => `• ${item.name} x${qty} — ${currency(item.price * qty)}`);
  const zona = ZONES.find(z => z.id === zone)?.name || "";
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

  return [header, "\n\nItems:", ...lines, `\nSubtotal: ${currency(subtotal)}`, method === "delivery" ? `Envío: ${currency(fee)}` : null, `Total: ${currency(total)}`, ...info].filter(Boolean).join("\n");
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
  const fee = useMemo(() => (method === "delivery" ? (ZONES.find(z => z.id === zone)?.fee || 0) : 0), [method, zone]);
  const total = subtotal + fee;
  const canSend = subtotal > 0 && name && phone && (method === "pickup" || address || zone === "cv");

  function getOrder(extra = {}) {
    return { items, subtotal, zone, fee, total, method, name, phone, address, notes, time, ...extra };
  }

  function sendOrder(paid = false) {
    const text = buildWhatsAppText(getOrder({ paid }));
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/598${PHONE_URUGUAY.replace(/\D/g, "")}?text=${encoded}`, "_blank");
  }

  async function payWithMP() {
    try {
      const order = getOrder();
      sessionStorage.setItem("secto_order", JSON.stringify(order));
      const res = await fetch(MP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: order.items.map(({ item, qty }) => ({ title: item.name, unit_price: item.price, quantity: qty })),
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
        }),
      });
      const data = await res.json();
      if (data.init_point) window.location.href = data.init_point;
      else alert("No se pudo iniciar el pago.");
    } catch (e) {
      alert("Error conectando con Mercado Pago.");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mp") === "success") {
      const saved = sessionStorage.getItem("secto_order");
      if (saved) sendOrder(true);
      sessionStorage.removeItem("secto_order");
    }
  }, []);

  return (
    <div className="min-h-screen bg-black text-neutral-200">
      <header className="sticky top-0 bg-black/80 backdrop-blur border-b border-neutral-800 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-medium">SECTO CAFÉ – Sushi</h1>
          <span className="text-sm text-neutral-400">Piedras 276 · 19:00 – 00:00</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          {MENU.map(cat => (
            <div key={cat.id}>
              <h2 className="text-xl mb-3">{cat.name}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {cat.items.map(item => (
                  <div key={item.id} className="border border-neutral-800 rounded-2xl p-4 flex justify-between items-start">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-neutral-400">{currency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => dispatch({ type: "remove", item })} className="border px-3 py-1 rounded-xl">−</button>
                      <span>{cart[item.id]?.qty || 0}</span>
                      <button onClick={() => dispatch({ type: "add", item })} className="bg-white/10 px-3 py-1 rounded-xl">＋</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <aside className="border border-neutral-800 rounded-2xl p-4 space-y-4 sticky top-16">
          <h2 className="text-lg">Tu pedido</h2>
          {items.length === 0 ? (
            <p className="text-sm text-neutral-500">Agregá items del menú.</p>
          ) : (
            items.map(({ item, qty }) => (
              <div key={item.id} className="flex justify-between text-sm">
                <p>{item.name} ×{qty}</p>
                <p>{currency(item.price * qty)}</p>
              </div>
            ))
          )}

          <hr className="border-neutral-800" />

          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{currency(subtotal)}</span></div>
            {method === "delivery" && <div className="flex justify-between"><span>Envío</span><span>{currency(fee)}</span></div>}
            <div className="flex justify-between font-medium text-neutral-100"><span>Total</span><span>{currency(total)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={sendOrder} disabled={!canSend} className={`py-2 rounded-xl ${canSend ? "bg-white text-black" : "bg-neutral-900 text-neutral-500"}`}>WhatsApp</button>
            <button onClick={payWithMP} disabled={!canSend} className={`py-2 rounded-xl border ${canSend ? "border-neutral-700" : "border-neutral-900 text-neutral-500"}`}>Mercado Pago</button>
          </div>
        </aside>
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-8 text-xs text-neutral-500">
        <hr className="border-neutral-800 mb-3" />
        © {new Date().getFullYear()} Secto Café
      </footer>
    </div>
  );
}

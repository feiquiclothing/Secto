import React, { useMemo, useReducer, useState, useRef, useEffect } from "react";

const PHONE_URUGUAY = "096553165";

const ORDERS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxrWgSPWPjDqelx1-_iaxvjDLW7ZL6W647UsZVm-ZaxREwY7E4MiQHNOvyNPXXbmHpQzA/exec";

const GALLERY = [];

const TZ = "America/Montevideo";
const OPEN_DAYS = [1, 2, 3, 4, 5, 6];
const OPEN_HOUR_START = 12;
const OPEN_HOUR_END = 24;
const FORCE_OPEN = true;
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

const MENU = [
  {
    id: "premium",
    name: "PIZZAS PREMIUM",
    items: [
      { id: "p01", name: "De la planta - Bechamel de coco | Cebolla | Parmesano vegano | Tomillo", price: 480, img: "/Photos/delaplanta.JPG" },
      { id: "p02", name: "Cabrío - Rúcula | Queso de cabra | Miel | Nueces", price: 620, img: "/Photos/cabrío.JPG" },
      { id: "p03", name: "Cuchillo de palo - Cebo figazza | Romesco | Parmesano", price: 460, img: "/Photos/cuchillo de palo.JPG" },
      { id: "p04", name: "Testigo falso - Pepperoni | Merkén", price: 580, img: "/Photos/testigo falso.JPG" },
      { id: "p05", name: "A otra rata - 3 quesos", price: 560, img: "/Photos/a otra rata3.jpg" },
      { id: "p06", name: "Prende tuba - Bondiola | Chimichurri | Nueces", price: 560, img: "/Photos/prende tuba.JPG" },
    ],
  },
  {
    id: "clasicas",
    name: "PIZZAS CLÁSICAS",
    items: [
      { id: "c01", name: "Atala con alambre - Cebolla | Muzzarella | Tomillo", price: 420, img: "/Photos/atalaconalambre.png" },
      { id: "c02", name: "Margarita", price: 480, img: "/Photos/margarita.JPG" },
      { id: "c03", name: "La vieja confiable - Muzzarella", price: 420, img: "/Photos/la vieja confiable.JPG" },
      { id: "c04", name: "En mi salsa - Marinara", price: 380, img: "/Photos/en mi salsa.JPG" },
    ],
  },
];

const ZONES = [
  { id: "cv", name: "Ciudad Vieja", fee: 0 },
  { id: "centro", name: "Centro / Cordón / Aguada", fee: 70 },
  { id: "pocitos", name: "Parque Rodó / Punta Carretas / Pocitos", fee: 120 },
  { id: "otras", name: "Otras zonas coordinar", fee: 170 },
];

function buildHours(start = "12:00", end = "23:59", stepMin = 30) {
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

const HOURS = buildHours("12:00", "23:59", 30);

const currency = (uy) =>
  new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
  }).format(uy);

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
  const { items, subtotal, zone, fee, total, method, name, phone, address, notes, time } = order;

  const lines = items.map(
    ({ item, qty }) => "• " + item.name + " x" + qty + " — " + currency(item.price * qty)
  );

  const zona = ZONES.find((z) => z.id === zone)?.name || "";

  return [
    "Pedido Tumba Pizzas",
    "",
    "Items:",
    ...lines,
    "",
    "Subtotal: " + currency(subtotal),
    "Total: " + currency(total),
    "",
    "Metodo: " + (method === "pickup" ? "Retiro" : "Delivery"),
    method === "delivery" ? "Zona: " + zona : null,
    "Horario: " + time,
    "Nombre: " + name,
    "Tel: " + phone,
    method === "delivery" ? "Direccion: " + address : null,
    notes ? "Notas: " + notes : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function TumbaPizzas() {
  const [cart, dispatch] = useReducer(reducer, {});
  const [method, setMethod] = useState("delivery");
  const [zone, setZone] = useState(ZONES[0].id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState("");

  const cartRef = useRef(null);

  useEffect(() => {
    document.title = "Tumba Pizzas";

    let favicon = document.querySelector("link[rel='icon']");

    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }

    favicon.href = "/tumba-favicon.png";
  }, []);

  const items = useMemo(() => Object.values(cart), [cart]);

  const subtotal = useMemo(
    () => items.reduce((s, { item, qty }) => s + item.price * qty, 0),
    [items]
  );

  const fee = useMemo(
    () => (method === "delivery"
      ? ZONES.find((z) => z.id === zone)?.fee || 0
      : 0),
    [method, zone]
  );

  const total = subtotal + fee;

  const canSend =
    subtotal > 0 &&
    name &&
    phone &&
    (method === "pickup" || address);

  const scheduleOpen = isOpenBySchedule();

  const isOpen =
    (FORCE_OPEN && !FORCE_CLOSED) ||
    (!FORCE_CLOSED && scheduleOpen);

  const canSendNow = canSend && isOpen;

  const sendOrder = () => {
    if (!canSendNow) {
      alert("Completá los datos.");
      return;
    }

    const order = {
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
    };

    const text = buildWhatsAppText(order);

    const encoded = encodeURIComponent(text);

    window.location.href =
      "https://wa.me/598" +
      PHONE_URUGUAY.replace(/\D/g, "") +
      "?text=" +
      encoded;

    fetch(ORDERS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "new_order",
        order,
      }),
    }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-white text-neutral-800">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/tumbapizzas">
              <img
                src="/tumba-logo.png"
                alt="Tumba Pizzas"
                className="h-10 w-auto object-contain"
              />
            </a>

            <div className="leading-tight">
              <p className="text-xs tracking-[0.25em] text-neutral-500">
                {isOpen
                  ? "Abierto — pedidos habilitados de 12:00 a 00:00"
                  : "Cerrado"}
              </p>
            </div>
          </div>

          <div className="hidden sm:block text-sm text-neutral-500">
            TUMBA PIZZAS
          </div>
        </div>
      </header>
    </div>
  );
}

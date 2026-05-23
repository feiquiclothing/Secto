import React, { useMemo, useReducer, useState, useRef, useEffect } from "react";

/**
 * Secto Café – Página de pedidos
 */

// ===== CONFIG =====
const PHONE_URUGUAY = "099079595";

const MP_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxrWgSPWPjDqelx1-_iaxvjDLW7ZL6W647UsZVm-ZaxREwY7E4MiQHNOvyNPXXbmHpQzA/exec";

const ORDERS_ENDPOINT = MP_ENDPOINT;

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

  const dayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

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
  const isOpenHour =
    hour >= OPEN_HOUR_START && hour < OPEN_HOUR_END;

  return isOpenDay && isOpenHour;
}

// ===== MENU =====
const MENU = [
  {
    id: "rolls",
    name: "ROLLS 10 piezas",
    items: [
      {
        id: "r01",
        name: "Mango Roll - Mango | Palta | Pepino | Sésamo | Mayo wasabi",
        price: 360,
        img: "/Photos/01.JPG",
      },
      {
        id: "r02",
        name: "Green Roll - Palta | Pepino | Rúcula | Queso | Sésamo",
        price: 360,
        img: "/Photos/02.JPG",
      },
      {
        id: "r03",
        name: "Philadelphia Roll - Boniato | Palta | Queso | Sésamo",
        price: 360,
        img: "/Photos/03.JPG",
      },
      {
        id: "r04",
        name: "Philadelphia Hot Roll - Boniato | Palta | Queso | Sésamo | Frito en panko | Taré | Verdeo",
        price: 360,
        img: "/Photos/04.JPG",
      },
      {
        id: "r05",
        name: "Sweet Crunch - Boniato | Mango | Queso | Quinoa frita | Batayaki | Boniato frito",
        price: 420,
        img: "/Photos/05.JPG",
      },
      {
        id: "r06",
        name: "Tempura Veggie - Zucchini tempura | Palta | Queso | Sésamo | Verdeo",
        price: 390,
        img: "/Photos/06.JPG",
      },
      {
        id: "r07",
        name: "Spicy carrot - Boniato | Palta | Queso | Spicy carrot | Verdeo",
        price: 420,
        img: "/Photos/07.JPG",
      },
      {
        id: "r08",
        name: "Nori furai - Boniato | Palta | Spicy carrot | Verdeo | Sésamo",
        price: 420,
        img: "/Photos/08.JPG",
      },
      {
        id: "r09",
        name: "Creamy Tomato - Tomate seco | Palta | Rúcula | Queso | Batayaki | Verdeo",
        price: 380,
        img: "/Photos/09.JPG",
      },
      {
        id: "r10",
        name: "Teriyaki Roll - Boniato tempura | Mango | Quinoa frita | Verdeo | Teriyaki",
        price: 380,
        img: "/Photos/10.JPG",
      },
    ],
  },

  {
    id: "combos",
    name: "COMBOS (especificar rolls en checkout)",
    items: [
      { id: "c01", name: "Combo 20 piezas", price: 580 },
      { id: "c02", name: "Combo 30 piezas", price: 990 },
      { id: "c03", name: "Combos 40 piezas", price: 1280 },
      { id: "c04", name: "Combos 50 piezas", price: 1640 },
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
    ],
  },

  {
    id: "bebidas",
    name: "BEBIDAS",
    items: [
      { id: "b01", name: "Agua Salus sin gas 600cc", price: 100 },
      { id: "b02", name: "Agua Salus con gas 600cc", price: 100 },
      { id: "b03", name: "Coca Cola 600cc", price: 150 },
      { id: "b04", name: "Schweppes 600cc", price: 150 },
      { id: "b05", name: "Sprite 600cc", price: 150 },
      { id: "b06", name: "Fanta 600cc", price: 150 },
    ],
  },
];

// ===== ZONAS =====
const ZONES = [
  { id: "cv", name: "Ciudad Vieja", fee: 0 },
  { id: "centro", name: "Centro / Cordón / Aguada", fee: 70 },
  {
    id: "pocitos",
    name: "Parque Rodó / Punta Carretas / Pocitos",
    fee: 120,
  },
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

  for (
    let m = toMin(start);
    m <= toMin(end);
    m += stepMin
  ) {
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

// ===== CARRITO =====
function reducer(state, action) {
  const next = { ...state };

  if (action.type === "add") {
    const key = action.item.id;

    const delta =
      typeof action.qty === "number" && action.qty > 0
        ? action.qty
        : 1;

    const qty = (state[key]?.qty || 0) + delta;

    next[key] = {
      item: action.item,
      qty,
    };
  }

  else if (action.type === "remove") {
    const key = action.item.id;

    const qty = Math.max(
      0,
      (state[key]?.qty || 0) - 1
    );

    if (qty > 0) {
      next[key] = {
        item: action.item,
        qty,
      };
    } else {
      delete next[key];
    }
  }

  else if (action.type === "clear") {
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

  const header =
    "Pedido Secto Cafe — " +
    new Date().toLocaleString("es-UY");

  const lines = items.map(
    ({ item, qty }) =>
      "• " +
      item.name +
      " x" +
      qty +
      " — " +
      currency(item.price * qty)
  );

  const zona =
    ZONES.find((z) => z.id === zone)?.name || "";

  const info = [
    "Metodo: " +
      (method === "pickup"
        ? "Retiro en local"
        : "Delivery"),

    method === "delivery"
      ? "Zona: " +
        zona +
        " (" +
        currency(fee) +
        ")"
      : null,

    "Horario: " +
      (time || "(no especificado)"),

    "Nombre: " + name,
    "Tel: " + phone,

    method === "delivery"
      ? "Direccion: " + address
      : null,

    notes ? "Notas: " + notes : null,

    paid
      ? "Estado: Pagado (Mercado Pago)"
      : "Estado: A pagar al recibir",
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

export default function SectoCafePedidos() {
  const [cart, dispatch] = useReducer(reducer, {});

  const [method, setMethod] =
    useState("delivery");

  const [zone, setZone] = useState(ZONES[0].id);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState("");

  const cartRef = useRef(null);

  const [cartHighlight, setCartHighlight] =
    useState(false);

  const [cartPeek, setCartPeek] =
    useState(false);

  const showCartPeek = () => {
    setCartPeek(true);
  };

  const items = useMemo(
    () => Object.values(cart),
    [cart]
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, { item, qty }) =>
          s + item.price * qty,
        0
      ),
    [items]
  );

  const fee = useMemo(
    () =>
      method === "delivery"
        ? ZONES.find((z) => z.id === zone)?.fee || 0
        : 0,
    [method, zone]
  );

  const total = subtotal + fee;

  const canSend =
    subtotal > 0 &&
    name &&
    phone &&
    (method === "pickup" ||
      address ||
      zone === "cv");

  const hasMP =
    typeof MP_ENDPOINT === "string" &&
    MP_ENDPOINT.trim().length > 0;

  const scheduleOpen = isOpenBySchedule();

  const isOpen =
    (FORCE_OPEN && !FORCE_CLOSED) ||
    (!FORCE_CLOSED && scheduleOpen);

  const canSendNow = canSend && isOpen;

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

  const getWhatsAppUrl = (order) => {
    const text = buildWhatsAppText(order);

    const encoded = encodeURIComponent(text);

    const phoneDigits =
      PHONE_URUGUAY.replace(/\D/g, "");

    return (
      "https://wa.me/598" +
      phoneDigits +
      "?text=" +
      encoded
    );
  };

  const openWhatsAppWithOrder = (order) => {
    window.location.href =
      getWhatsAppUrl(order);
  };

  useEffect(() => {
    if (items.length === 0) {
      setCartPeek(false);
    }
  }, [items.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(
      window.location.search
    );

    const mp = params.get("mp");

    if (mp !== "success") return;

    const raw =
      sessionStorage.getItem("secto_order");

    if (!raw) return;

    let order;

    try {
      order = JSON.parse(raw);
    } catch {
      return;
    }

    const paidOrder = {
      ...order,
      paid: true,
      createdAt: Date.now(),
    };

    fetch(ORDERS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "new_order",
        order: paidOrder,
      }),
      keepalive: true,
    }).catch(() => {});

    openWhatsAppWithOrder(paidOrder);

    sessionStorage.removeItem("secto_order");

    params.delete("mp");

    const cleanUrl =
      window.location.pathname +
      (params.toString()
        ? "?" + params.toString()
        : "");

    window.history.replaceState(
      {},
      "",
      cleanUrl
    );
  }, []);

  const sendOrder = (paid = false) => {
    if (!canSendNow) {
      alert(
        "Te falta completar datos o el local está cerrado."
      );

      return;
    }

    const order = getOrder({
      paid,
      createdAt: Date.now(),
    });

    openWhatsAppWithOrder(order);

    fetch(ORDERS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "new_order",
        order,
      }),
      keepalive: true,
    }).catch(() => {});
  };

  return (
    <div>
      {/* resto del componente */}
    </div>
  );
}

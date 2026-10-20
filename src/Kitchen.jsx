import React, { useEffect, useRef, useState } from "react";

const ENDPOINT = "/api/secto";
const POLL_MS = 2500;

const LEADER_KEY = "secto_kitchen_leader_v2";
const LEADER_TTL = 8000;
const STARTED_KEY = "secto_kitchen_started_v1";

function makeTabId() {
  return `kitchen_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function readLeader() {
  try {
    return JSON.parse(localStorage.getItem(LEADER_KEY) || "null");
  } catch {
    return null;
  }
}

function writeLeader(tabId) {
  try {
    localStorage.setItem(
      LEADER_KEY,
      JSON.stringify({
        tabId,
        ts: Date.now(),
      })
    );
  } catch {}
}

function releaseLeader(tabId) {
  try {
    const leader = readLeader();
    if (leader?.tabId === tabId) {
      localStorage.removeItem(LEADER_KEY);
    }
  } catch {}
}

async function post(payload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
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
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return data;
}

const TZ = "America/Montevideo";
const DEPARTURES = ["19:00", "20:00", "21:00", "22:00", "23:00", "00:00"];

function localISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function orderDate(order) {
  const explicit = String(order.deliveryDate || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const time = String(order.time || "");
  const match = time.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const created = order.createdAt;
  if (!created) return "";
  const date = new Date(created);
  return Number.isNaN(date.getTime()) ? "" : localISO(date);
}
function departureHour(order) {
  const time = String(order.time || "");
  if (time === "asap" || /lo antes posible/i.test(time)) return "Sin horario";
  const match = time.match(/(?:^|\s)(\d{2}:\d{2})$/);
  return match ? match[1] : "Sin horario";
}
function orderRolls(order) {
  let rolls = 0;
  for (const entry of order.items || []) {
    const id = String(entry?.item?.id || "");
    const qty = Number(entry.qty) || 0;
    if (id.startsWith("r")) rolls += qty;
    if (id === "c01") rolls += qty;
    if (id === "c02" || id === "c03") rolls += qty * 2;
    if (id === "c04" || id === "c05") rolls += qty * 3;
  }
  return rolls;
}

function formatTime(ts) {
  if (!ts) return "—";

  try {
    return new Date(ts).toLocaleTimeString("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function Kitchen() {
  const [started, setStarted] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const [status, setStatus] = useState("Kitchen detenida.");
  const [connection, setConnection] = useState("connecting");
  const [lastCheck, setLastCheck] = useState(null);
  const [lastId, setLastId] = useState(null);
  const [view, setView] = useState("today");
  const [selectedDate, setSelectedDate] = useState(localISO);
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedHour, setSelectedHour] = useState("");
  const [expandedId, setExpandedId] = useState("");

  const tabIdRef = useRef(makeTabId());
  const startedRef = useRef(false);
  const isLeaderRef = useRef(false);
  const busyRef = useRef(false);

  const audioContextRef = useRef(null);

  const pollTimerRef = useRef(null);
  const leaderTimerRef = useRef(null);

  const playTone = (ctx, frequency, startAt, duration, volume = 0.7) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startAt);
    osc.stop(startAt + duration + 0.03);
  };

  const playNotification = async () => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    try {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const now = ctx.currentTime;

      playTone(ctx, 880, now, 0.22, 0.75);
      playTone(ctx, 1174.66, now + 0.24, 0.24, 0.85);
      playTone(ctx, 880, now + 0.52, 0.22, 0.75);
      playTone(ctx, 1396.91, now + 0.78, 0.30, 0.9);
      playTone(ctx, 1174.66, now + 1.12, 0.26, 0.85);
    } catch (e) {
      console.warn("No se pudo reproducir sonido:", e);
    }
  };

  const claimLeadership = () => {
    const current = readLeader();
    const now = Date.now();

    const expired =
      !current?.tabId ||
      !current?.ts ||
      now - current.ts > LEADER_TTL;

    if (expired || current.tabId === tabIdRef.current) {
      writeLeader(tabIdRef.current);
      isLeaderRef.current = true;
      setIsLeader(true);
      return true;
    }

    isLeaderRef.current = false;
    setIsLeader(false);
    return false;
  };


  const startKitchen = async () => {
    document.title = "KITCHEN";

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (AudioContextClass) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
        }

        const ctx = audioContextRef.current;

        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        audioContextRef.current = ctx;
        setSoundReady(true);

        const now = ctx.currentTime;
        playTone(ctx, 880, now, 0.12, 0.45);
        playTone(ctx, 1174.66, now + 0.14, 0.14, 0.5);
      }
    } catch (e) {
      console.warn("Audio:", e);
      setSoundReady(false);
    }

    const leader = claimLeadership();

    startedRef.current = true;
    setStarted(true);
    sessionStorage.setItem(STARTED_KEY, "1");

    if (leader) {
      setStatus("Kitchen activa. Esperando pedidos…");
    } else {
      setStatus(
        "Esta pestaña quedó en espera porque ya hay otra Kitchen activa."
      );
    }
  };

  const openTicket = (order) => {
    const id = order?.id;
    if (!id) return false;

    const url =
      `/ticket?id=${encodeURIComponent(id)}` +
      `&autoprint=1&returnTo=${encodeURIComponent("/kitchen")}`;

    // Una sola pestaña: Kitchen se transforma temporalmente en la comanda.
    window.location.assign(url);
    return true;
  };

  useEffect(() => {
    // Si ya se inició Kitchen en esta sesión, al volver desde /ticket
    // retomamos automáticamente sin pedir otro click.
    if (sessionStorage.getItem(STARTED_KEY) !== "1") return;

    startedRef.current = true;
    setStarted(true);

    const leader = claimLeadership();
    setStatus(
      leader
        ? "Kitchen reanudada. Esperando pedidos…"
        : "Kitchen reanudada en espera…"
    );

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;
        if (ctx.state === "running") setSoundReady(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let stopped = false;

    document.title = "KITCHEN";

    const poll = async () => {
      if (
        stopped ||
        !startedRef.current ||
        !isLeaderRef.current ||
        busyRef.current
      ) {
        return;
      }

      busyRef.current = true;

      try {
        const data = await post({ action: "next_unprinted" });

        if (stopped) return;

        setConnection("online");
        setLastCheck(Date.now());

        const order = data?.order;
        const id = order?.id;

        if (!id) {
          setStatus("Kitchen activa. Esperando pedidos…");
          return;
        }

        setLastId(id);
        setStatus(`🔔 Nuevo pedido ${id}`);
        document.title = `🔔 PEDIDO ${id} — KITCHEN`;

        await playNotification();

        const opened = openTicket(order);

        if (!opened) {
          setStatus(
            "Entró un pedido, pero la pestaña de comandas está cerrada. Apretá PREPARAR COMANDA."
          );
          return;
        }

        setStatus(`Abriendo comanda ${id}…`);
      } catch (e) {
        if (!stopped) {
          setConnection("offline");
          setLastCheck(Date.now());
          setStatus("ERROR: " + (e?.message || String(e)));
        }
      } finally {
        busyRef.current = false;
      }
    };

    const schedulePoll = () => {
      if (stopped) return;

      pollTimerRef.current = setTimeout(async () => {
        await poll();
        schedulePoll();
      }, POLL_MS);
    };

    const refreshLeadership = () => {
      if (!startedRef.current) return;

      const leader = claimLeadership();

      if (leader) {
        writeLeader(tabIdRef.current);
      }
    };

    leaderTimerRef.current = setInterval(refreshLeadership, 2500);

    schedulePoll();

    const onFocus = () => {
      if (startedRef.current) {
        claimLeadership();
        poll();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && startedRef.current) {
        claimLeadership();
        poll();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;

      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }

      if (leaderTimerRef.current) {
        clearInterval(leaderTimerRef.current);
      }

      releaseLeader(tabIdRef.current);

      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Consulta independiente: no altera el polling ni marca pedidos impresos.
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        setLoadingOrders(true);
        const data = await post({ action: "list_orders", date: selectedDate, limit: 1000 });
        if (!data?.ok) throw new Error(data?.error || "No se pudo consultar el historial");
        if (!disposed) { setOrders(Array.isArray(data.orders) ? data.orders : []); setOrdersError(""); }
      } catch (err) {
        if (!disposed) setOrdersError(String(err?.message || err));
      } finally {
        if (!disposed) setLoadingOrders(false);
      }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => { disposed = true; clearInterval(timer); };
  }, [selectedDate]);

  const filteredOrders = orders.filter((o) => {
    const haystack = `${o.id || ""} ${o.name || ""} ${o.phone || ""}`.toLowerCase();
    const matchesSearch = haystack.includes(search.trim().toLowerCase());
    return matchesSearch && (!selectedHour || departureHour(o) === selectedHour);
  });
  const countForHour = (hour) => orders.filter((o) => departureHour(o) === hour).length;
  const dayTotal = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const dayRolls = orders.reduce((sum, o) => sum + orderRolls(o), 0);

  const connectionLabel =
    connection === "online"
      ? "CONECTADO"
      : connection === "offline"
      ? "SIN CONEXIÓN"
      : "CONECTANDO…";

  const connectionColor =
    connection === "online"
      ? "#16803a"
      : connection === "offline"
      ? "#c62828"
      : "#777";

  return (
    <div
      style={{
        padding: 16,
        fontFamily: "system-ui",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <h1 style={{ marginBottom: 10 }}>KITCHEN</h1>

      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button onClick={() => {setView("today");setSelectedDate(localISO());setSelectedHour("");}} style={{padding:10,fontWeight:view==="today"?800:400}}>HOY</button>
        <button onClick={() => {setView("history");setSelectedHour("");}} style={{padding:10,fontWeight:view==="history"?800:400}}>HISTORIAL / FUTUROS</button>
      </div>
      <section style={{border:"1px solid #ddd",borderRadius:12,padding:14,marginBottom:18}}>
        {view === "history" && <label>Fecha de salida: <input type="date" value={selectedDate} onChange={e=>{setSelectedDate(e.target.value);setSelectedHour("");}} /></label>}
        {view === "today" && <h2 style={{marginTop:0}}>Salidas de hoy · {selectedDate}</h2>}
        {ordersError && <p style={{color:"#b91c1c"}}>Historial: {ordersError}. Revisá que el Apps Script actualizado esté publicado.</p>}
        <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",margin:"12px 0"}}>
          <strong>{orders.length} pedidos</strong><strong>{dayRolls} rolls</strong><strong>${dayTotal.toLocaleString("es-UY")} ventas</strong>
        </div>
        <div style={{display:"grid",gap:8}}>
          {DEPARTURES.map(hour => { const count = countForHour(hour); const max = Math.max(1,...DEPARTURES.map(countForHour)); return <button key={hour} onClick={()=>setSelectedHour(old=>old===hour?"":hour)} style={{border:selectedHour===hour?"2px solid #111":"1px solid #ddd",background:"white",padding:8,cursor:"pointer",textAlign:"left",borderRadius:8}}><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{width:48}}>{hour}</span><div style={{flex:1,background:"#eee",height:16,borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${count/max*100}%`,background:"#111"}} /></div><b style={{width:22,textAlign:"right"}}>{count}</b></div></button>; })}
        </div>
        {orders.some(o=>departureHour(o)==="Sin horario") && <p style={{fontSize:12}}>Pedidos sin horario asignado: {countForHour("Sin horario")}. Los pedidos «Lo antes posible» no se asignan automáticamente a una salida.</p>}
        <div style={{marginTop:14,display:"flex",gap:8,alignItems:"center"}}>
          <input placeholder="Buscar número, cliente o teléfono" value={search} onChange={e=>setSearch(e.target.value)} style={{padding:10,border:"1px solid #ddd",borderRadius:8,flex:1,minWidth:0}} />
          {selectedHour && <button onClick={()=>setSelectedHour("")}>Ver todos</button>}
        </div>
        <div style={{maxHeight:440,overflow:"auto",marginTop:12}}>
          {filteredOrders.map(o=><div key={o.id} style={{borderTop:"1px solid #eee",padding:"10px 0"}}>
            <button onClick={()=>setExpandedId(old=>old===o.id?"":o.id)} style={{width:"100%",textAlign:"left",border:0,background:"white",cursor:"pointer",display:"flex",justifyContent:"space-between",gap:8}}><span><b>{o.id}</b><br/>{o.name || "Sin nombre"} · {departureHour(o)}</span><span>${Number(o.total||0).toLocaleString("es-UY")}<br/>{o.printed?"Impresa":"Pendiente"}</span></button>
            {expandedId===o.id && <div style={{padding:10,background:"#fafafa",whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:13}}>
              <p>Teléfono: {o.phone || "—"}<br/>Entrega: {o.time || "—"}<br/>Dirección: {o.address || "—"}<br/>Notas: {o.notes || "—"}</p>
              {(o.items||[]).map((entry,i)=><div key={i}>{entry.qty} × {entry.item?.name || "Producto"}</div>)}
              {(o.comboSelections||[]).map((c,i)=><p key={i}>{c.comboName}: {(c.rolls||[]).join(" / ")} {(c.drinks||[]).join(" / ")}</p>)}
              <p><b>Total: ${Number(o.total||0).toLocaleString("es-UY")}</b></p>
              <button onClick={()=>window.open(`/ticket?id=${encodeURIComponent(o.id)}&autoprint=1&reprint=1`,"_blank","noopener,noreferrer")} style={{padding:10,border:"1px solid #111",borderRadius:8,background:"white"}}>REIMPRIMIR COMANDA</button>
            </div>}
          </div>)}
          {!loadingOrders && filteredOrders.length===0 && <p style={{fontSize:13,color:"#777"}}>No hay pedidos para este filtro.</p>}
        </div>
      </section>

      {!started ? (
        <button
          type="button"
          onClick={startKitchen}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            fontWeight: 900,
            fontSize: 16,
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          ▶ INICIAR KITCHEN
        </button>
      ) : null}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
          display: "grid",
          gap: 8,
        }}
      >
        <div>
          <b>Estado:</b>{" "}
          {started
            ? isLeader
              ? "ACTIVA"
              : "EN ESPERA"
            : "DETENIDA"}
        </div>


        <div>
          <b>Sonido:</b>{" "}
          {soundReady ? "✓ ACTIVADO" : "✕ NO ACTIVADO"}
        </div>

        <div
          style={{
            color: connectionColor,
            fontWeight: 800,
          }}
        >
          {connectionLabel}
        </div>

        <div style={{ fontSize: 12, opacity: 0.65 }}>
          Último chequeo: {formatTime(lastCheck)}
        </div>
      </div>


      <div
        style={{
          padding: 12,
          borderRadius: 10,
          border: "1px solid #ddd",
          fontWeight: 700,
        }}
      >
        {status}
      </div>

      {lastId ? (
        <div style={{ marginTop: 12, opacity: 0.7 }}>
          Último pedido: <b>{lastId}</b>
        </div>
      ) : null}

      <p style={{ marginTop: 18, fontSize: 13, opacity: 0.65 }}>
        Dejá abierta únicamente esta pestaña. Cuando entra un pedido,
        Kitchen pasa a la comanda, abre impresión y después vuelve sola.
      </p>
    </div>
  );
}

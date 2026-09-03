import React, { useEffect, useRef, useState } from "react";

const ENDPOINT = "/api/secto";
const POLL_MS = 2500;

const LEADER_KEY = "secto_kitchen_leader_v2";
const LEADER_TTL = 8000;

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

    const id = order?.id;
    if (!id) return false;

    const win = ticketWinRef.current;

    if (!win || win.closed) {
      setTicketReady(false);
      return false;
    }

    const url = `/ticket?id=${encodeURIComponent(id)}&autoprint=1`;

    try {
      win.location.href = url;
      win.focus();
      return true;
    } catch {
      return false;
    }
  };

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

import React, { useEffect, useRef, useState } from "react";

const ENDPOINT = "/api/secto";
const POLL_MS = 2500;

const STORAGE_KEY = "secto_printed_ids_v1";
const DEDUPE_TTL_MS = 10 * 60 * 1000;

function loadMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveMap(m) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {}
}

function cleanup(m) {
  const now = Date.now();
  const out = { ...m };

  for (const [id, ts] of Object.entries(out)) {
    if (!ts || now - ts > DEDUPE_TTL_MS) delete out[id];
  }

  return out;
}

async function post(payload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();

  let data;
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
  const [status, setStatus] = useState("Esperando pedidos…");
  const [lastId, setLastId] = useState(null);
  const [connection, setConnection] = useState("connecting");
  const [lastCheck, setLastCheck] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const printedRef = useRef(cleanup(loadMap()));
  const busyRef = useRef(false);

  const audioContextRef = useRef(null);
  const soundEnabledRef = useRef(false);

  const pollTimerRef = useRef(null);
  const titleTimerRef = useRef(null);

  const playTone = (ctx, frequency, startAt, duration, volume = 0.2) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
  };

  const enableSound = async () => {
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        setStatus("Este navegador no soporta audio para alertas.");
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      const ctx = audioContextRef.current;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      soundEnabledRef.current = true;
      setSoundEnabled(true);

      const now = ctx.currentTime;
      playTone(ctx, 880, now, 0.10, 0.12);
      playTone(ctx, 1174.66, now + 0.12, 0.12, 0.12);

      setStatus("Sonido activado. Esperando pedidos…");
    } catch (e) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      setStatus(
        "No se pudo activar el sonido: " + (e?.message || String(e))
      );
    }
  };

  const playNotification = async () => {
    if (!soundEnabledRef.current) return;

    try {
      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const now = ctx.currentTime;

      playTone(ctx, 880, now, 0.14, 0.22);
      playTone(ctx, 1174.66, now + 0.18, 0.18, 0.24);
      playTone(ctx, 880, now + 0.42, 0.18, 0.22);
    } catch (e) {
      console.warn("No se pudo reproducir sonido:", e);
    }
  };

  const showNewOrderTitle = (id) => {
    document.title = `🔔 PEDIDO ${id} — KITCHEN`;

    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
    }

    titleTimerRef.current = setTimeout(() => {
      document.title = "KITCHEN";
    }, 10000);
  };

  useEffect(() => {
    let stopped = false;

    document.title = "KITCHEN";

    const poll = async () => {
      if (stopped || busyRef.current) return;

      busyRef.current = true;

      try {
        const data = await post({ action: "next_unprinted" });

        if (stopped) return;

        setConnection("online");
        setLastCheck(Date.now());

        const order = data?.order;
        const id = order?.id;

        if (!id) {
          setStatus("Esperando pedidos…");
          return;
        }

        printedRef.current = cleanup(printedRef.current);

        if (printedRef.current[id]) {
          setStatus(`Esperando pedidos… (dedupe ${id})`);
          return;
        }

        setLastId(id);
        setStatus(`🔔 Nuevo pedido ${id}`);

        showNewOrderTitle(id);
        await playNotification();

        // Evita volver a procesarlo durante esta navegación.
        printedRef.current[id] = Date.now();
        saveMap(printedRef.current);

        setStatus(`Abriendo comanda ${id}…`);

        // Usamos LA MISMA pestaña.
        // Así Chrome no puede ignorar el cambio de foco.
        const url =
          `/ticket?id=${encodeURIComponent(id)}` +
          `&autoprint=1&returnTo=${encodeURIComponent("/kitchen")}`;

        window.location.assign(url);
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

    poll();
    schedulePoll();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        poll();
      }
    };

    const onFocus = () => {
      poll();
    };

    const onOnline = () => {
      setConnection("connecting");
      setStatus("Conexión recuperada. Buscando pedidos…");
      poll();
    };

    const onOffline = () => {
      setConnection("offline");
      setStatus("Sin conexión a internet.");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      stopped = true;

      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }

      if (titleTimerRef.current) {
        clearTimeout(titleTimerRef.current);
      }

      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontWeight: 800,
              color: connectionColor,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: connectionColor,
                display: "inline-block",
              }}
            />
            {connectionLabel}
          </div>

          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Último chequeo: {formatTime(lastCheck)}
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: 0.65 }}>
          Buscando pedidos automáticamente cada {POLL_MS / 1000} segundos.
        </div>
      </div>

      {!soundEnabled ? (
        <button
          type="button"
          onClick={enableSound}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 800,
            marginBottom: 16,
          }}
        >
          🔔 Activar sonido de pedidos
        </button>
      ) : (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 10,
            marginBottom: 16,
            fontWeight: 700,
          }}
        >
          🔔 Sonido activado
        </div>
      )}

      <p style={{ fontWeight: 700 }}>{status}</p>

      {lastId && (
        <p style={{ opacity: 0.7 }}>
          Último pedido detectado: <b>{lastId}</b>
        </p>
      )}

      <p style={{ opacity: 0.65, marginTop: 18, fontSize: 13 }}>
        Cuando entra un pedido, Kitchen pasa automáticamente a la comanda.
        Al cerrar el diálogo de impresión vuelve solo a Kitchen.
      </p>
    </div>
  );
}

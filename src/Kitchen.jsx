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
  const [status, setStatus] = useState("Kitchen sin iniciar.");
  const [started, setStarted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [popupReady, setPopupReady] = useState(false);
  const [connection, setConnection] = useState("idle");
  const [lastCheck, setLastCheck] = useState(null);
  const [lastId, setLastId] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);

  const printedRef = useRef(cleanup(loadMap()));
  const busyRef = useRef(false);
  const ticketWinRef = useRef(null);

  const audioContextRef = useRef(null);
  const startedRef = useRef(false);

  const pollTimerRef = useRef(null);
  const titleTimerRef = useRef(null);

  const playTone = (ctx, frequency, startAt, duration, volume = 0.2) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      startAt + duration
    );

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
  };

  const playNotification = async () => {
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
    }, 12000);
  };

  const ensureTicketWindow = () => {
    if (ticketWinRef.current && !ticketWinRef.current.closed) {
      return true;
    }

    // IMPORTANTE:
    // Esta función debe ejecutarse desde un click real del usuario.
    ticketWinRef.current = window.open("", "secto_ticket");

    if (!ticketWinRef.current) {
      setPopupReady(false);
      return false;
    }

    try {
      ticketWinRef.current.document.title = "SECTO — TICKET";
      ticketWinRef.current.document.body.innerHTML = `
        <div style="
          font-family:system-ui;
          padding:24px;
          text-align:center;
        ">
          <h2>SECTO — TICKET</h2>
          <p>Ventana preparada.</p>
          <p>Dejala abierta. El próximo pedido aparecerá acá automáticamente.</p>
        </div>
      `;
    } catch {}

    setPopupReady(true);
    return true;
  };

  const openOrReuseTicket = (order) => {
    const id = order?.id;
    if (!id) return false;

    const win = ticketWinRef.current;

    if (!win || win.closed) {
      setPopupReady(false);
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

  const startKitchen = async () => {
    document.title = "KITCHEN";

    const popupOk = ensureTicketWindow();

    if (!popupOk) {
      setStatus(
        "El navegador bloqueó la ventana de ticket. Permití popups para este sitio y volvé a tocar INICIAR KITCHEN."
      );
      return;
    }

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

        // Sonido de prueba al iniciar.
        const now = ctx.currentTime;
        playTone(ctx, 880, now, 0.12, 0.15);
        playTone(ctx, 1174.66, now + 0.14, 0.14, 0.16);

        setSoundEnabled(true);
      } else {
        setSoundEnabled(false);
      }
    } catch {
      setSoundEnabled(false);
    }

    startedRef.current = true;
    setStarted(true);
    setConnection("connecting");
    setStatus("Kitchen iniciado. Esperando pedidos…");
  };

  const reopenLastTicket = () => {
    if (!lastOrder) {
      setStatus("No hay último pedido para reimprimir.");
      return;
    }

    if (!ticketWinRef.current || ticketWinRef.current.closed) {
      setStatus(
        "La ventana de ticket está cerrada. Tocá PREPARAR VENTANA DE TICKET."
      );
      setPopupReady(false);
      return;
    }

    const opened = openOrReuseTicket(lastOrder);

    if (!opened) {
      setStatus("No se pudo reutilizar la ventana de ticket.");
      return;
    }

    setStatus(`Reabriendo ticket ${lastOrder.id || ""}`);
  };

  const prepareTicketAgain = () => {
    const ok = ensureTicketWindow();

    if (ok) {
      setStatus("Ventana de ticket preparada nuevamente.");
    } else {
      setStatus(
        "Popup bloqueado. Permití popups para este sitio y probá otra vez."
      );
    }
  };

  const testSound = async () => {
    if (!audioContextRef.current) {
      setStatus("Primero tocá INICIAR KITCHEN.");
      return;
    }

    await playNotification();
    setStatus("Sonido de prueba enviado.");
  };

  useEffect(() => {
    let stopped = false;

    document.title = "KITCHEN";

    const poll = async () => {
      if (
        stopped ||
        !startedRef.current ||
        busyRef.current
      ) {
        return;
      }

      busyRef.current = true;

      try {
        const data = await post({
          action: "next_unprinted",
        });

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
        setLastOrder(order);
        setStatus(`🔔 Nuevo pedido ${id}`);

        showNewOrderTitle(id);

        await playNotification();

        const opened = openOrReuseTicket(order);

        if (!opened) {
          setStatus(
            `PEDIDO ${id} RECIBIDO, pero la ventana de ticket está cerrada. Tocá PREPARAR VENTANA DE TICKET.`
          );
          return;
        }

        setStatus(`Abriendo ticket ${id}…`);

        await post({
          action: "mark_printed",
          id,
        });

        printedRef.current[id] = Date.now();
        saveMap(printedRef.current);

        setStatus("Listo. Esperando pedidos…");
      } catch (e) {
        if (!stopped) {
          setConnection("offline");
          setLastCheck(Date.now());
          setStatus(
            "ERROR: " + (e?.message || String(e))
          );
        }
      } finally {
        busyRef.current = false;
      }
    };

    const tick = async () => {
      if (stopped) return;

      await poll();

      pollTimerRef.current = setTimeout(
        tick,
        POLL_MS
      );
    };

    tick();

    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        startedRef.current
      ) {
        poll();
      }
    };

    const onFocus = () => {
      if (startedRef.current) {
        poll();
      }
    };

    const onOnline = () => {
      if (startedRef.current) {
        setConnection("connecting");
        setStatus(
          "Conexión recuperada. Buscando pedidos…"
        );
        poll();
      }
    };

    const onOffline = () => {
      if (startedRef.current) {
        setConnection("offline");
        setStatus("Sin conexión a internet.");
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );
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

      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const connectionLabel =
    !started
      ? "DETENIDO"
      : connection === "online"
      ? "CONECTADO"
      : connection === "offline"
      ? "SIN CONEXIÓN"
      : "CONECTANDO…";

  const connectionColor =
    !started
      ? "#777"
      : connection === "online"
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
      <h1 style={{ marginBottom: 8 }}>
        KITCHEN
      </h1>

      {!started ? (
        <div
          style={{
            border: "2px solid #111",
            borderRadius: 14,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontWeight: 800,
              marginBottom: 6,
            }}
          >
            Kitchen necesita iniciarse una vez
          </div>

          <p
            style={{
              opacity: 0.7,
              margin: "0 0 14px",
              lineHeight: 1.45,
            }}
          >
            Este clic habilita la ventana automática del ticket
            y el sonido de pedidos.
          </p>

          <button
            type="button"
            onClick={startKitchen}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 900,
              fontSize: 16,
            }}
          >
            ▶ INICIAR KITCHEN
          </button>
        </div>
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

          <div
            style={{
              fontSize: 12,
              opacity: 0.6,
            }}
          >
            Último chequeo: {formatTime(lastCheck)}
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            opacity: 0.65,
          }}
        >
          {started
            ? `Revisando pedidos cada ${POLL_MS / 1000} segundos`
            : "Todavía no está buscando pedidos"}
        </div>

        {started && (
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              fontSize: 12,
              marginTop: 2,
            }}
          >
            <span>
              {popupReady
                ? "✓ Ticket preparado"
                : "⚠ Ticket no preparado"}
            </span>

            <span>
              {soundEnabled
                ? "✓ Sonido activado"
                : "⚠ Sonido no disponible"}
            </span>
          </div>
        )}
      </div>

      <p
        style={{
          fontWeight: 700,
          lineHeight: 1.4,
        }}
      >
        {status}
      </p>

      {started && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          <button
            type="button"
            onClick={testSound}
            style={{
              padding: "9px 12px",
              borderRadius: 9,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            🔔 Probar sonido
          </button>

          <button
            type="button"
            onClick={prepareTicketAgain}
            style={{
              padding: "9px 12px",
              borderRadius: 9,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Preparar ventana de ticket
          </button>
        </div>
      )}

      {lastId && (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 12,
            marginTop: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              opacity: 0.6,
            }}
          >
            Último ticket
          </div>

          <div
            style={{
              fontWeight: 800,
              fontSize: 18,
              marginTop: 2,
            }}
          >
            {lastId}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={reopenLastTicket}
        disabled={!lastOrder}
        style={{
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ccc",
          background: lastOrder ? "#000" : "#eee",
          color: lastOrder ? "#fff" : "#777",
          cursor: lastOrder
            ? "pointer"
            : "not-allowed",
        }}
      >
        Reabrir último ticket
      </button>

      <p
        style={{
          opacity: 0.65,
          marginTop: 18,
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        Dejá Kitchen y la pestaña de ticket abiertas en la PC
        conectada a la impresora. No cierres la pestaña auxiliar
        de ticket: Kitchen la reutiliza automáticamente para cada
        pedido.
      </p>
    </div>
  );
}

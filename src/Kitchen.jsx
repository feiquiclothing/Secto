import React, { useEffect, useState } from "react";

const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbx3C4Wnvzguh7AVtmdtz1VH9KiAHwXBX6pGjbML-0wGvjJkaLnvBlJ7mAetvnAyTLGlSA/exec";

export default function Kitchen() {
  const [status, setStatus] = useState("Esperando pedidos…");

  useEffect(() => {
    let stop = false;

    const poll = async () => {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "next_unprinted" }),
        });
        const data = await res.json();
        if (stop) return;

        if (data?.order?.id) {
          setStatus("Imprimiendo " + data.order.id);

          sessionStorage.setItem("secto_print_order", JSON.stringify(data.order));
          window.open("/ticket?autoprint=1", "_blank", "noopener,noreferrer");

          await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "mark_printed", id: data.order.id }),
          });

          setStatus("Listo. Esperando pedidos…");
        } else {
          setStatus("Esperando pedidos…");
        }
      } catch (e) {
        if (stop) return;
        setStatus("Error conectando al endpoint");
      }
    };

    const id = setInterval(poll, 2500);
    poll();

    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1>SECTO — KITCHEN</h1>
      <p>{status}</p>
      <p style={{ opacity: 0.7 }}>
        Dejá esta pestaña abierta en la PC conectada a la impresora térmica.
      </p>
    </div>
  );
}

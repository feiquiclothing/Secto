export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const GAS =
    "https://script.google.com/macros/s/AKfycbxrWgSPWPjDqelx1-_iaxvjDLW7ZL6W647UsZVm-ZaxREwY7E4MiQHNOvyNPXXbmHpQzA/exec";

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const r = await fetch(GAS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await r.text();
    res.status(r.status);
    res.setHeader("Content-Type", r.headers.get("content-type") || "text/plain; charset=utf-8");
    res.send(text);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

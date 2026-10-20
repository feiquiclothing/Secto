const GAS =
  "https://script.google.com/macros/s/AKfycbxuORa7W4PT9geGEuZ4UusAN1bIp7eALBTUDd47B0OvupMJj71CzuoosgNba4YilSbELQ/exec";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const r = await fetch(GAS, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(body),
    });

    const text = await r.text();

    try {
      return res.status(r.status).json(JSON.parse(text));
    } catch {
      return res.status(r.status).send(text);
    }
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
    });
  }
}

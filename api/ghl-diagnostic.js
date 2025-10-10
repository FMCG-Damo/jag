// /api/ghl-diagnostic.js
export default async function handler(req, res) {
  try {
    const token = process.env.GHL_PRIVATE_TOKEN;
    if (!token) return res.status(400).json({ error: "Missing GHL_PRIVATE_TOKEN" });

    const bases = [
      "https://services.leadconnectorhq.com/v1/contacts/",
      "https://services.leadconnectorhq.com/v2/contacts/"
    ];

    const results = [];
    for (const base of bases) {
      const r = await fetch(base, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Version: "2021-07-28",
          Accept: "application/json"
        }
      });
      results.push({
        url: base,
        status: r.status,
        text: await r.text()
      });
    }

    res.status(200).json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
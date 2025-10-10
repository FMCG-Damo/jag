// /api/assign-broker.js
export default async function handler(req, res) {
  try {
    // --- CORS headers ---
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Version");

    // --- Preflight check ---
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    // --- Method guard ---
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    console.log("📨 assign-broker called:", req.method, req.body);

    const { email, brokerName } = req.body;
    if (!email || !brokerName) {
      return res.status(400).json({ error: "Missing email or brokerName" });
    }

    console.log("🧩 Assigning broker:", brokerName, "for", email);

    // --- Load brokers.json from public folder ---
    const brokers = await fetch("https://jag-psi.vercel.app/public/brokers.json")
      .then(r => r.json());
    const broker = brokers[brokerName] || brokers["Head Office"];
    if (!broker?.user_id) {
      return res.status(404).json({ error: `Broker not found: ${brokerName}` });
    }

    console.log("🆔 Broker matched:", broker.user_id);

    // --- Update contact via GHL Private API ---
    const ghlResponse = await fetch("https://services.leadconnectorhq.com/contacts/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
        Version: "2021-07-28",
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        customField: {
          "3rfOvf6EJzqJdVfzGBa2": broker.user_id // brokerId field stores the user_id
        }
      })
    });

    const data = await ghlResponse.json();
    console.log("📨 GHL API response:", data);

    if (!ghlResponse.ok) {
      return res.status(ghlResponse.status).json({ error: data });
    }

    // --- Success response ---
    return res.status(200).json({
      success: true,
      brokerName,
      user_id: broker.user_id,
      ghl: data
    });

  } catch (err) {
    console.error("❌ Broker assignment failed:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}

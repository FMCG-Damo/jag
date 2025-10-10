// /api/assign-broker.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, brokerName } = req.body;
    if (!email || !brokerName) {
      throw new Error("Missing email or brokerName");
    }

    console.log("📨 Assigning broker for:", email, "→", brokerName);

    // 1️⃣ Load brokers.json from public folder
    const brokers = await fetch("https://jag-psi.vercel.app/public/brokers.json")
      .then(r => r.json());
    const broker = brokers[brokerName] || brokers["Head Office"];
    if (!broker || !broker.user_id) {
      throw new Error(`Broker not found for ${brokerName}`);
    }

    console.log("🆔 Broker matched:", broker.user_id);

    // 2️⃣ Update GHL contact via Private API
    const ghlResponse = await fetch("https://services.leadconnectorhq.com/contacts/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
        "Version": "2021-07-28",
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        customField: {
          "3rfOvf6EJzqJdVfzGBa2": broker.user_id // BrokerId field now stores the user_id
        }
      })
    });

    const data = await ghlResponse.json();
    console.log("✅ GHL response:", data);

    if (!ghlResponse.ok) {
      throw new Error(`GHL API error: ${JSON.stringify(data)}`);
    }

    res.status(200).json({ success: true, brokerName, user_id: broker.user_id, ghl: data });

  } catch (err) {
    console.error("❌ Broker assignment failed:", err);
    res.status(500).json({ error: err.message });
  }
}

// /api/assign-broker.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  // --- ✅ 1. Always set CORS headers first ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Version, Accept");
  res.setHeader("Access-Control-Max-Age", "86400");

  // --- ✅ 2. Instantly answer preflight requests ---
  if (req.method === "OPTIONS") {
    return res.status(200).json({ success: true, message: "CORS preflight OK" });
  }

  // --- 3. Only accept POSTs from your footer script ---
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  console.log("📨 assign-broker received:", req.body);

  const { email, brokerName } = req.body || {};
  if (!email || !brokerName) {
    return res.status(400).json({ success: false, message: "Missing email or brokerName" });
  }

  try {
    // --- 4️⃣ Load brokers list ---
    const brokersRes = await fetch("https://jag-psi.vercel.app/public/brokers.json");
    const brokers = await brokersRes.json();
    const brokerData = brokers[brokerName] || brokers["Head Office"];
    if (!brokerData?.user_id)
      return res.status(404).json({ success: false, message: "Broker not found" });

    console.log("🧩 Assigning:", brokerName, "→", brokerData.user_id);

    // --- 5️⃣ Lookup contact ---
    const lookupRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/search?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
          Version: "2021-07-28",
          Accept: "application/json",
        },
      }
    );
    const lookupJson = await lookupRes.json();
    const contactId = lookupJson.contacts?.[0]?.id;
    if (!contactId)
      return res.status(404).json({ success: false, message: "Contact not found" });

    // --- 6️⃣ Update custom field via PUT ---
    const updateRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
          Version: "2021-07-28",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          customFields: [
            {
              id: "3rfOvf6EJzqJdVfzGBa2",
              value: brokerData.user_id,
            },
          ],
        }),
      }
    );

    const updateJson = await updateRes.json();
    console.log("📨 GHL update response:", updateJson);

    return res.status(updateRes.ok ? 200 : updateRes.status).json({
      success: updateRes.ok,
      user_id: brokerData.user_id,
      contactId,
      update: updateJson,
    });
  } catch (err) {
    console.error("💥 assign-broker error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

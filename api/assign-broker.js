// /api/assign-broker.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  // --- CORS headers (must be first and unconditional) ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");

  // --- Instantly return for preflight ---
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- Guard against non-POST requests ---
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  // --- Parse body safely ---
  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    console.error("❌ Invalid JSON body:", e);
    return res.status(400).json({ success: false, message: "Invalid JSON" });
  }

  const { email, brokerName } = body || {};
  if (!email || !brokerName) {
    return res.status(400).json({ success: false, message: "Missing email or brokerName" });
  }

  try {
    // --- Load broker data ---
    const brokersRes = await fetch("https://jag-psi.vercel.app/public/brokers.json");
    const brokers = await brokersRes.json();
    const brokerData = brokers[brokerName] || brokers["Head Office"];
    if (!brokerData?.user_id)
      return res.status(404).json({ success: false, message: "Broker not found" });

    console.log("🧩 Assigning broker:", brokerName, "→", brokerData.user_id);

    // --- Lookup contact ---
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

    // --- Update custom field ---
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
    return res.status(updateRes.ok ? 200 : updateRes.status).json({
      success: updateRes.ok,
      user_id: brokerData.user_id,
      contactId,
      update: updateJson,
    });
  } catch (err) {
    console.error("💥 assign-broker fatal error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

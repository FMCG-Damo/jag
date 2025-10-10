// File: /api/assign-broker.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  // --- 0️⃣ Enable CORS so GHL-hosted funnels can talk to this endpoint ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    // Handle preflight without running the rest of the logic
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  console.log("📨 assign-broker called:", req.method, req.body);

  const { email, brokerName } = req.body;
  if (!email || !brokerName) {
    return res.status(400).json({ success: false, message: "Missing email or brokerName" });
  }

  try {
    // --- 1️⃣ Load broker data ---
    const brokersRes = await fetch("https://jag-psi.vercel.app/public/brokers.json");
    const brokers = await brokersRes.json();
    const brokerData = brokers[brokerName] || brokers["Head Office"];

    if (!brokerData?.user_id) {
      console.error("❌ Broker not found:", brokerName);
      return res.status(404).json({ success: false, message: "Broker not found" });
    }

    console.log("🧩 Assigning broker:", brokerName, "→", brokerData.user_id);

    // --- 2️⃣ Get contact by email ---
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

    if (!contactId) {
      console.error("❌ Contact not found for email:", email);
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    console.log("✅ Contact found:", contactId);

    // --- 3️⃣ Update the brokerId field ---
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
              id: "3rfOvf6EJzqJdVfzGBa2", // brokerId field
              value: brokerData.user_id, // assign user_id directly
            },
          ],
        }),
      }
    );

    const updateJson = await updateRes.json();
    console.log("📨 GHL update response:", updateJson);

    if (updateRes.ok) {
      return res.status(200).json({
        success: true,
        user_id: brokerData.user_id,
        contactId,
        update: updateJson,
      });
    } else {
      return res.status(updateRes.status).json({
        success: false,
        message: "Failed to update contact",
        updateJson,
      });
    }
  } catch (err) {
    console.error("💥 assign-broker error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

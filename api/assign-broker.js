// Force standard Node.js runtime (not Edge)
export const config = {
  runtime: "nodejs",
};

import fetch from "node-fetch";

export default async function handler(req, res) {
  // --- Always send CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");

  // --- Handle preflight instantly ---
  if (req.method === "OPTIONS") {
    res.status(200).send("CORS OK");
    return;
  }

  // --- Guard invalid methods ---
  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  // --- Parse body safely ---
  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    console.error("❌ Invalid JSON:", e);
    res.status(400).json({ success: false, message: "Invalid JSON" });
    return;
  }

  const { email, brokerName } = body || {};
  if (!email || !brokerName) {
    res.status(400).json({ success: false, message: "Missing email or brokerName" });
    return;
  }

  try {
    // --- Load brokers.json ---
    const brokersRes = await fetch("https://jag-psi.vercel.app/public/brokers.json");
    const brokers = await brokersRes.json();
    const brokerData = brokers[brokerName] || brokers["Head Office"];
    if (!brokerData?.user_id) {
      res.status(404).json({ success: false, message: "Broker not found" });
      return;
    }

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
    if (!contactId) {
      res.status(404).json({ success: false, message: "Contact not found" });
      return;
    }

    // --- Update brokerId field ---
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
            { id: "3rfOvf6EJzqJdVfzGBa2", value: brokerData.user_id },
          ],
        }),
      }
    );
    const updateJson = await updateRes.json();

    res.status(updateRes.ok ? 200 : updateRes.status).json({
      success: updateRes.ok,
      contactId,
      brokerName,
      brokerUser: brokerData.user_id,
      update: updateJson,
    });
  } catch (err) {
    console.error("💥 assign-broker fatal:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

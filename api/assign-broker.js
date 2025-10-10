// Force Node.js runtime
export const config = {
  runtime: "nodejs20",
};

import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    // ✅ Always send CORS headers first
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Version, Accept");
    res.setHeader("Access-Control-Max-Age", "86400");

    // ✅ Instantly reply to preflight
    if (req.method === "OPTIONS") {
      res.status(200).send("CORS OK");
      return;
    }

    // ✅ Block other methods
    if (req.method !== "POST") {
      res.status(405).json({ success: false, message: "Method Not Allowed" });
      return;
    }

    // ✅ Parse body safely
    let { email, brokerName } =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (!email || !brokerName) {
      res.status(400).json({ success: false, message: "Missing email or brokerName" });
      return;
    }

    console.log("📨 assign-broker POST received:", { email, brokerName });

    // --- Load brokers ---
    const brokersRes = await fetch("https://jag-psi.vercel.app/public/brokers.json");
    const brokers = await brokersRes.json();
    const brokerData = brokers[brokerName] || brokers["Head Office"];
    if (!brokerData?.user_id) {
      res.status(404).json({ success: false, message: "Broker not found" });
      return;
    }

    // --- Lookup contact ---
    const lookup = await fetch(
      `https://services.leadconnectorhq.com/contacts/search?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
          Version: "2021-07-28",
          Accept: "application/json",
        },
      }
    );
    const lookupJson = await lookup.json();
    const contactId = lookupJson.contacts?.[0]?.id;
    if (!contactId) {
      res.status(404).json({ success: false, message: "Contact not found" });
      return;
    }

    // --- Update custom field ---
    const update = await fetch(
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

    const updateJson = await update.json();
    res.status(update.ok ? 200 : update.status).json({
      success: update.ok,
      contactId,
      brokerName,
      brokerUser: brokerData.user_id,
      update: updateJson,
    });
  } catch (err) {
    console.error("💥 assign-broker error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

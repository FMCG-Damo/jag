export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const { email, brokerName } = req.body || {};
  if (!email || !brokerName) {
    return res.status(400).json({ success: false, message: "Missing email or brokerName" });
  }

  console.log("📨 assign-broker called:", req.method, { email, brokerName });

  try {
    // --- 1️⃣ Load brokers.json ---
    const baseUrl =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://jag-psi.vercel.app";

    const brokersRes = await fetch(`${baseUrl}/public/brokers.json`);
    const brokers = await brokersRes.json();
    const brokerData = brokers[brokerName];

    if (!brokerData || !brokerData.user_id) {
      console.warn("⚠️ Broker not found in brokers.json:", brokerName);
      return res.status(404).json({ success: false, message: "Broker not found" });
    }

    console.log("🆔 Broker matched:", brokerData.user_id);

    // --- 2️⃣ Find the contact by email ---
    const searchRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/search?query=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
          Version: "2021-07-28",
          Accept: "application/json"
        }
      }
    );

    const searchJson = await searchRes.json();
    const contactId = searchJson?.contacts?.[0]?.id;

    if (!contactId) {
      console.warn("⚠️ Contact not found for:", email);
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    console.log("👤 Found contact:", contactId);

    // --- 3️⃣ Update the contact’s custom broker field ---
    const updateRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
          Version: "2021-07-28",
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          customFields: [
            {
              id: "3rfOvf6EJzqJdVfzGBa2",
              value: brokerData.user_id
            }
          ]
        })
      }
    );

    const updateJson = await updateRes.json();
    console.log("📨 GHL update response:", updateJson);

    if (updateRes.ok) {
      return res.status(200).json({
        success: true,
        user_id: brokerData.user_id,
        contactId,
        ghlResponse: updateJson
      });
    } else {
      return res.status(updateRes.status).json({
        success: false,
        message: "Failed to update contact",
        details: updateJson
      });
    }
  } catch (err) {
    console.error("❌ assign-broker error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

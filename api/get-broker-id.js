export default async function handler(req, res) {
  if (req.method !== "POST") 
    return res.status(405).json({ error: "Method not allowed" });

  try {
    console.info("📥 Full incoming body:", req.body);

    // Support both direct JSON or GHL-style "customData" wrapper
    const { contactId, brokerName } = req.body?.customData || req.body;
    if (!contactId || !brokerName)
      throw new Error("Missing contactId or brokerName from GHL payload");

    console.info("🧩 Extracted:", { contactId, brokerName });

    // 1️⃣ Load broker mapping
    const brokers = await fetch("https://jag-psi.vercel.app/brokers.json").then(r => r.json());
    const brokerData = brokers[brokerName] || brokers["Head Office"];
    if (!brokerData?.user_id)
      throw new Error(`No user_id found for broker "${brokerName}"`);

    // 2️⃣ Prepare GHL update payload
    const updatePayload = {
      customField: {
        "3rfOvf6EJzqJdVfzGBa2": brokerData.user_id // ← your BrokerId custom field key
      }
    };

    console.info("🚀 Attempting PUT update for contact:", contactId, "→", brokerData.user_id);

    // 3️⃣ Primary attempt: direct update
    const ghlRes = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.GHL_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(updatePayload)
    });

    const raw = await ghlRes.text();
    console.info("🔍 Raw GHL PUT Response:", raw.slice(0, 200));

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.warn("⚠️ Non-JSON response from PUT:", raw.slice(0, 120));
    }

    // 4️⃣ If PUT failed, fallback to UPSERT
    if (!ghlRes.ok) {
      console.warn("⚠️ PUT failed, falling back to UPSERT...");
      const upsertPayload = {
        ...updatePayload,
        id: contactId // tell GHL which contact to update
      };

      const upsertRes = await fetch("https://rest.gohighlevel.com/v1/contacts/upsert", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GHL_PRIVATE_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(upsertPayload)
      });

      const upsertText = await upsertRes.text();
      console.info("🔍 Raw GHL UPSERT Response:", upsertText.slice(0, 200));

      let upsertData;
      try {
        upsertData = JSON.parse(upsertText);
      } catch {
        throw new Error(`Non-JSON UPSERT response: ${upsertText.slice(0, 120)}`);
      }

      if (!upsertRes.ok)
        throw new Error(`Upsert failed: ${JSON.stringify(upsertData)}`);

      console.info("✅ Fallback UPSERT success:", upsertData);
      return res.status(200).json({ success: true, method: "UPSERT", brokerId: brokerData.user_id, data: upsertData });
    }

    // 5️⃣ Success on first try
    console.info("✅ Contact updated successfully via PUT:", data);
    return res.status(200).json({ success: true, method: "PUT", brokerId: brokerData.user_id, data });
  } catch (err) {
    console.error("❌ get-broker-id error:", err);
    return res.status(500).json({ error: err.message });
  }
}

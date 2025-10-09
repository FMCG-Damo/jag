export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("📥 Full incoming body:", req.body);

    // --- Extract and validate input ---
    const contactId = req.body.contact_id || req.body.contactId;
    const brokerName = req.body.brokerId || req.body.brokerName;
    console.log("🧩 Extracted:", { contactId, brokerName });

    if (!contactId || !brokerName) {
      throw new Error("Missing contactId or brokerName from payload");
    }

    // --- Load broker JSON and find the right record ---
    const brokers = await fetch("https://jag-psi.vercel.app/brokers.json").then(r => r.json());
    const brokerData = brokers[brokerName] || brokers["Head Office"];

    if (!brokerData?.user_id) {
      throw new Error(`No user_id found for broker ${brokerName}`);
    }

    const updatePayload = {
      customField: {
        "3rfOvf6EJzqJdVfzGBa2": brokerData.user_id
      }
    };

    console.log("🚀 Update payload:", updatePayload);

    // --- Function to call GHL safely ---
    async function updateContact(url) {
      console.log(`🔗 Attempting PUT to ${url}`);
      const ghlRes = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(updatePayload)
      });

      const text = await ghlRes.text();
      console.log("📡 Raw response:", text);

      if (!ghlRes.ok) throw new Error(`GHL API error: ${text}`);
      return JSON.parse(text);
    }

    // --- Try v2 first, fallback to v1 if needed ---
    let data;
    try {
      data = await updateContact(`https://services.leadconnectorhq.com/v2/contacts/${contactId}`);
    } catch (errV2) {
      console.warn("⚠️ v2 failed, retrying with v1:", errV2.message);
      data = await updateContact(`https://services.leadconnectorhq.com/contacts/${contactId}`);
    }

    console.log("✅ Contact successfully updated:", data);

    return res.status(200).json({
      success: true,
      brokerId: brokerData.user_id,
      response: data
    });

  } catch (err) {
    console.error("❌ get-broker-id error:", err);
    return res.status(500).json({ error: err.message });
  }
}

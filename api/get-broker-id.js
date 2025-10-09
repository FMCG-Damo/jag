export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("📥 Full incoming body:", req.body);

    // --- Extract key fields ---
    const contactId = req.body.contact_id || req.body.contactId;
    const brokerName = req.body.brokerId || req.body.brokerName;
    console.log("🧩 Extracted:", { contactId, brokerName });

    if (!contactId || !brokerName) {
      throw new Error("Missing contactId or brokerName from payload");
    }

    // --- Fetch broker mapping ---
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

    // --- Choose correct endpoint based on token type ---
    const baseUrl = process.env.GHL_PRIVATE_TOKEN?.startsWith("pit-")
      ? "https://services.leadconnectorhq.com/v1/contacts"
      : "https://services.leadconnectorhq.com/v2/contacts";

    const url = `${baseUrl}/${contactId}`;
    console.log(`🔗 PUT → ${url}`);

    // --- Send update to GHL ---
    const ghlRes = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(updatePayload)
    });

    const text = await ghlRes.text();
    console.log("📡 Raw response:", text);

    // --- Parse and handle response ---
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error(`Unexpected response from GHL: ${text.slice(0, 120)}...`);
    }

    if (!ghlRes.ok) {
      throw new Error(`GHL API error: ${JSON.stringify(data)}`);
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

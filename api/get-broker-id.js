export const config = {
  api: {
    bodyParser: false, // read raw body manually
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString();

    // Try parsing JSON first, then URL encoded
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = Object.fromEntries(new URLSearchParams(rawBody));
    }

    console.log("📥 Full incoming body:", body);

    // Safely extract data
    const contactId =
      body.contactId ||
      body.contact_id ||
      body?.customData?.contactId ||
      body?.custom_data?.contactId;

    const brokerName =
      body.brokerName ||
      body.brokerId || // fallback if GHL overwrote field name
      body?.customData?.brokerName ||
      body?.custom_data?.brokerName;

    console.log("🧩 Extracted:", { contactId, brokerName });

    if (!contactId || !brokerName) {
      throw new Error("Missing contactId or brokerName from GHL");
    }

    // Fetch broker data
    const brokers = await fetch("https://jag-psi.vercel.app/brokers.json").then(
      (r) => r.json()
    );
    const brokerData = brokers[brokerName] || brokers["Head Office"];

    if (!brokerData?.user_id) {
      throw new Error(`No user_id found for broker "${brokerName}"`);
    }

    // Update contact in GHL
    const update = {
      customField: {
        "3rfOvf6EJzqJdVfzGBa2": brokerData.user_id, // brokerId field key
      },
    };

    const ghlRes = await fetch(
      `https://rest.gohighlevel.com/v1/contacts/${contactId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.GHL_LOCATION_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(update),
      }
    );

    const data = await ghlRes.json();
    console.log("✅ Updated contact broker ID:", data);

    return res
      .status(200)
      .json({ success: true, brokerId: brokerData.user_id, updated: true });
  } catch (err) {
    console.error("❌ get-broker-id error:", err);
    return res.status(500).json({ error: err.message });
  }
}

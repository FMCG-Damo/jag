export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    console.log("📥 Incoming webhook:", req.body);

    const contactId = req.body.contactId || req.body.contact_id;
    const brokerName = req.body.brokerId || req.body.brokerName;

    if (!contactId || !brokerName)
      throw new Error("Missing contactId or brokerName in payload");

    // Fetch broker list from same domain (root now ./)
    const brokers = await fetch("https://social.jagfs.co.uk/brokers.json").then(r => r.json());

    // Normalise name (spaces vs hyphens vs underscores)
    const normalised = brokerName.trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
    const brokerData = brokers[normalised] || brokers[brokerName] || brokers["Head Office"];

    if (!brokerData?.user_id)
      throw new Error(`No user_id found for broker '${brokerName}'`);

    const updatePayload = {
      customFields: [
        { id: "3rfOvf6EJzqJdVfzGBa2", value: brokerData.user_id }
      ]
    };

    const url = `https://services.leadconnectorhq.com/v1/contacts/${contactId}`;

    console.log(`🔗 PUT → ${url}`, updatePayload);

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

    const data = await ghlRes.json();
    console.log("📡 GHL response:", data);

    if (!ghlRes.ok)
      throw new Error(`GHL API error: ${JSON.stringify(data)}`);

    console.log("✅ Broker successfully updated:", brokerData.user_id);
    return res.status(200).json({
      success: true,
      assignedUserId: brokerData.user_id,
      response: data
    });

  } catch (err) {
    console.error("❌ get-broker-id error:", err);
    return res.status(500).json({ error: err.message });
  }
}

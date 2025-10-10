export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  try {
    const { email, firstName, lastName, brokerName } = req.body;

    const brokers = await fetch("https://social.jagfs.co.uk/brokers.json").then(r => r.json());
    const normalised = brokerName.trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
    const brokerData = brokers[normalised] || brokers[brokerName] || brokers["Head Office"];

    if (!brokerData?.user_id)
      throw new Error(`Broker '${brokerName}' not found in brokers.json`);

    const payload = {
      email,
      firstName,
      lastName,
      customFields: [
        { id: "3rfOvf6EJzqJdVfzGBa2", value: brokerData.user_id }
      ]
    };

    const ghlRes = await fetch("https://services.leadconnectorhq.com/v1/contacts/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await ghlRes.json();
    console.log("📩 GHL contact created:", data);

    if (!ghlRes.ok)
      throw new Error(`GHL error: ${JSON.stringify(data)}`);

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("❌ ghl-contact error:", err);
    res.status(500).json({ error: err.message });
  }
}

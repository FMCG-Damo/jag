export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  try {
    const { email, firstName, lastName, brokerName } = req.body;

    // 1️⃣ Fetch broker JSON from Vercel
    const brokers = await fetch("https://jag-psi.vercel.app/brokers.json").then(r => r.json());
    const brokerData = brokers[brokerName] || brokers["Head Office"];

    if (!brokerData?.user_id) {
      throw new Error(`Broker ${brokerName} not found or missing user_id`);
    }

    // 2️⃣ Send to Go High Level
    const ghlResponse = await fetch("https://rest.gohighlevel.com/v1/contacts/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GHL_LOCATION_KEY}`,
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        firstName,
        lastName,
        customField: {
          "3rfOvf6EJzqJdVfzGBa2": brokerData.user_id // Your BrokerId field
        }
      })
    });

    const data = await ghlResponse.json();
    console.log("📩 GHL API Response:", data);

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("❌ GHL contact creation failed:", err);
    res.status(500).json({ error: err.message });
  }
}

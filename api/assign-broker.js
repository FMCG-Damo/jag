
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(200).send("CORS preflight OK");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method Not Allowed" });
    return;
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ success: false, message: "Invalid JSON" });
    return;
  }

  const { email, brokerName } = body || {};
  if (!email || !brokerName) {
    res.status(400).json({ success: false, message: "Missing email or brokerName" });
    return;
  }

  console.log("📨 assign-broker POST received:", { email, brokerName });

  try {
    const brokersRes = await fetch("https://jag-psi.vercel.app/public/brokers.json");
    const brokers = await brokersRes.json();
    const brokerData = brokers[brokerName] || brokers["Head Office"];

    if (!brokerData?.user_id)
      return res.status(404).json({ success: false, message: "Broker not found" });

    const lookupRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/search?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
          Version: "2021-07-28",
          Accept: "application/json"
        }
      }
    );
    const lookupJson = await lookupRes.json();
    const contactId = lookupJson.contacts?.[0]?.id;

    if (!contactId)
      return res.status(404).json({ success: false, message: "Contact not found" });

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
          customFields: [{ id: "3rfOvf6EJzqJdVfzGBa2", value: brokerData.user_id }]
        })
      }
    );

    const updateJson = await updateRes.json();
    res.status(updateRes.ok ? 200 : updateRes.status).json({
      success: updateRes.ok,
      contactId,
      brokerName,
      brokerUser: brokerData.user_id,
      update: updateJson
    });
  } catch (err) {
    console.error("💥 assign-broker error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Version, Accept");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST" && req.method !== "PUT")
    return res.status(405).json({ success: false, message: "Method Not Allowed" });

  const { email, brokerName } = req.body || {};
  if (!email || !brokerName)
    return res.status(400).json({ success: false, message: "Missing email or brokerName" });

  const token = process.env.GHL_PRIVATE_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId)
    return res.status(500).json({ success: false, message: "Missing GHL_PRIVATE_TOKEN or GHL_LOCATION_ID" });

  console.log("📨 assign-broker:", { email, brokerName });

  try {
    // --- 1️⃣ Correct Private-App search endpoint ---
    const searchUrl = `https://services.leadconnectorhq.com/locations/${locationId}/contacts/search?query=${encodeURIComponent(email)}`;
    console.log("🔍 Searching contact:", searchUrl);

    const searchRes = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Accept": "application/json",
        "User-Agent": "BrokerBot/1.3"
      },
    });

    const searchData = await searchRes.json();
    console.log("🔍 Search response:", searchData);

    if (!searchRes.ok || !searchData.contacts || searchData.contacts.length === 0) {
      return res.status(searchRes.status).json({
        success: false,
        message: "No contact found for that email",
        debug: searchData,
      });
    }

    const contactId = searchData.contacts[0].id;
    console.log("🆔 Found contact ID:", contactId);

    // --- 2️⃣ Update broker field ---
    const updateUrl = `https://services.leadconnectorhq.com/contacts/${contactId}?locationId=${locationId}`;
    console.log("✏️ Updating contact:", updateUrl);

    const updateRes = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customFields: [
          { id: "3rfOvf6EJzqJdVfzGBa2", value: brokerName }
        ]
      }),
    });

    const updateData = await updateRes.json();
    console.log("📬 GHL update response:", updateData);

    if (!updateRes.ok) {
      return res.status(updateRes.status).json({
        success: false,
        message: "Failed to update contact",
        error: updateData,
      });
    }

    res.status(200).json({
      success: true,
      message: `Broker ${brokerName} assigned successfully`,
      contactId,
      update: updateData,
    });
  } catch (err) {
    console.error("💥 assign-broker exception:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

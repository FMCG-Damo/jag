// ✅ Complete drop-in for Vercel: /api/assign-broker.js
// Assigns a broker to a contact in GoHighLevel via Private App token
// Requires: process.env.GHL_PRIVATE_TOKEN set in Vercel environment

export default async function handler(req, res) {
  // --- 1️⃣ CORS setup ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Version, Accept");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // ✅ CORS preflight success
  }

  if (req.method !== "POST" && req.method !== "PUT") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  // --- 2️⃣ Parse input ---
  const { email, brokerName } = req.body || {};
  if (!email || !brokerName) {
    return res.status(400).json({ success: false, message: "Missing email or brokerName" });
  }

  console.log("📨 assign-broker POST received:", { email, brokerName });

  const token = process.env.GHL_PRIVATE_TOKEN;
  if (!token) {
    console.error("❌ Missing environment variable: GHL_PRIVATE_TOKEN");
    return res.status(500).json({ success: false, message: "Missing GHL_PRIVATE_TOKEN" });
  }

  try {
    // --- 3️⃣ Lookup contact by email ---
    const searchUrl = `https://services.leadconnectorhq.com/contacts/?email=${encodeURIComponent(email)}`;
    console.log("🔍 Searching contact:", searchUrl);

    const searchRes = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Accept": "application/json",
      },
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error("❌ Contact search failed:", errText);
      return res.status(searchRes.status).json({
        success: false,
        message: `GHL contact search failed (${searchRes.status})`,
        error: errText,
      });
    }

    const searchData = await searchRes.json();
    console.log("🔍 Contact search response:", searchData);

    if (!searchData.contacts || searchData.contacts.length === 0) {
      console.warn("⚠️ No contact found for:", email);
      return res.status(404).json({ success: false, message: "No contact found for that email" });
    }

    const contactId = searchData.contacts[0].id;
    console.log("🆔 Found contact ID:", contactId);

    // --- 4️⃣ Update custom field with broker name or ID ---
    const updateUrl = `https://services.leadconnectorhq.com/contacts/${contactId}`;
    console.log("✏️ Updating contact:", updateUrl);

    const updateBody = {
      customFields: [
        {
          id: "3rfOvf6EJzqJdVfzGBa2", // ← brokerId custom field ID
          value: brokerName,        // store broker name or user ID here
        },
      ],
    };

    const updateRes = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateBody),
    });

    const updateData = await updateRes.json();
    console.log("📬 GHL update response:", updateData);

    if (!updateRes.ok) {
      console.error("❌ Failed to update contact:", updateData);
      return res.status(updateRes.status).json({
        success: false,
        message: `Failed to update contact (${updateRes.status})`,
        error: updateData,
      });
    }

    // --- 5️⃣ Return success ---
    console.log("✅ Broker successfully assigned:", brokerName);
    return res.status(200).json({
      success: true,
      message: `Broker ${brokerName} assigned`,
      contactId,
      data: updateData,
    });

  } catch (err) {
    console.error("💥 assign-broker exception:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

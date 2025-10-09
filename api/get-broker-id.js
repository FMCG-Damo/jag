export const config = {
  api: {
    bodyParser: false, // We’ll read the raw body ourselves
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 🧠 Read raw body (handles URL-encoded or JSON)
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString();

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = Object.fromEntries(new URLSearchParams(rawBody));
    }

    console.log("📥 Full incoming body:", body);

    // 🧩 Extract broker and contact info from any GHL payload shape
    const contactId =
      body.contactId ||
      body.contact_id ||
      body?.customData?.contactId ||
      body?.custom_data?.contactId;

    const brokerName =
      body.brokerName ||
      body.brokerId ||
      body?.customData?.brokerName ||
      body?.custom_data?.brokerName;

    console.log("🧩 Extracted:", { contactId, brokerName });

    if (!contactId || !brokerName) {
      throw new Error("Missing contactId or brokerName from GHL");
    }

    // 🔎 Fetch broker mapping from your hosted JSON
    const brokers = await fetch("https://jag-psi.vercel.app/brokers.json").then(
      (r) => r.json()
    );

    const brokerData = brokers[brokerName] || brokers["Head Office"];
    if (!brokerData?.user_id) {
      throw new Error(`No user_id found for broker "${brokerName}"`);
    }

    // 🔧 Prepare update payload
    const update = {
      customField: {
        "3rfOvf6EJzqJdVfzGBa2": brokerData.user_id, // brokerId field key
      },
    };

    // 🚀 Send update request to GoHighLevel (correct Location API endpoint)
    const ghlRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.GHL_PRIVATE_KEY}`,
          Version: "2021-07-28",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(update),
      }
    );

    // 🧾 Parse safely (GHL sometimes returns HTML error pages)
    const dataText = await ghlRes.text();
    console.log("📡 Raw GHL response:", dataText);

    let data;
    try {
      data = JSON.parse(dataText);
    } catch {
      throw new Error(
        "GHL returned non-JSON response: " + dataText.slice(0, 120)
      );
    }

    console.log("✅ Updated contact broker ID:", data);

    return res
      .status(200)
      .json({ success: true, brokerId: brokerData.user_id, updated: true });
  } catch (err) {
    console.error("❌ get-broker-id error:", err);
    return res.status(500).json({ error: err.message });
  }
}

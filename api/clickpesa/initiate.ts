// Vercel serverless function – server-side only (credentials never exposed to browser)
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phoneNumber, amount, orderReference } = req.body || {};

  if (!phoneNumber || !amount || !orderReference) {
    return res
      .status(400)
      .json({
        error: "Missing required fields: phoneNumber, amount, orderReference",
      });
  }

  const clientId = process.env.CLICKPESA_CLIENT_ID;
  const apiKey = process.env.CLICKPESA_API_KEY;

  if (!clientId || !apiKey) {
    return res.status(500).json({ error: "Payment service not configured" });
  }

  try {
    // 1. Generate JWT token
    const tokenRes = await fetch(
      "https://api.clickpesa.com/third-parties/generate-token",
      {
        method: "POST",
        headers: {
          "client-id": clientId,
          "api-key": apiKey,
        },
      },
    );

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("ClickPesa auth error:", err);
      return res
        .status(502)
        .json({ error: "Failed to authenticate with payment provider" });
    }

    const { token } = await tokenRes.json();

    // 2. Initiate USSD push to customer's phone
    const pushRes = await fetch(
      "https://api.clickpesa.com/third-parties/payments/initiate-ussd-push-request",
      {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: String(amount),
          currency: "TZS",
          orderReference: String(orderReference),
          phoneNumber: String(phoneNumber),
        }),
      },
    );

    const pushData = await pushRes.json();

    if (!pushRes.ok) {
      return res.status(pushRes.status).json({
        error: pushData.message || "Failed to initiate USSD push",
      });
    }

    return res.status(200).json({
      id: pushData.id,
      status: pushData.status,
      orderReference: pushData.orderReference,
    });
  } catch (err) {
    console.error("ClickPesa initiate error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Vercel serverless function – polls ClickPesa payment status by orderReference
export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const orderReference =
    typeof req.query?.orderReference === "string"
      ? req.query.orderReference
      : Array.isArray(req.query?.orderReference)
        ? req.query.orderReference[0]
        : null;

  if (!orderReference) {
    return res.status(400).json({ error: "Missing orderReference query param" });
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
      return res.status(502).json({ error: "Failed to authenticate with payment provider" });
    }

    const { token } = await tokenRes.json();

    // 2. Query payment status
    const statusRes = await fetch(
      `https://api.clickpesa.com/third-parties/payments/${encodeURIComponent(orderReference)}`,
      {
        headers: {
          Authorization: token,
        },
      },
    );

    if (!statusRes.ok) {
      const err = await statusRes.json().catch(() => ({}));
      return res.status(statusRes.status).json({
        error: (err as any).message || "Failed to query payment status",
      });
    }

    const data = await statusRes.json();
    // API returns an array; take the first entry
    const payment = Array.isArray(data) ? data[0] : data;

    return res.status(200).json({
      status: payment?.status ?? "PROCESSING",
      payment,
    });
  } catch (err) {
    console.error("ClickPesa status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

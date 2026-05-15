// Vercel serverless function – polls Snippe payment status by payment reference
export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const paymentReference =
    typeof req.query?.paymentReference === "string"
      ? req.query.paymentReference
      : Array.isArray(req.query?.paymentReference)
        ? req.query.paymentReference[0]
        : null;

  if (!paymentReference) {
    return res
      .status(400)
      .json({ error: "Missing paymentReference query param" });
  }

  const apiKey = process.env.SNIPPE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Payment service not configured" });
  }

  try {
    const statusRes = await fetch(
      `https://api.snippe.sh/v1/payments/${encodeURIComponent(paymentReference)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
    const payment = data?.data ?? data;

    // Normalise Snippe statuses: pending | completed | failed | voided | expired
    return res.status(200).json({
      status: payment?.status ?? "pending",
      payment,
    });
  } catch (err) {
    console.error("Snippe status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

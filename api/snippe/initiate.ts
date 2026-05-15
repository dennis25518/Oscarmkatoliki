// Vercel serverless function – server-side only (credentials never exposed to browser)
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    phoneNumber,
    amount,
    orderReference,
    firstname: rawFirstname,
    lastname: rawLastname,
    customerEmail,
  } = req.body || {};

  if (!phoneNumber || !amount || !orderReference) {
    return res.status(400).json({
      error: "Missing required fields: phoneNumber, amount, orderReference",
    });
  }

  const apiKey = process.env.SNIPPE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Payment service not configured" });
  }

  const firstname = (rawFirstname || "Customer").trim();
  const lastname = (rawLastname || firstname).trim() || firstname;

  const customerObj: Record<string, string> = {
    firstname,
    lastname,
    email: customerEmail || `guest@donation.tz`,
  };

  try {
    const paymentRes = await fetch("https://api.snippe.sh/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `order-${orderReference}`,
      },
      body: JSON.stringify({
        payment_type: "mobile",
        details: {
          amount: Number(amount),
          currency: "TZS",
        },
        phone_number: String(phoneNumber),
        customer: customerObj,
        metadata: {
          order_id: String(orderReference),
        },
      }),
    });

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error("Snippe initiate error:", JSON.stringify(paymentData));
      const errMsg =
        paymentData?.message ||
        paymentData?.error ||
        (Array.isArray(paymentData?.errors)
          ? paymentData.errors.map((e: any) => e.message || e).join(", ")
          : null) ||
        "Failed to initiate payment";
      return res.status(paymentRes.status).json({ error: errMsg });
    }

    const payment = paymentData?.data ?? paymentData;
    const paymentRef = payment.reference;

    // Trigger the USSD push to the customer's phone
    try {
      const pushRes = await fetch(
        `https://api.snippe.sh/v1/payments/${paymentRef}/push`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );
      const pushData = await pushRes.json().catch(() => null);
      if (!pushRes.ok) {
        console.error(
          `USSD push failed (${pushRes.status}):`,
          JSON.stringify(pushData),
        );
      } else {
        console.log("USSD push triggered:", JSON.stringify(pushData));
      }
    } catch (pushErr) {
      console.error("USSD push network error:", pushErr);
    }

    return res.status(200).json({
      reference: paymentRef,
      status: payment.status,
      orderReference,
    });
  } catch (err) {
    console.error("Snippe initiate error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

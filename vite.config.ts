import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (including server-side ones without VITE_ prefix)
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      {
        name: "snippe-api-dev-middleware",
        configureServer(server) {
          const apiKey = env.SNIPPE_API_KEY;

          // POST /api/snippe/initiate
          server.middlewares.use(
            "/api/snippe/initiate",
            async (req: IncomingMessage, res: ServerResponse, next) => {
              if (req.method !== "POST") return next();

              if (!apiKey) {
                return json(res, 500, {
                  error: "Payment service not configured",
                });
              }

              try {
                const raw = await readBody(req);
                const {
                  phoneNumber,
                  amount,
                  orderReference,
                  firstname: rawFirstname,
                  lastname: rawLastname,
                  customerEmail,
                } = JSON.parse(raw);

                if (!phoneNumber || !amount || !orderReference) {
                  return json(res, 400, {
                    error:
                      "Missing required fields: phoneNumber, amount, orderReference",
                  });
                }

                const firstname = (rawFirstname || "Customer").trim();
                const lastname = (rawLastname || firstname).trim() || firstname;

                const customerObj: Record<string, string> = {
                  firstname,
                  lastname,
                  email: customerEmail || `guest@donation.tz`,
                };

                const paymentRes = await fetch(
                  "https://api.snippe.sh/v1/payments",
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${apiKey}`,
                      "Content-Type": "application/json",
                      "Idempotency-Key": `order-${orderReference}`,
                    },
                    body: JSON.stringify({
                      payment_type: "mobile",
                      details: { amount: Number(amount), currency: "TZS" },
                      phone_number: String(phoneNumber),
                      customer: customerObj,
                      metadata: { order_id: String(orderReference) },
                    }),
                  },
                );

                const paymentData = await paymentRes.json();

                if (!paymentRes.ok) {
                  console.error(
                    "Snippe API error:",
                    JSON.stringify(paymentData),
                  );
                  const errMsg =
                    paymentData?.message ||
                    paymentData?.error ||
                    (Array.isArray(paymentData?.errors)
                      ? paymentData.errors
                          .map((e: any) => e.message || e)
                          .join(", ")
                      : null) ||
                    "Failed to initiate payment";
                  return json(res, paymentRes.status, { error: errMsg });
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

                return json(res, 200, {
                  reference: paymentRef,
                  status: payment.status,
                  orderReference,
                });
              } catch (err) {
                console.error("Snippe initiate error:", err);
                return json(res, 500, { error: "Internal server error" });
              }
            },
          );

          // GET /api/snippe/status
          server.middlewares.use(
            "/api/snippe/status",
            async (req: IncomingMessage, res: ServerResponse, next) => {
              if (req.method !== "GET") return next();

              if (!apiKey) {
                return json(res, 500, {
                  error: "Payment service not configured",
                });
              }

              const url = new URL(req.url!, `http://localhost`);
              const paymentReference = url.searchParams.get("paymentReference");

              if (!paymentReference) {
                return json(res, 400, {
                  error: "Missing paymentReference query param",
                });
              }

              try {
                const statusRes = await fetch(
                  `https://api.snippe.sh/v1/payments/${encodeURIComponent(paymentReference)}`,
                  { headers: { Authorization: `Bearer ${apiKey}` } },
                );

                const data = await statusRes.json();

                if (!statusRes.ok) {
                  return json(res, statusRes.status, {
                    error: data?.message || "Failed to query payment status",
                  });
                }

                const payment = data?.data ?? data;
                return json(res, 200, {
                  status: payment?.status ?? "pending",
                  payment,
                });
              } catch (err) {
                console.error("Snippe status error:", err);
                return json(res, 500, { error: "Internal server error" });
              }
            },
          );
        },
      },
    ],
    build: {
      chunkSizeWarningLimit: 600,
    },
    server: {
      port: 3000,
      strictPort: false,
    },
  };
});

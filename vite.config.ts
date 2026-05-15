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
        name: "clickpesa-api-dev-middleware",
        configureServer(server) {
          const clientId = env.CLICKPESA_CLIENT_ID;
          const apiKey = env.CLICKPESA_API_KEY;

          const getToken = async (): Promise<string | null> => {
            try {
              const tokenRes = await fetch(
                "https://api.clickpesa.com/third-parties/generate-token",
                {
                  method: "POST",
                  headers: { "client-id": clientId!, "api-key": apiKey! },
                },
              );
              if (!tokenRes.ok) return null;
              const { token } = await tokenRes.json();
              return token as string;
            } catch {
              return null;
            }
          };

          // POST /api/clickpesa/initiate
          server.middlewares.use(
            "/api/clickpesa/initiate",
            async (req: IncomingMessage, res: ServerResponse, next) => {
              if (req.method !== "POST") return next();

              if (!clientId || !apiKey) {
                return json(res, 500, {
                  error: "Payment service not configured",
                });
              }

              try {
                const raw = await readBody(req);
                const { phoneNumber, amount, orderReference } = JSON.parse(raw);

                if (!phoneNumber || !amount || !orderReference) {
                  return json(res, 400, {
                    error:
                      "Missing required fields: phoneNumber, amount, orderReference",
                  });
                }

                const token = await getToken();
                if (!token) {
                  return json(res, 502, {
                    error: "Failed to authenticate with payment provider",
                  });
                }

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
                  console.error(
                    "ClickPesa initiate error:",
                    JSON.stringify(pushData),
                  );
                  return json(res, pushRes.status, {
                    error: pushData.message || "Failed to initiate USSD push",
                  });
                }

                return json(res, 200, {
                  id: pushData.id,
                  status: pushData.status,
                  orderReference: pushData.orderReference,
                });
              } catch (err) {
                console.error("ClickPesa initiate error:", err);
                return json(res, 500, { error: "Internal server error" });
              }
            },
          );

          // GET /api/clickpesa/status
          server.middlewares.use(
            "/api/clickpesa/status",
            async (req: IncomingMessage, res: ServerResponse, next) => {
              if (req.method !== "GET") return next();

              if (!clientId || !apiKey) {
                return json(res, 500, {
                  error: "Payment service not configured",
                });
              }

              const url = new URL(req.url!, `http://localhost`);
              const orderReference = url.searchParams.get("orderReference");

              if (!orderReference) {
                return json(res, 400, {
                  error: "Missing orderReference query param",
                });
              }

              try {
                const token = await getToken();
                if (!token) {
                  return json(res, 502, {
                    error: "Failed to authenticate with payment provider",
                  });
                }

                const statusRes = await fetch(
                  `https://api.clickpesa.com/third-parties/payments/${encodeURIComponent(orderReference)}`,
                  { headers: { Authorization: token } },
                );

                if (!statusRes.ok) {
                  const err = await statusRes.json().catch(() => ({}));
                  return json(res, statusRes.status, {
                    error:
                      (err as any).message || "Failed to query payment status",
                  });
                }

                const data = await statusRes.json();
                const payment = Array.isArray(data) ? data[0] : data;
                return json(res, 200, {
                  status: payment?.status ?? "PROCESSING",
                  payment,
                });
              } catch (err) {
                console.error("ClickPesa status error:", err);
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

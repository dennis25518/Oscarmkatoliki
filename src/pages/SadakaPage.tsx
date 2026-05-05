import * as React from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiHeart } from "react-icons/fi";
import { useAuth } from "../lib/AuthContext";
import { useToast } from "../components/Toast";
import { orders, profiles } from "../lib/supabaseClient";

type DonationProvider = "mpesa" | "tigopesa" | "airtel" | "halo";
type PaymentState = "idle" | "initiating" | "waiting" | "failed";

const PROVIDERS: {
  name: string;
  provider: DonationProvider;
  color: string;
  image: string;
}[] = [
  {
    name: "M-Pesa",
    provider: "mpesa",
    color: "bg-gradient-to-br from-blue-500 to-blue-600",
    image: "/Asset/mpesa.png",
  },
  {
    name: "Airtel Money",
    provider: "airtel",
    color: "bg-gradient-to-br from-red-500 to-red-600",
    image: "/Asset/airtelmoney.png",
  },
  {
    name: "TIGO Pesa",
    provider: "tigopesa",
    color: "bg-gradient-to-br from-yellow-500 to-yellow-600",
    image: "/Asset/mixx.png",
  },
  {
    name: "Halo Pesa",
    provider: "halo",
    color: "bg-gradient-to-br from-purple-500 to-purple-600",
    image: "/Asset/halopesa.png",
  },
];

export function SadakaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [amount, setAmount] = React.useState(5000);
  const [customAmount, setCustomAmount] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [paymentState, setPaymentState] = React.useState<PaymentState>("idle");
  const [userPhone, setUserPhone] = React.useState("");

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = React.useRef(0);

  const donationAmounts = [5000, 10000, 25000, 50000, 100000];

  React.useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    profiles.getProfile(user.id).then(({ data }) => {
      if (data?.phone) setUserPhone(data.phone);
    });
  }, [user, navigate]);

  React.useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const getAmountToUse = () =>
    customAmount ? parseInt(customAmount) || 0 : amount;

  const normalizePhone = (phone: string) => {
    const cleaned = phone.replace(/[\s\-\+\(\)]/g, "");
    if (cleaned.startsWith("0")) return "255" + cleaned.slice(1);
    if (cleaned.startsWith("255")) return cleaned;
    return "255" + cleaned;
  };

  const handleDonate = async (provider: DonationProvider) => {
    if (!user) {
      showToast("Lazima uwe umeingia kuendelea", "warning");
      return;
    }

    const donationAmount = getAmountToUse();
    if (!donationAmount || donationAmount < 500) {
      showToast("Tafadhali ingiza kiasi sahihi (angalau Tsh 500)", "warning");
      return;
    }

    if (!userPhone) {
      showToast(
        "Tafadhali ongeza nambari ya simu kwenye wasifu wako kwanza",
        "warning",
      );
      navigate("/profile?tab=account");
      return;
    }

    setPaymentState("initiating");

    try {
      const phone = normalizePhone(userPhone);
      const orderRef = `DON${Date.now()}`;

      const initiateRes = await fetch("/api/clickpesa/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone,
          amount: String(donationAmount),
          orderReference: orderRef,
        }),
      });

      const initiateData = await initiateRes.json();

      if (!initiateRes.ok) {
        showToast(initiateData.error || "Kosa la kuanzisha malipo", "error");
        setPaymentState("idle");
        return;
      }

      setPaymentState("waiting");
      showToast(
        "Ombi limetumwa! Angalia simu yako na idhinisha sadaka.",
        "info",
      );

      pollCountRef.current = 0;
      pollRef.current = setInterval(async () => {
        pollCountRef.current += 1;

        if (pollCountRef.current > 36) {
          clearInterval(pollRef.current!);
          setPaymentState("failed");
          showToast(
            "Muda wa malipo umekwisha. Tafadhali jaribu tena.",
            "error",
          );
          return;
        }

        try {
          const statusRes = await fetch(
            `/api/clickpesa/status?orderReference=${encodeURIComponent(orderRef)}`,
          );
          const { status } = await statusRes.json();

          if (status === "SUCCESS" || status === "SETTLED") {
            clearInterval(pollRef.current!);
            const providerName =
              PROVIDERS.find((p) => p.provider === provider)?.name ?? provider;

            await orders.createOrder({
              user_id: user.id,
              order_number: orderRef,
              total: donationAmount,
              status: "completed",
              items: [
                {
                  product_id: "donation",
                  name: `Sadaka - ${providerName}`,
                  price: donationAmount,
                  quantity: 1,
                },
              ],
            });

            setPaymentState("idle");
            setCustomAmount("");
            setMessage("");
            showToast(
              `Asante sana! Sadaka yako ya Tsh ${donationAmount.toLocaleString("sw-TZ")} imepokelewa. Mungu akubariki!`,
              "success",
              7000,
            );
            setTimeout(() => navigate("/profile?tab=orders"), 3000);
          } else if (status === "FAILED") {
            clearInterval(pollRef.current!);
            setPaymentState("failed");
            showToast("Malipo yalikataliwa. Tafadhali jaribu tena.", "error");
          }
        } catch (e) {
          console.error("Status poll error:", e);
        }
      }, 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hitilafu isiyojulikana";
      showToast(msg, "error");
      setPaymentState("idle");
    }
  };

  if (!user) return null;

  const displayAmount = getAmountToUse();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/")}
            className="p-2 hover:bg-amber-100 rounded-lg transition"
          >
            <FiArrowLeft size={24} className="text-amber-700" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-amber-900 flex items-center gap-2">
              <FiHeart size={32} className="text-red-600" />
              Sadaka
            </h1>
            <p className="text-gray-600 mt-1">
              Toa sadaka kwa njia ya simu ya pesa
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left – amount + message + payment */}
          <div className="lg:col-span-2 space-y-8">
            {/* Amount */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-black mb-6">
                Chagua Kiasi cha Sadaka
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {donationAmounts.map((a) => (
                  <button
                    key={a}
                    onClick={() => {
                      setAmount(a);
                      setCustomAmount("");
                    }}
                    disabled={paymentState !== "idle"}
                    className={`p-4 rounded-lg font-semibold transition ${
                      amount === a && !customAmount
                        ? "bg-amber-700 text-white shadow-lg"
                        : "bg-gray-100 text-black hover:bg-amber-100"
                    } disabled:opacity-50`}
                  >
                    Tsh {a.toLocaleString("sw-TZ")}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-semibold text-black mb-2">
                  Kiasi Maalum
                </label>
                <div className="flex gap-4">
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    disabled={paymentState !== "idle"}
                    placeholder="Ingiza kiasi..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-700 disabled:opacity-50"
                  />
                  <span className="flex items-center text-gray-600 font-semibold">
                    TZS
                  </span>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-black mb-6">
                Ujumbe (Hiyari)
              </h2>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={paymentState !== "idle"}
                placeholder="Andika ujumbe wako kwa Mungu..."
                maxLength={500}
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-700 disabled:opacity-50"
              />
              <p className="text-sm text-gray-500 mt-2">
                {message.length}/500 herufi
              </p>
            </div>

            {/* Provider selection – idle only */}
            {paymentState === "idle" && (
              <div className="bg-white rounded-lg shadow-md p-8">
                <h2 className="text-2xl font-bold text-black mb-2">
                  Chagua Njia ya Malipo
                </h2>
                <p className="text-gray-600 mb-6">
                  Chagua njia ya simu ya pesa unayopendelea
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {PROVIDERS.map((method) => (
                    <button
                      key={method.provider}
                      onClick={() => handleDonate(method.provider)}
                      className={`${method.color} p-6 rounded-lg text-white font-semibold transition transform hover:scale-105 hover:shadow-lg`}
                    >
                      <img
                        src={method.image}
                        alt={method.name}
                        className="w-16 h-16 mx-auto mb-3 object-contain rounded-lg bg-white/20 p-1"
                      />
                      <div>{method.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Initiating */}
            {paymentState === "initiating" && (
              <div className="bg-white rounded-lg shadow-md p-10 text-center">
                <div className="animate-spin rounded-full h-14 w-14 border-4 border-amber-700 border-t-transparent mx-auto mb-4" />
                <p className="text-black font-semibold">
                  Inatuma ombi la malipo...
                </p>
              </div>
            )}

            {/* Waiting */}
            {paymentState === "waiting" && (
              <div className="bg-white rounded-lg shadow-md p-10 text-center">
                <div className="text-5xl mb-4 animate-bounce">📱</div>
                <p className="text-black font-bold text-xl mb-2">
                  Angalia Simu Yako
                </p>
                <p className="text-gray-600 text-sm mb-4">
                  Ombi la sadaka ya{" "}
                  <span className="font-bold text-amber-700">
                    Tsh {displayAmount.toLocaleString("sw-TZ")}
                  </span>{" "}
                  limetumwa. Idhinisha kwenye simu yako.
                </p>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-700 border-t-transparent" />
                  <p className="text-gray-500 text-sm">
                    Inasubiri uthibitisho...
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (pollRef.current) clearInterval(pollRef.current);
                    setPaymentState("idle");
                  }}
                  className="text-red-500 text-sm underline hover:text-red-700 transition"
                >
                  Ghairi
                </button>
              </div>
            )}

            {/* Failed */}
            {paymentState === "failed" && (
              <div className="bg-white rounded-lg shadow-md p-10 text-center">
                <div className="text-5xl mb-4">❌</div>
                <p className="text-black font-bold text-lg mb-2">
                  Sadaka Haikufanikiwa
                </p>
                <p className="text-gray-600 text-sm mb-6">
                  Tafadhali hakikisha nambari yako ya simu ni sahihi na jaribu
                  tena.
                </p>
                <button
                  onClick={() => setPaymentState("idle")}
                  className="px-8 py-3 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition"
                >
                  Jaribu Tena
                </button>
              </div>
            )}
          </div>

          {/* Sidebar – summary */}
          <div>
            <div className="sticky top-20 bg-white rounded-lg shadow-md p-8">
              <h3 className="text-2xl font-bold text-black mb-6">Muhtasari</h3>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Kiasi cha Sadaka:</span>
                  <span className="font-semibold text-black">
                    Tsh {displayAmount.toLocaleString("sw-TZ")}
                  </span>
                </div>
                {message && (
                  <div className="flex justify-between items-start">
                    <span className="text-gray-600">Ujumbe:</span>
                    <span className="font-semibold text-black text-right max-w-xs">
                      {message.substring(0, 30)}
                      {message.length > 30 ? "..." : ""}
                    </span>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-200 pt-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-black">Jumla:</span>
                  <span className="text-2xl font-bold text-amber-700">
                    Tsh {displayAmount.toLocaleString("sw-TZ")}
                  </span>
                </div>
              </div>
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-6 border border-amber-200">
                <p className="text-sm text-amber-900">
                  <strong>Karibu sana!</strong> Sadaka yako itasaidia kuendeleza
                  huduma zetu za kikristo na kusambaza Injili.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

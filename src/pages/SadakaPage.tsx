import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiHeart,
  FiPhone,
  FiCheckCircle,
  FiCreditCard,
} from "react-icons/fi";
import { useAuth } from "../lib/AuthContext";
import { useToast } from "../components/Toast";
import { MpesaGuideModal } from "../components/MpesaGuideModal";
import {
  orders,
  paymentMethods as paymentMethodsApi,
  profiles as profilesApi,
  sadaka as sadakaApi,
} from "../lib/supabaseClient";
import type { PaymentMethod } from "../lib/supabaseClient";

type DonationProvider = "mpesa" | "tigopesa" | "airtel" | "halo";
type PaymentState = "idle" | "initiating" | "waiting" | "failed" | "success";

const PROVIDERS: {
  name: string;
  provider: DonationProvider;
  image: string;
}[] = [
  { name: "M-Pesa", provider: "mpesa", image: "/Asset/mpesa.png" },
  { name: "Airtel Money", provider: "airtel", image: "/Asset/airtelmoney.png" },
  { name: "TIGO Pesa", provider: "tigopesa", image: "/Asset/mixx.png" },
  { name: "Halo Pesa", provider: "halo", image: "/Asset/halopesa.png" },
];

const networkToProvider = (networkName: string): DonationProvider => {
  const n = networkName.toLowerCase();
  if (n.includes("mpesa") || n.includes("m-pesa")) return "mpesa";
  if (n.includes("airtel")) return "airtel";
  if (n.includes("tigo") || n.includes("mixx")) return "tigopesa";
  return "halo";
};

export function SadakaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [amount, setAmount] = React.useState(5000);
  const [customAmount, setCustomAmount] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [paymentState, setPaymentState] = React.useState<PaymentState>("idle");

  // Saved payment method for logged-in users
  const [savedMethod, setSavedMethod] = React.useState<PaymentMethod | null>(
    null,
  );
  const [loadingProfile, setLoadingProfile] = React.useState(false);
  const [hasNoPaymentMethod, setHasNoPaymentMethod] = React.useState(false);

  // Registered user name (fetched from profile)
  const [registeredName, setRegisteredName] = React.useState("");

  // Guest flow
  const [selectedProvider, setSelectedProvider] =
    React.useState<DonationProvider | null>(null);
  const [guestPhone, setGuestPhone] = React.useState("");
  const [guestFirstName, setGuestFirstName] = React.useState("");
  const [guestLastName, setGuestLastName] = React.useState("");

  // Phone number actively being used for payment (shown in waiting UI)
  const [pendingPhone, setPendingPhone] = React.useState("");

  // M-Pesa manual payment modal
  const [showMpesaModal, setShowMpesaModal] = React.useState(false);
  const [mpesaModalAmount, setMpesaModalAmount] = React.useState<number | undefined>(undefined);

  // Success screen data
  const [successData, setSuccessData] = React.useState<{
    amount: number;
    providerName: string;
    providerImage: string;
  } | null>(null);

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = React.useRef(0);

  const donationAmounts = [5000, 10000, 25000, 50000, 100000];

  React.useEffect(() => {
    if (!user) return;
    setLoadingProfile(true);
    Promise.all([
      paymentMethodsApi.getPaymentMethods(user.id),
      profilesApi.getProfile(user.id),
    ]).then(([{ data: methods }, { data: profile }]) => {
      if (methods && methods.length > 0) {
        setSavedMethod(methods.find((m) => m.is_preferred) ?? methods[0]);
        setHasNoPaymentMethod(false);
      } else {
        setHasNoPaymentMethod(true);
      }
      if (profile?.name) setRegisteredName(profile.name);
      setLoadingProfile(false);
    });
  }, [user]);

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

  const handleDonate = async (
    provider: DonationProvider,
    phone: string,
    firstname: string,
    lastname: string,
  ) => {
    const donationAmount = getAmountToUse();
    if (!donationAmount || donationAmount < 500) {
      showToast("Tafadhali ingiza kiasi sahihi (angalau Tsh 500)", "warning");
      return;
    }
    if (!phone.trim()) {
      showToast("Tafadhali ingiza nambari ya simu", "warning");
      return;
    }
    if (!firstname.trim()) {
      showToast("Tafadhali ingiza jina la kwanza", "warning");
      return;
    }

    setPaymentState("initiating");

    // M-Pesa (Vodacom) is not supported via USSD push — show manual guide
    if (provider === "mpesa") {
      setMpesaModalAmount(getAmountToUse());
      setShowMpesaModal(true);
      setPaymentState("idle");
      return;
    }

    try {
      const normalizedPhone = normalizePhone(phone);
      setPendingPhone(normalizedPhone);
      const orderRef = `DON${Date.now()}`;
      const providerInfo = PROVIDERS.find((p) => p.provider === provider)!;

      const initiateRes = await fetch("/api/clickpesa/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: normalizedPhone,
          amount: String(donationAmount),
          orderReference: orderRef,
        }),
      });

      const initiateData = initiateRes.headers
        .get("content-type")
        ?.includes("application/json")
        ? await initiateRes.json()
        : { error: `Server error ${initiateRes.status}` };

      if (!initiateRes.ok) {
        showToast(initiateData.error || "Kosa la kuanzisha malipo", "error");
        setPaymentState("idle");
        return;
      }

      setPaymentState("waiting");
      showToast(
        "Ombi limetumwa! Angalia simu yako na idhinisha malipo.",
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

          if (status === "SUCCESS") {
            clearInterval(pollRef.current!);

            // Record donation – write to sadaka table + orders for history
            if (user) {
              await Promise.all([
                sadakaApi.createDonation({
                  user_id: user.id,
                  amount: donationAmount,
                  network_name: providerInfo.name,
                  phone_number: normalizedPhone,
                  order_reference: orderRef,
                  message: null,
                  status: "completed",
                }),
                orders.createOrder({
                  user_id: user.id,
                  order_number: orderRef,
                  total: donationAmount,
                  status: "completed",
                  items: [
                    {
                      product_id: "donation",
                      name: `Sadaka - ${providerInfo.name}`,
                      price: donationAmount,
                      quantity: 1,
                    },
                  ],
                }),
              ]);
            } else {
              // Guest donation – record without user_id
              await sadakaApi.createDonation({
                user_id: null,
                amount: donationAmount,
                network_name: providerInfo.name,
                phone_number: normalizedPhone,
                order_reference: orderRef,
                message: null,
                status: "completed",
              });
            }

            setSuccessData({
              amount: donationAmount,
              providerName: providerInfo.name,
              providerImage: providerInfo.image,
            });
            setPaymentState("success");
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

  const displayAmount = getAmountToUse();

  // ── SUCCESS SCREEN ──
  if (paymentState === "success" && successData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-amber-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiCheckCircle size={56} className="text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-black mb-2">Asante Sana!</h1>
          <p className="text-gray-500 mb-8">
            Sadaka yako imepokelewa. Mungu akubariki!
          </p>
          <div className="bg-amber-50 rounded-xl p-6 mb-6 border border-amber-200">
            <img
              src={successData.providerImage}
              alt={successData.providerName}
              className="w-16 h-16 mx-auto mb-3 object-contain"
            />
            <p className="text-sm text-gray-500 mb-1">
              {successData.providerName}
            </p>
            <p className="text-4xl font-bold text-amber-700">
              Tsh {successData.amount.toLocaleString("sw-TZ")}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              imepokelewa kwa mafanikio
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 mb-8 border border-green-200">
            <p className="text-sm text-green-800 italic">
              "Kila mtu amtolee kama alivyokusudia moyoni mwake; si kwa huzuni,
              wala si kwa lazima; maana Mungu hupenda yeye atoaye kwa furaha."
            </p>
            <p className="text-xs text-green-600 mt-2 font-semibold">
              — 2 Wakorintho 9:7
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition"
            >
              Rudi Nyumbani
            </button>
            {user && (
              <button
                onClick={() => navigate("/profile?tab=orders")}
                className="w-full py-3 border border-amber-700 text-amber-700 hover:bg-amber-50 font-semibold rounded-lg transition"
              >
                Angalia Historia ya Sadaka
              </button>
            )}
            <button
              onClick={() => {
                setPaymentState("idle");
                setSuccessData(null);
                setCustomAmount("");
                setMessage("");
                setGuestPhone("");
                setGuestFirstName("");
                setGuestLastName("");
                setSelectedProvider(null);
                setPendingPhone("");
              }}
              className="text-sm text-gray-400 hover:text-gray-600 transition mt-1"
            >
              Toa Sadaka Nyingine
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 py-8 px-4">
      {showMpesaModal && (
        <MpesaGuideModal
          amount={mpesaModalAmount}
          onClose={() => setShowMpesaModal(false)}
        />
      )}
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

            {/* Payment section */}
            {paymentState === "idle" && (
              <div className="bg-white rounded-lg shadow-md p-8">
                <h2 className="text-2xl font-bold text-black mb-6">
                  Njia ya Malipo
                </h2>

                {/* Loading */}
                {user && loadingProfile && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-700 border-t-transparent" />
                  </div>
                )}

                {/* Logged-in: has saved payment method */}
                {user && !loadingProfile && savedMethod && (
                  <div>
                    <p className="text-gray-600 mb-4">
                      Tumia nambari yako iliyohifadhiwa:
                    </p>
                    <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                      <img
                        src={
                          PROVIDERS.find(
                            (p) =>
                              networkToProvider(savedMethod.network_name) ===
                              p.provider,
                          )?.image ?? "/Asset/mpesa.png"
                        }
                        alt={savedMethod.network_name}
                        className="w-14 h-14 object-contain"
                      />
                      <div>
                        <p className="font-bold text-black">
                          {savedMethod.network_name}
                        </p>
                        <p className="text-gray-600 text-sm">
                          +255{savedMethod.network_number?.slice(-7)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const nameParts = (
                          registeredName ||
                          user?.user_metadata?.full_name ||
                          user?.user_metadata?.name ||
                          ""
                        )
                          .trim()
                          .split(/\s+/)
                          .filter(Boolean);
                        const fn =
                          nameParts[0] ||
                          user?.email?.split("@")[0] ||
                          "Mtoaji";
                        const ln = nameParts.slice(1).join(" ") || fn;
                        const provider = networkToProvider(
                          savedMethod.network_name,
                        );
                        if (provider === "mpesa") {
                          setMpesaModalAmount(getAmountToUse());
                          setShowMpesaModal(true);
                          return;
                        }
                        handleDonate(
                          provider,
                          savedMethod.network_number ?? "",
                          fn,
                          ln,
                        );
                      }}
                      className="w-full py-4 bg-amber-700 hover:bg-amber-800 text-white font-bold text-lg rounded-xl transition"
                    >
                      Toa Sadaka ya Tsh {displayAmount.toLocaleString("sw-TZ")}
                    </button>
                    <button
                      onClick={() => navigate("/profile?tab=account")}
                      className="w-full mt-3 text-sm text-amber-700 hover:underline"
                    >
                      Badilisha njia ya malipo
                    </button>
                  </div>
                )}

                {/* Logged-in: no payment method saved */}
                {user && !loadingProfile && hasNoPaymentMethod && (
                  <div className="text-center py-6">
                    <FiCreditCard
                      size={48}
                      className="mx-auto text-gray-300 mb-4"
                    />
                    <p className="text-gray-600 mb-2">
                      Hujahifadhi njia ya malipo.
                    </p>
                    <p className="text-gray-500 text-sm mb-6">
                      Ongeza nambari yako ya simu kwenye wasifu wako kwanza.
                    </p>
                    <button
                      onClick={() => navigate("/profile?tab=account")}
                      className="px-8 py-3 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition"
                    >
                      Ongeza Njia ya Malipo
                    </button>
                  </div>
                )}

                {/* Guest: network icons row + phone input */}
                {!user && (
                  <div>
                    <p className="text-gray-600 mb-6">
                      Chagua mtandao wako wa malipo:
                    </p>
                    <div className="flex justify-around items-start gap-2 mb-6">
                      {PROVIDERS.map((p) => (
                        <button
                          key={p.provider}
                          onClick={() => {
                            setSelectedProvider(p.provider);
                            setGuestPhone("");
                          }}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl transition border-2 ${
                            selectedProvider === p.provider
                              ? "border-amber-700 bg-amber-50 shadow-md"
                              : "border-transparent hover:border-amber-300 hover:bg-amber-50"
                          }`}
                        >
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-14 h-14 object-contain"
                          />
                          <span className="text-xs font-semibold text-gray-600">
                            {p.name}
                          </span>
                        </button>
                      ))}
                    </div>

                    {selectedProvider && (
                      <div className="border-t border-gray-100 pt-6 space-y-4">
                        {/* First name */}
                        <div>
                          <label className="block text-sm font-semibold text-black mb-2">
                            Jina la Kwanza
                          </label>
                          <input
                            type="text"
                            value={guestFirstName}
                            onChange={(e) => setGuestFirstName(e.target.value)}
                            placeholder="Mfano: John"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-700"
                          />
                        </div>
                        {/* Last name */}
                        <div>
                          <label className="block text-sm font-semibold text-black mb-2">
                            Jina la Mwisho
                          </label>
                          <input
                            type="text"
                            value={guestLastName}
                            onChange={(e) => setGuestLastName(e.target.value)}
                            placeholder="Mfano: Doe"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-700"
                          />
                        </div>
                        {/* Phone number */}
                        <div>
                          <label className="block text-sm font-semibold text-black mb-2">
                            <span className="flex items-center gap-2">
                              <FiPhone size={16} />
                              Nambari ya Simu
                            </span>
                          </label>
                          <div className="flex gap-3">
                            <div className="flex items-center px-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 text-sm font-semibold">
                              +255
                            </div>
                            <input
                              type="tel"
                              value={guestPhone}
                              onChange={(e) => setGuestPhone(e.target.value)}
                              placeholder="7XX XXX XXX"
                              maxLength={12}
                              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-700"
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Mfano: 0712345678 au 712345678
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleDonate(
                              selectedProvider,
                              guestPhone,
                              guestFirstName,
                              guestLastName,
                            )
                          }
                          disabled={
                            !guestPhone.trim() || !guestFirstName.trim()
                          }
                          className="w-full py-4 bg-amber-700 hover:bg-amber-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition"
                        >
                          Toa Sadaka ya Tsh{" "}
                          {displayAmount.toLocaleString("sw-TZ")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
                {(() => {
                  const prov = selectedProvider
                    ? PROVIDERS.find((p) => p.provider === selectedProvider)
                    : savedMethod
                      ? PROVIDERS.find(
                          (p) =>
                            networkToProvider(savedMethod.network_name) ===
                            p.provider,
                        )
                      : null;
                  return prov ? (
                    <img
                      src={prov.image}
                      alt={prov.name}
                      className="w-20 h-20 mx-auto mb-4 object-contain animate-pulse"
                    />
                  ) : (
                    <FiPhone
                      size={48}
                      className="mx-auto mb-4 text-amber-700 animate-pulse"
                    />
                  );
                })()}
                <p className="text-black font-bold text-xl mb-2">
                  Angalia Simu Yako
                </p>
                {pendingPhone && (
                  <p className="text-sm font-semibold text-white bg-amber-700 rounded-lg px-4 py-2 mb-3 inline-block">
                    +{pendingPhone}
                  </p>
                )}
                <p className="text-gray-600 text-sm mb-4">
                  Ombi la sadaka ya{" "}
                  <span className="font-bold text-amber-700">
                    Tsh {displayAmount.toLocaleString("sw-TZ")}
                  </span>{" "}
                  limetumwa. Ingiza PIN yako kukubali.
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
              {!user && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Una akaunti?</strong>{" "}
                    <button
                      onClick={() => navigate("/login")}
                      className="underline font-semibold"
                    >
                      Ingia
                    </button>{" "}
                    ili historia yako ya sadaka ihifadhiwe.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

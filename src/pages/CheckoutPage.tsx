import * as React from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiUser, FiMail, FiPhone, FiMapPin } from "react-icons/fi";
import { useAuth } from "../lib/AuthContext";
import { useToast } from "../components/Toast";
import { MpesaGuideModal } from "../components/MpesaGuideModal";
import {
  orders,
  profiles,
  products as productsApi,
  paymentMethods as paymentMethodsApi,
  type Product,
} from "../lib/supabaseClient";

interface CartItem {
  id: number;
  quantity: number;
}

interface CheckoutForm {
  fullName: string;
  email: string;
  phone: string;
  address: string;
}

type PaymentState = "idle" | "initiating" | "waiting" | "failed";

export function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [cartItems, setCartItems] = React.useState<CartItem[]>([]);
  const [productDetails, setProductDetails] = React.useState<
    Record<number, Product>
  >({});
  const [formData, setFormData] = React.useState<CheckoutForm>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
  });
  const [createdOrderId, setCreatedOrderId] = React.useState<string | null>(
    null,
  );
  const [paymentState, setPaymentState] = React.useState<PaymentState>("idle");
  const [preferredNetwork, setPreferredNetwork] = React.useState<string | null>(
    null,
  );
  const [showMpesaModal, setShowMpesaModal] = React.useState(false);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = React.useRef(0);

  // Fetch all products from Supabase
  React.useEffect(() => {
    const loadProducts = async () => {
      try {
        const { data: productsData, error: productsError } =
          await productsApi.getAllProducts();

        if (!productsError && productsData) {
          const productMap: Record<number, Product> = {};
          productsData.forEach((product) => {
            productMap[product.id] = product;
          });
          setProductDetails(productMap);
        }
      } catch (err) {
        console.error("Error fetching products:", err);
      }
    };

    loadProducts();
  }, []);

  // Load cart from localStorage - using transient state for hydration
  React.useEffect(() => {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      try {
        const parsedCart: CartItem[] = JSON.parse(savedCart);
        // Initial hydration from localStorage is acceptable
        setCartItems(parsedCart);
      } catch {
        console.error("Failed to parse cart from localStorage");
      }
    }
  }, []);

  // Fetch user profile and payment methods
  React.useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id) return;

      try {
        // Fetch user profile
        const { data: profile, error: profileError } =
          await profiles.getProfile(user.id);

        if (!profileError && profile) {
          // Pre-populate form with profile data
          setFormData((prev) => ({
            ...prev,
            fullName: profile.name || "",
            email: profile.email || user.email || "",
            phone: profile.phone || "",
            address: profile.address || "",
          }));
        } else if (!profile) {
          // Initialize with user email if profile doesn't exist
          setFormData((prev) => ({
            ...prev,
            email: user.email || "",
          }));
        }

        // Fetch payment methods
        const { data: methods } = await paymentMethodsApi.getPaymentMethods(
          user.id,
        );
        if (!methods || methods.length === 0) {
          // Redirect to profile if no payment method is set
          navigate("/profile?tab=payments");
        } else {
          const preferred = methods.find((m) => m.is_preferred) ?? methods[0];
          setPreferredNetwork(preferred.network_name);
        }
      } catch (err) {
        console.error("Error loading user data:", err);
      }
    };

    loadUserData();
  }, [user, navigate]);

  // Clean up polling interval on unmount
  React.useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Normalize TZ phone numbers to 255XXXXXXXXX format
  const normalizePhone = (phone: string): string => {
    const cleaned = phone.replace(/[\s\-\+\(\)]/g, "");
    if (cleaned.startsWith("0")) return "255" + cleaned.slice(1);
    if (cleaned.startsWith("255")) return cleaned;
    return "255" + cleaned;
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => {
      const product = productDetails[item.id];
      if (!product) return total;
      return total + product.price * item.quantity;
    }, 0);
  };

  // Helper function to download a file without opening a new tab
  const downloadFile = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      // fallback: direct link download
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Helper function to download all books in cart
  const downloadOrderBooks = async () => {
    try {
      for (const cartItem of cartItems) {
        const product = productDetails[cartItem.id];
        if (product && product.file_url) {
          // Create a safe file name from product name
          const safeFileName = `${product.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;

          // Add a small delay between downloads to avoid overwhelming the browser
          await new Promise((resolve) => setTimeout(resolve, 500));

          downloadFile(product.file_url, safeFileName);
        }
      }
    } catch (err) {
      console.error("Error downloading files:", err);
    }
  };

  const handlePayment = async () => {
    if (!user) {
      showToast("Lazima uwe umeingia kuendelea", "warning");
      return;
    }
    if (!formData.phone) {
      showToast(
        "Tafadhali ongeza nambari ya simu kwenye wasifu wako kwanza",
        "warning",
      );
      navigate("/profile?tab=profile");
      return;
    }

    setPaymentState("initiating");

    // M-Pesa (Vodacom) is not supported via USSD push — show manual guide
    if (preferredNetwork === "M-Pesa") {
      setPaymentState("idle");
      setShowMpesaModal(true);
      return;
    }

    try {
      // Build order items
      const orderItems = cartItems
        .map((item) => {
          const product = productDetails[item.id];
          if (!product) return null;
          return {
            product_id: item.id.toString(),
            name: product.name,
            price: product.price,
            quantity: item.quantity,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const orderTotal = calculateTotal();
      const orderRef = `ORD${Date.now()}`;

      // Update profile in background (non-blocking)
      profiles
        .updateProfile(user.id, {
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
        })
        .catch((e) => console.warn("Profile update warning:", e));

      // Initiate ClickPesa USSD push BEFORE creating any order record (pay first)
      const phone = normalizePhone(formData.phone);
      const initiateRes = await fetch("/api/clickpesa/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone,
          amount: String(orderTotal),
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

      // Switch to waiting UI and start polling
      setPaymentState("waiting");
      showToast(
        "Ombi limetumwa! Angalia simu yako na idhinisha malipo.",
        "info",
      );

      pollCountRef.current = 0;
      pollRef.current = setInterval(async () => {
        pollCountRef.current += 1;

        // Timeout after ~3 minutes (36 × 5 s)
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
            showToast("Malipo yamekubaliwa! Inashuka vitabu...", "success");

            // Payment confirmed — NOW create the order as completed
            const { data: orderData } = await orders.createOrder({
              user_id: user.id,
              order_number: orderRef,
              total: orderTotal,
              status: "completed",
              items: orderItems,
            });
            if (orderData?.id) setCreatedOrderId(orderData.id);

            await downloadOrderBooks();

            localStorage.setItem("cart", JSON.stringify([]));
            window.dispatchEvent(new Event("storage"));
            showToast("Agizo lako limekamilika!", "success", 5000);
            navigate("/profile");
          } else if (status === "FAILED") {
            clearInterval(pollRef.current!);
            setPaymentState("failed");
            showToast("Malipo yalikataliwa. Tafadhali jaribu tena.", "error");
          }
          // PROCESSING → keep polling
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

  const total = calculateTotal();
  const itemCount = cartItems.length;

  // If no items in cart, redirect to cart page
  if (itemCount === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg mb-6">
            Karata yako ni tupu. Chunguza mafundisho yetu!
          </p>
          <button
            onClick={() => navigate("/cart")}
            className="inline-block px-8 py-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-lg transition"
          >
            Rudi kwenye Karata
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {showMpesaModal && (
        <MpesaGuideModal
          amount={calculateTotal()}
          onClose={() => setShowMpesaModal(false)}
        />
      )}
      {/* Back Link */}
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <button
          onClick={() => navigate("/cart")}
          className="text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-2"
        >
          <FiArrowLeft size={20} /> Rudi
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-black mb-8">
          Hakiki Taarifa Zako
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Delivery Information */}
          <div className="lg:col-span-2">
            {/* Delivery Info Card */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold text-black mb-6">
                Taarifa za Mtumiaji
              </h2>

              {/* Info Display Sections */}
              <div className="space-y-6">
                {/* Name Section */}
                <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
                  <FiUser
                    className="text-amber-700 flex-shrink-0 mt-1"
                    size={20}
                  />
                  <div>
                    <p className="text-xs text-left font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Jina Lako
                    </p>
                    <p className="text-lg font-semibold text-black">
                      {formData.fullName || "Hajajaza"}
                    </p>
                  </div>
                </div>

                {/* Email Section */}
                <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
                  <FiMail
                    className="text-amber-700 flex-shrink-0 mt-1"
                    size={20}
                  />
                  <div>
                    <p className="text-xs text-left font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Anwani ya Barua Pepe
                    </p>
                    <p className="text-lg font-semibold text-black">
                      {formData.email || "Hajajaza"}
                    </p>
                  </div>
                </div>

                {/* Phone Section */}
                <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
                  <FiPhone
                    className="text-amber-700 flex-shrink-0 mt-1"
                    size={20}
                  />
                  <div>
                    <p className="text-xs text-left font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Namba ya Simu
                    </p>
                    <p className="text-lg font-semibold text-black">
                      {formData.phone || "Hajajaza"}
                    </p>
                  </div>
                </div>

                {/* Address Section */}
                <div className="flex items-start gap-4">
                  <FiMapPin
                    className="text-amber-700 flex-shrink-0 mt-1"
                    size={20}
                  />
                  <div>
                    <p className="text-xs text-left font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Anwani ya Makazi
                    </p>
                    <p className="text-lg font-semibold text-black">
                      {formData.address || "Hajajaza"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Fanya Malipo Section */}
            <div className="bg-gradient-to-r from-amber-700 to-amber-600 rounded-2xl shadow-lg p-8 text-white">
              <h2 className="text-2xl font-bold mb-6">Fanya Malipo</h2>

              {/* Idle – show pay button */}
              {paymentState === "idle" && (
                <div className="space-y-4">
                  <p className="text-sm text-amber-50">Jumla ya Kulipa</p>
                  <div className="text-4xl font-bold mb-6">
                    Tsh {total.toLocaleString("sw-TZ")}
                  </div>
                  <button
                    type="button"
                    onClick={handlePayment}
                    className="w-full px-8 py-4 bg-white hover:bg-gray-50 text-amber-700 font-bold rounded-lg transition text-lg"
                  >
                    Lipa Sasa
                  </button>
                  <p className="text-xs text-amber-200 text-center">
                    Utapata ombi la USSD kwenye simu yako
                  </p>
                </div>
              )}

              {/* Initiating – spinner while creating order & calling API */}
              {paymentState === "initiating" && (
                <div className="text-center py-6">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-4" />
                  <p className="text-white font-semibold">
                    Inatuma ombi la malipo...
                  </p>
                </div>
              )}

              {/* Waiting – USSD push sent, polling for confirmation */}
              {paymentState === "waiting" && (
                <div className="text-center py-4">
                  <div className="text-5xl mb-4 animate-bounce">📱</div>
                  <p className="text-white font-bold text-xl mb-2">
                    Angalia Simu Yako
                  </p>
                  <p className="text-amber-100 text-sm mb-4">
                    Ombi la malipo limetumwa. Idhinisha malipo ya{" "}
                    <span className="font-bold text-white">
                      Tsh {total.toLocaleString("sw-TZ")}
                    </span>{" "}
                    kwenye simu yako.
                  </p>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    <p className="text-amber-200 text-sm">
                      Inasubiri uthibitisho...
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (pollRef.current) clearInterval(pollRef.current);
                      setPaymentState("idle");
                    }}
                    className="text-amber-300 text-sm underline hover:text-white transition"
                  >
                    Ghairi
                  </button>
                </div>
              )}

              {/* Failed – show retry */}
              {paymentState === "failed" && (
                <div className="text-center py-4">
                  <div className="text-5xl mb-4">❌</div>
                  <p className="text-white font-bold text-lg mb-2">
                    Malipo Hayakufanikiwa
                  </p>
                  <p className="text-amber-100 text-sm mb-6">
                    Tafadhali hakikisha nambari ya simu ni sahihi na jaribu
                    tena.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPaymentState("idle")}
                    className="px-6 py-2 bg-white text-amber-700 font-bold rounded-lg hover:bg-gray-50 transition"
                  >
                    Jaribu Tena
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-20">
              <h2 className="text-xl font-bold text-black mb-6">
                Muhtasari wa Agizo
              </h2>

              {/* Order Items */}
              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                {cartItems.map((item) => {
                  const product = productDetails[item.id];
                  if (!product) return null;
                  return (
                    <div
                      key={item.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-amber-300 transition"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-black">
                          {product.name}
                        </p>
                        <p className="text-sm font-bold text-amber-700">
                          Tsh{" "}
                          {(product.price * item.quantity).toLocaleString(
                            "sw-TZ",
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="bg-white px-2 py-1 rounded border border-gray-200">
                          {item.quantity}x
                        </span>
                        <span>
                          Tsh {product.price.toLocaleString("sw-TZ")} kwa kila
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Final Total */}
              <div className="bg-gradient-to-r from-amber-50 to-amber-100 border-2 border-amber-700 rounded-lg p-6">
                <div className="text-center">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                    Jumla ya Kulipa
                  </p>
                  <p className="text-4xl font-bold text-amber-700">
                    Tsh {total.toLocaleString("sw-TZ")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

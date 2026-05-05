import * as React from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiUser, FiMail, FiPhone, FiMapPin } from "react-icons/fi";
import { useAuth } from "../lib/AuthContext";
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

type USSDProvider = "mpesa" | "tigopesa" | "airtel" | "none";

interface USSDPaymentState {
  provider: USSDProvider;
  pin: string;
  showPinInput: boolean;
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartItems, setCartItems] = React.useState<CartItem[]>([]);
  const [productDetails, setProductDetails] = React.useState<
    Record<number, Product>
  >({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [formData, setFormData] = React.useState<CheckoutForm>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
  });
  const [ussdPayment, setUssdPayment] = React.useState<USSDPaymentState>({
    provider: "none",
    pin: "",
    showPinInput: false,
  });
  const [createdOrderId, setCreatedOrderId] = React.useState<string | null>(null);

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
        }
      } catch (err) {
        console.error("Error loading user data:", err);
      }
    };

    loadUserData();
  }, [user, navigate]);

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => {
      const product = productDetails[item.id];
      if (!product) return total;
      return total + product.price * item.quantity;
    }, 0);
  };

  // Helper function to download a file
  const downloadFile = (url: string, fileName: string) => {
    // Create a temporary anchor element
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "download";
    link.target = "_blank";
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const handleUSSDPayment = async (provider: USSDProvider) => {
    setError("");
    setLoading(true);

    if (!user) {
      setError("Lazima uwe umeingia kuendelea");
      setLoading(false);
      return;
    }

    // Check if phone number is available
    if (!formData.phone) {
      setError("Tafadhali ingiza nambari ya simu");
      setLoading(false);
      return;
    }

    try {
      // Create order items array
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

      const total = calculateTotal();

      // Create order in Supabase
      const { data: orderData, error: orderError } = await orders.createOrder({
        user_id: user.id,
        order_number: `ORD-${Date.now()}`,
        total: total,
        status: "pending",
        items: orderItems,
      });

      if (orderError) {
        setError("Kosa la kuunda agizo: " + orderError.message);
        setLoading(false);
        return;
      }

      // Save order ID so we can mark it completed after download
      if (orderData?.id) {
        setCreatedOrderId(orderData.id);
      }

      // Update user profile
      const { error: profileError } = await profiles.updateProfile(user.id, {
        name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
      });

      if (profileError) {
        console.warn("Profile update warning:", profileError);
      }

      // Trigger USSD payment
      const ussdCodes: Record<USSDProvider, string> = {
        mpesa: `*150*01#`, // M-Pesa code
        tigopesa: `*150#`, // Tigo Pesa code
        airtel: `*150#`, // Airtel Money code
        none: "",
      };

      if (ussdCodes[provider]) {
        // Show PIN input modal
        setUssdPayment({
          provider,
          pin: "",
          showPinInput: true,
        });
      }

      setLoading(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Hitilafu isiyojulikana iliotokea";
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handlePINSubmit = async () => {
    if (!ussdPayment.pin || ussdPayment.pin.length < 4) {
      setError("Tafadhali ingiza PIN sahihi");
      return;
    }

    setLoading(true);
    try {
      // Simulate USSD payment processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Trigger automatic downloads for all books in the order
      await downloadOrderBooks();

      // Mark order as completed after successful download
      if (createdOrderId) {
        await orders.updateOrder(createdOrderId, { status: "completed" });
      }

      // Clear cart and navigate
      localStorage.setItem("cart", JSON.stringify([]));
      window.dispatchEvent(new Event("storage"));

      // Reset USSD state
      setUssdPayment({
        provider: "none",
        pin: "",
        showPinInput: false,
      });

      // Show success message and navigate
      alert("✅ Agizo lako limekamilika! Kitabu/Vitabu vya kiroho vinakuja...");
      navigate("/profile");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Malipo hayakufanya kazi";
      setError(errorMessage);
    } finally {
      setLoading(false);
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

              {error && (
                <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

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

              <div className="space-y-4">
                <p className="text-sm text-amber-50">Jumla ya Kulipa</p>
                <div className="text-4xl font-bold mb-6">
                  Tsh {total.toLocaleString("sw-TZ")}
                </div>
                <button
                  type="button"
                  onClick={() => handleUSSDPayment("mpesa")}
                  disabled={loading}
                  className="w-full px-8 py-4 bg-white hover:bg-gray-50 text-amber-700 font-bold rounded-lg transition disabled:opacity-50 text-lg"
                >
                  {loading ? "Inakusajifu..." : "Lipa Sasa"}
                </button>
              </div>

              {/* PIN Input Modal */}
              {ussdPayment.showPinInput && (
                <div className="mt-6 p-4 bg-white text-black rounded-lg border-2 border-white">
                  <p className="text-sm font-semibold mb-4">
                    Ingiza PIN yako ya {ussdPayment.provider.toUpperCase()} ili
                    kukamilisha malipo ya Tsh{" "}
                    {calculateTotal().toLocaleString("sw-TZ")}
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="password"
                      value={ussdPayment.pin}
                      onChange={(e) =>
                        setUssdPayment((prev) => ({
                          ...prev,
                          pin: e.target.value,
                        }))
                      }
                      placeholder="••••"
                      maxLength={4}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700"
                    />
                    <button
                      type="button"
                      onClick={handlePINSubmit}
                      disabled={loading || ussdPayment.pin.length < 4}
                      className="px-6 py-2 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Inakusajifu..." : "Lipa"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setUssdPayment({
                          provider: "none",
                          pin: "",
                          showPinInput: false,
                        })
                      }
                      className="px-4 py-2 border border-gray-300 text-black rounded-lg hover:bg-gray-50 transition"
                    >
                      Ghairi
                    </button>
                  </div>
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

import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiUser,
  FiMail,
  FiPhone,
  FiCreditCard,
  FiUpload,
  FiPlus,
  FiTrash2,
  FiShoppingBag,
  FiMapPin,
  FiLogOut,
  FiEdit2,
} from "react-icons/fi";
import { useAuth } from "../lib/AuthContext";
import {
  profiles,
  orders as ordersApi,
  paymentMethods as paymentMethodsApi,
  storage,
} from "../lib/supabaseClient";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  profile_picture: string | null;
}

interface Order {
  id: string;
  order_number: string;
  items: Array<{
    product_id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  created_at: string;
  status: "pending" | "completed" | "cancelled";
}

interface PaymentMethod {
  id: string;
  user_id?: string;
  network_name: string;
  network_number: string | null;
}

type TabType = "account" | "orders" | "payments" | "address";

export function UserProfilePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const tabParam = searchParams.get("tab") as TabType | null;
  const [activeTab, setActiveTab] = React.useState<TabType>(
    tabParam || "account",
  );
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const [profile, setProfile] = React.useState<UserProfile>({
    id: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    profile_picture: null,
  });

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>(
    [],
  );
  const [editingProfile, setEditingProfile] = React.useState(false);
  const [showAddPayment, setShowAddPayment] = React.useState(false);

  const [newPayment, setNewPayment] = React.useState({
    network_name: "M-Pesa",
    network_number: "",
  });

  // Load user data from Supabase on mount
  React.useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch profile
        const { data: profileData, error: profileError } =
          await profiles.getProfile(user.id);

        if (profileError && profileError.code !== "PGRST116") {
          throw profileError;
        }

        if (profileData) {
          setProfile(profileData);
        } else {
          // Create profile if it doesn't exist
          const newProfile: UserProfile = {
            id: user.id,
            name: user.user_metadata?.display_name || "",
            email: user.email || "",
            phone: "",
            address: "",
            profile_picture: null,
          };
          const { error: createErr } = await profiles.createProfile(newProfile);
          if (createErr) throw createErr;
          setProfile(newProfile);
        }

        // Fetch orders
        const { data: ordersData, error: ordersError } =
          await ordersApi.getOrders(user.id);
        if (ordersError) throw ordersError;

        // Parse items if they're strings
        const parsedOrders = (ordersData || []).map((order: any) => ({
          ...order,
          items:
            typeof order.items === "string"
              ? JSON.parse(order.items)
              : order.items || [],
        }));
        setOrders(parsedOrders);

        // Fetch payment methods
        const { data: paymentsData, error: paymentsError } =
          await paymentMethodsApi.getPaymentMethods(user.id);
        if (paymentsError) throw paymentsError;
        setPaymentMethods(paymentsData || []);

        // Pre-populate form with existing payment method
        if (paymentsData && paymentsData.length > 0) {
          const existingPayment = paymentsData[0];
          setNewPayment({
            network_name: existingPayment.network_name || "M-Pesa",
            network_number: existingPayment.network_number || "",
          });
        }
      } catch (err: any) {
        console.error("Load error:", err);
        setError(err.message || "Hitilafu ya kupakia data");
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [user]);

  const handleProfileChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfilePictureUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setSaving(true);
      const { url, error } = await storage.uploadProfilePicture(user.id, file);

      if (error) throw error;

      if (url) {
        setProfile((prev) => ({
          ...prev,
          profile_picture: url,
        }));
      }
    } catch (err: any) {
      setError("Kosa la kupakia picha: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setError("");

      const { error: updateError } = await profiles.updateProfile(user.id, {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        profile_picture: profile.profile_picture,
      });

      if (updateError) throw updateError;

      setEditingProfile(false);
    } catch (err: any) {
      setError("Kosa la kuhifadhi profaili: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async () => {
    if (!user || !newPayment.network_number) {
      setError("Tafadhali ingiza nambari ya simu");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const { error: addError } = await paymentMethodsApi.addPaymentMethod({
        user_id: user.id,
        network_name: newPayment.network_name,
        network_number: newPayment.network_number,
      });

      if (addError) throw addError;

      // Refresh payment methods
      const { data: paymentsData } = await paymentMethodsApi.getPaymentMethods(
        user.id,
      );
      setPaymentMethods(paymentsData || []);

      setNewPayment({
        network_name: "M-Pesa",
        network_number: "",
      });
      setShowAddPayment(false);
    } catch (err: any) {
      setError("Kosa la kuongeza njia ya malipo: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const removePaymentMethod = async (id: string) => {
    try {
      setSaving(true);
      setError("");

      const { error: deleteError } =
        await paymentMethodsApi.deletePaymentMethod(id);
      if (deleteError) throw deleteError;

      setPaymentMethods((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setError("Kosa la kufuta njia ya malipo: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-50";
      case "pending":
        return "text-yellow-600 bg-yellow-50";
      case "cancelled":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getOrderStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Kumaliziwa";
      case "pending":
        return "Inafuatiliwa";
      case "cancelled":
        return "Ibadilishwa";
      default:
        return status;
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err: any) {
      setError("Kosa la kujitoka: " + err.message);
    }
  };

  const menuItems = [
    { id: "account", label: "Akaunti Yangu", icon: FiUser },
    { id: "orders", label: "Agizo Langu", icon: FiShoppingBag },
    { id: "payments", label: "Njia Ya Malipo", icon: FiCreditCard },
    { id: "address", label: "Anwani", icon: FiMapPin },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Tafadhali Subiri...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Back Button */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 bg-white border-b border-gray-200">
        <button
          onClick={() => navigate("/")}
          className="text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-2"
        >
          <FiArrowLeft size={20} /> Rudi
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        {!editingProfile && (
          <div className="bg-gradient-to-r from-amber-700 to-amber-600 rounded-t-3xl p-8 text-white mb-0">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center border-4 border-white overflow-hidden mb-4">
                {profile.profile_picture ? (
                  <img
                    src={profile.profile_picture}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FiUser size={80} className="text-gray-400" />
                )}
              </div>
              <h2 className="text-2xl font-bold mb-1">
                {profile.name || "Mtumiaji"}
              </h2>
              <p className="text-amber-100 text-sm">{profile.email}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="space-y-2 p-4">
                {menuItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as TabType)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium text-sm ${
                        activeTab === item.id
                          ? "bg-amber-700 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <IconComponent size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-gray-200 p-4">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition font-medium text-sm"
                >
                  <FiLogOut size={18} />
                  <span>Ondoka</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Content */}
          <div className="lg:col-span-3">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Account Tab */}
            {activeTab === "account" && (
              <div className="bg-white rounded-lg shadow-md p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-black">
                    Taarifa za Akaunti
                  </h3>
                  {!editingProfile && (
                    <button
                      onClick={() => setEditingProfile(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg transition font-medium"
                    >
                      <FiEdit2 size={16} /> Hariri
                    </button>
                  )}
                </div>

                {editingProfile ? (
                  <div className="space-y-5">
                    {/* Profile Picture */}
                    <div>
                      <label className="block text-sm text-left font-semibold text-black mb-3 uppercase tracking-wide">
                        Picha ya Profaili
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-24 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg flex items-center justify-center border-2 border-amber-200 overflow-hidden">
                          {profile.profile_picture ? (
                            <img
                              src={profile.profile_picture}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FiUser size={40} className="text-gray-400" />
                          )}
                        </div>
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePictureUpload}
                            disabled={saving}
                            className="hidden"
                          />
                          <div className="flex items-center justify-center gap-2 text-sm bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition disabled:opacity-50">
                            <FiUpload size={14} />{" "}
                            {saving ? "Inakupakia..." : "Badilisha Picha"}
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-sm text-left font-semibold text-black mb-2 uppercase tracking-wide">
                        Jina Lako
                      </label>
                      <div className="relative">
                        <FiUser
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                          size={18}
                        />
                        <input
                          type="text"
                          name="name"
                          value={profile.name}
                          onChange={handleProfileChange}
                          placeholder="Jina lako kamili"
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200 transition"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm text-left font-semibold text-black mb-2 uppercase tracking-wide">
                        Barua Pepe
                      </label>
                      <div className="relative">
                        <FiMail
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                          size={18}
                        />
                        <input
                          type="email"
                          name="email"
                          value={profile.email}
                          onChange={handleProfileChange}
                          disabled
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm text-left font-semibold text-black mb-2 uppercase tracking-wide">
                        Nambari ya Simu
                      </label>
                      <div className="relative">
                        <FiPhone
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                          size={18}
                        />
                        <input
                          type="tel"
                          name="phone"
                          value={profile.phone}
                          onChange={handleProfileChange}
                          placeholder="+255 7xx xxx xxx"
                          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200 transition"
                        />
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={saveProfile}
                        disabled={saving}
                        className="flex-1 px-6 py-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-lg transition disabled:opacity-50"
                      >
                        {saving ? "Inakuhifadhi..." : "Hifadhi"}
                      </button>
                      <button
                        onClick={() => setEditingProfile(false)}
                        className="flex-1 px-6 py-3 border-2 border-gray-300 text-black hover:bg-gray-50 font-semibold rounded-lg transition"
                      >
                        Ghairi
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Full Name Card */}
                    <div className="border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-amber-300 transition bg-gradient-to-br from-white to-gray-50">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FiUser className="text-amber-700" size={24} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1">
                            Jina Kamili
                          </p>
                          <p className="text-xl font-bold text-black">
                            {profile.name || "Haijaweka"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Email Card */}
                    <div className="border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-amber-300 transition bg-gradient-to-br from-white to-gray-50">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FiMail className="text-blue-700" size={24} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">
                            Barua Pepe
                          </p>
                          <p className="text-lg font-semibold text-black break-all">
                            {profile.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Phone Card */}
                    <div className="border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-amber-300 transition bg-gradient-to-br from-white to-gray-50">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FiPhone className="text-green-700" size={24} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-1">
                            Nambari ya Simu
                          </p>
                          <p className="text-lg font-semibold text-black">
                            {profile.phone || "Haijaweka"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === "orders" && (
              <div className="bg-white rounded-lg shadow-md p-8">
                <h3 className="text-2xl font-bold text-black mb-6">
                  Agizo Lako
                </h3>
                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <FiShoppingBag
                      size={48}
                      className="text-gray-400 mx-auto mb-3"
                    />
                    <p className="text-gray-600">
                      Bado Hujaagiza kitu chochote
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        <div className="border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-xl transition bg-gradient-to-br from-white to-gray-50">
                      >
                        {/* Header */}
                        <div className="flex justify-between items-start gap-4 mb-6 pb-6 border-b border-gray-200">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-left font-bold text-amber-700 uppercase tracking-widest mb-2">
                              Namba ya Agizo
                            </p>
                            <p className="font-bold text-base sm:text-xl text-left text-black break-all">
                              #{order.order_number}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap ${getOrderStatusColor(order.status)}`}
                          >
                            {getOrderStatusLabel(order.status)}
                          </span>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 pb-6 border-b border-gray-200">
                          {/* Date */}
                          <div className="bg-white border border-gray-100 rounded-lg p-2 sm:p-4 text-center hover:shadow-md transition">
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                              Tarehe
                            </p>
                            <p className="text-xs sm:text-base font-bold text-black">
                              {new Date(order.created_at).toLocaleDateString(
                                "sw-TZ",
                              )}
                            </p>
                          </div>

                          {/* Quantity */}
                          <div className="bg-white border border-gray-100 rounded-lg p-2 sm:p-4 text-center hover:shadow-md transition">
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                              Idadi
                            </p>
                            <p className="text-sm sm:text-lg font-bold text-black">
                              {order.items.length}
                            </p>
                          </div>

                          {/* Total */}
                          <div className="bg-white border border-gray-100 rounded-lg p-2 sm:p-4 text-center hover:shadow-md transition">
                            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">
                              Jumla
                            </p>
                            <p className="text-xs sm:text-base font-bold text-amber-700">
                              Tsh {order.total.toLocaleString("sw-TZ")}
                            </p>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div>
                          <p className="text-xs text-left font-bold text-gray-700 uppercase tracking-wide mb-3">
                            📦 Hazina Zilizoagizwa:
                          </p>
                          <div className="space-y-2 ml-2 text-left">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-100 hover:border-amber-200 transition"
                              >
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-black">
                                    {item.name}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    Kiasi: {item.quantity}
                                  </p>
                                </div>
                                <p className="text-sm font-bold text-amber-700">
                                  Tsh{" "}
                                  {(item.price * item.quantity).toLocaleString(
                                    "sw-TZ",
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === "payments" && (
              <div className="bg-white rounded-lg shadow-md p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-black">
                    Njia Ya Malipo
                  </h3>
                  {!showAddPayment && (
                    <button
                      onClick={() => setShowAddPayment(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-lg transition font-medium"
                    >
                      <FiPlus size={16} /> Ongeza
                    </button>
                  )}
                </div>

                {showAddPayment ? (
                  <div className="space-y-4 border-t border-gray-200 pt-6">
                    {/* Mobile Money Form */}
                    <div>
                      <label className="block text-sm text-left font-semibold text-black mb-2 uppercase">
                        Chagua Mtandao
                      </label>
                      <select
                        value={newPayment.network_name}
                        onChange={(e) =>
                          setNewPayment({
                            ...newPayment,
                            network_name: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200 transition"
                      >
                        <option>M-Pesa</option>
                        <option>Halo Pesa</option>
                        <option>Airtel Money</option>
                        <option>TIGO Pesa</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-left font-semibold text-black mb-2 uppercase">
                        Namba ya Simu
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-gray-600 font-semibold">
                          +255
                        </span>
                        <input
                          type="tel"
                          value={newPayment.network_number}
                          onChange={(e) =>
                            setNewPayment({
                              ...newPayment,
                              network_number: e.target.value.replace(/\D/g, ""),
                            })
                          }
                          placeholder="700000000"
                          maxLength={9}
                          className="w-full pl-16 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200 transition"
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Ingiza tarakimu 9 za simu bila +255
                      </p>
                    </div>
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={handleAddPayment}
                        disabled={saving}
                        className="flex-1 px-6 py-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-lg transition disabled:opacity-50"
                      >
                        {saving ? "Inakuongeza..." : "Ongeza Njia"}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddPayment(false);
                          setNewPayment({
                            network_name: "M-Pesa",
                            network_number: "",
                          });
                        }}
                        className="flex-1 px-6 py-3 border-2 border-gray-300 text-black hover:bg-gray-50 font-semibold rounded-lg transition"
                      >
                        Ghairi
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {paymentMethods.length === 0 ? (
                      <div className="text-center py-12">
                        <FiCreditCard
                          size={48}
                          className="text-gray-400 mx-auto mb-3"
                        />
                        <p className="text-gray-600 mb-4">
                          Hajajaweka njia ya malipo
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {paymentMethods.map((payment) => (
                          <div
                            key={payment.id || "payment-method"}
                            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition bg-gradient-to-r from-amber-50 to-transparent"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-amber-700 to-amber-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                                📱
                              </div>
                              <div>
                                <p className="font-semibold text-black">
                                  {payment.network_name}
                                </p>
                                <p className="text-sm text-gray-600">
                                  +255{payment.network_number?.slice(-7)}
                                </p>
                                <span className="inline-block text-xs font-semibold text-green-700 mt-1">
                                  Simu ya Pesa
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                removePaymentMethod(payment.id || "")
                              }
                              disabled={saving}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition disabled:opacity-50"
                            >
                              <FiTrash2 size={20} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Address Tab */}
            {activeTab === "address" && (
              <div className="bg-white rounded-lg shadow-md p-8">
                <h3 className="text-2xl font-bold text-black mb-6">
                  Anwani Ya Makazi
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-black mb-2 uppercase">
                      Anwani Kuu
                    </label>
                    <div className="relative">
                      <FiMapPin
                        className="absolute left-4 top-3 text-gray-400"
                        size={18}
                      />
                      <textarea
                        name="address"
                        value={profile.address}
                        onChange={handleProfileChange}
                        placeholder="Mtaa, Jiji, Kaunti, Nchi"
                        rows={4}
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200 transition resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="flex-1 px-6 py-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-lg transition disabled:opacity-50"
                    >
                      {saving ? "Inakuhifadhi..." : "Hifadhi Anwani"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

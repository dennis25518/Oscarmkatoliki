import {
  FiShoppingCart,
  FiLogOut,
  FiUser,
  FiBox,
  FiMenu,
  FiX,
  FiHome,
  FiPackage,
  FiHelpCircle,
  FiMail,
  FiHeart,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import * as React from "react";
import { useAuth } from "../lib/AuthContext";
import { profiles } from "../lib/supabaseClient";

export function Navbar() {
  const [cartCount, setCartCount] = React.useState(0);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);
  const [profileData, setProfileData] = React.useState({
    name: "",
    profile_picture: null as string | null,
  });
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Load cart count on mount
  React.useEffect(() => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    setCartCount(cart.length);

    const handleStorageChange = () => {
      const updatedCart = JSON.parse(localStorage.getItem("cart") || "[]");
      setCartCount(updatedCart.length);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Load user profile data
  React.useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const { data } = await profiles.getProfile(user.id);
        if (data) {
          setProfileData({
            name: data.name || user.email || "User",
            profile_picture: data.profile_picture,
          });
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    };

    loadProfile();
  }, [user]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleProfileClick = () => {
    navigate("/profile");
    setShowDropdown(false);
  };

  const handleOrdersClick = () => {
    navigate("/profile?tab=orders");
    setShowDropdown(false);
  };

  const closeMobileMenu = () => {
    setShowMobileMenu(false);
  };

  const handleMobileNavClick = (link: string) => {
    closeMobileMenu();
    // Scroll to section if it's a hash link
    if (link.startsWith("#")) {
      window.location.href = link;
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-18">
            {/* Logo - Left */}
            <a href="/" className="flex items-center flex-shrink-0">
              <img
                src="/Asset/official web logo.png"
                alt="Oscar Mkatoliki"
                className="h-14 sm:h-16 w-auto"
              />
            </a>

            {/* Navigation Links - Center */}
            <div className="hidden lg:flex items-center space-x-8 flex-1 justify-center">
              <a
                href="/#nyumbani"
                className="text-black hover:text-amber-700 transition font-medium"
              >
                Nyumbani
              </a>
              <a
                href="/#bidhaa"
                className="text-black hover:text-amber-700 transition font-medium"
              >
                Bidhaa
              </a>
              <a
                href="/#maswali"
                className="text-black hover:text-amber-700 transition font-medium"
              >
                Maswali
              </a>
              <a
                href="/#mawasiliano"
                className="text-black hover:text-amber-700 transition font-medium"
              >
                Mawasiliano
              </a>
              <a
                href="/sadaka"
                className="text-red-600 hover:text-red-700 transition font-semibold flex items-center gap-1"
              >
                <FiHeart size={18} />
                Sadaka
              </a>
            </div>

            {/* Cart and User Profile - Right */}
            <div className="flex items-center space-x-6">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden text-black hover:text-amber-700 transition"
              >
                <FiMenu size={24} />
              </button>
              {/* Cart Icon with Badge */}
              {user && (
                <a
                  href="/cart"
                  className="text-black hover:text-amber-700 transition relative"
                >
                  <FiShoppingCart size={24} />
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </a>
              )}

              {/* User Profile Dropdown */}
              {user && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center space-x-2 hover:opacity-75 transition"
                  >
                    {profileData.profile_picture ? (
                      <img
                        src={profileData.profile_picture}
                        alt={profileData.name}
                        className="w-8 h-8 rounded-full object-cover border border-amber-700"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center">
                        <FiUser size={16} className="text-white" />
                      </div>
                    )}
                    <span className="text-black text-sm font-medium hidden sm:inline truncate max-w-[150px]">
                      {profileData.name}
                    </span>
                  </button>

                  {/* Dropdown Menu */}
                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                      <button
                        onClick={handleProfileClick}
                        className="w-full px-4 py-3 text-left text-black hover:bg-amber-50 flex items-center space-x-2 transition"
                      >
                        <FiUser size={18} />
                        <span>Profile</span>
                      </button>
                      <button
                        onClick={handleOrdersClick}
                        className="w-full px-4 py-3 text-left text-black hover:bg-amber-50 flex items-center space-x-2 transition border-t border-gray-100"
                      >
                        <FiBox size={18} />
                        <span>Orders</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 flex items-center space-x-2 transition border-t border-gray-100"
                      >
                        <FiLogOut size={18} />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Login button for non-authenticated users */}
              {!user && (
                <a
                  href="/login"
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition"
                >
                  Jisajili
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar Menu */}
      {showMobileMenu && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={closeMobileMenu}
          ></div>

          {/* Sidebar */}
          <div className="fixed left-0 top-0 h-screen w-64 bg-white shadow-lg z-50 lg:hidden overflow-y-auto">
            {/* Header with Close Button */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <a href="/" className="flex items-center flex-shrink-0">
                <img
                  src="/Asset/official web logo.png"
                  alt="Oscar Mkatoliki"
                  className="h-16 w-auto"
                />
              </a>
              <button
                onClick={closeMobileMenu}
                className="text-black hover:text-amber-700 transition"
              >
                <FiX size={28} />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="p-4 space-y-2">
              <a
                href="/#nyumbani"
                onClick={() => handleMobileNavClick("/#nyumbani")}
                className="block px-4 py-3 text-black hover:bg-amber-50 rounded-lg transition font-medium flex items-center space-x-3"
              >
                <FiHome size={20} className="text-amber-700" />
                <span>Nyumbani</span>
              </a>
              <a
                href="/#bidhaa"
                onClick={() => handleMobileNavClick("/#bidhaa")}
                className="block px-4 py-3 text-black hover:bg-amber-50 rounded-lg transition font-medium flex items-center space-x-3"
              >
                <FiPackage size={20} className="text-amber-700" />
                <span>Bidhaa</span>
              </a>
              <a
                href="/#maswali"
                onClick={() => handleMobileNavClick("/#maswali")}
                className="block px-4 py-3 text-black hover:bg-amber-50 rounded-lg transition font-medium flex items-center space-x-3"
              >
                <FiHelpCircle size={20} className="text-amber-700" />
                <span>Maswali</span>
              </a>
              <a
                href="/#mawasiliano"
                onClick={() => handleMobileNavClick("/#mawasiliano")}
                className="block px-4 py-3 text-black hover:bg-amber-50 rounded-lg transition font-medium flex items-center space-x-3"
              >
                <FiMail size={20} className="text-amber-700" />
                <span>Mawasiliano</span>
              </a>
              <a
                href="/sadaka"
                onClick={() => {
                  navigate("/sadaka");
                  closeMobileMenu();
                }}
                className="block px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition font-semibold flex items-center space-x-3"
              >
                <FiHeart size={20} className="text-red-600" />
                <span>Sadaka</span>
              </a>
            </nav>

            {/* Divider */}
            <div className="border-t border-gray-200 my-4"></div>

            {/* User-specific Menu Items */}
            {user && (
              <nav className="p-4 space-y-2">
                <a
                  href="/cart"
                  onClick={() => {
                    navigate("/cart");
                    closeMobileMenu();
                  }}
                  className="block px-4 py-3 text-black hover:bg-amber-50 rounded-lg transition font-medium flex items-center space-x-3 relative"
                >
                  <FiShoppingCart size={20} className="text-amber-700" />
                  <span>Cart</span>
                  {cartCount > 0 && (
                    <span className="absolute right-4 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </a>
                <button
                  onClick={() => {
                    navigate("/profile");
                    closeMobileMenu();
                  }}
                  className="w-full text-left px-4 py-3 text-black hover:bg-amber-50 rounded-lg transition font-medium flex items-center space-x-3"
                >
                  <FiUser size={20} className="text-amber-700" />
                  <span>Profile</span>
                </button>
                <button
                  onClick={() => {
                    navigate("/profile?tab=orders");
                    closeMobileMenu();
                  }}
                  className="w-full text-left px-4 py-3 text-black hover:bg-amber-50 rounded-lg transition font-medium flex items-center space-x-3"
                >
                  <FiBox size={20} className="text-amber-700" />
                  <span>Orders</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition font-medium flex items-center space-x-3"
                >
                  <FiLogOut size={20} />
                  <span>Logout</span>
                </button>
              </nav>
            )}

            {/* Login button for non-authenticated users */}
            {!user && (
              <div className="p-4">
                <a
                  href="/login"
                  onClick={() => closeMobileMenu()}
                  className="block text-center px-4 py-3 bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition font-semibold"
                >
                  Jisajili
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

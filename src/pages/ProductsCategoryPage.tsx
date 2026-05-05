import * as React from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiSearch } from "react-icons/fi";
import { products as productsApi } from "../lib/supabaseClient";
import { useToast } from "../components/Toast";
import { ProductCardSkeleton } from "../components/Skeleton";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string | null;
  file_url: string;
}

export function ProductsCategoryPage() {
  const navigate = useNavigate();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<"name" | "price">("name");

  // Fetch products from Supabase on mount
  React.useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const { data, error } = await productsApi.getAllProducts();
        if (error) throw error;
        setProducts(data || []);
      } catch (err) {
        console.error("Failed to load products:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Filter and sort products
  React.useEffect(() => {
    let filtered = products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    // Sort products
    if (sortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "price") {
      filtered.sort((a, b) => a.price - b.price);
    }

    setFilteredProducts(filtered);
  }, [products, searchQuery, sortBy]);

  const { showToast } = useToast();

  const addToCart = (productId: number) => {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const existingItem = cart.find(
      (item: { id: number }) => item.id === productId,
    );

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({ id: productId, quantity: 1 });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
    showToast("Imewekwa Kikapuni", "success");
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Top Row - Title Section */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-4">
              <button
                onClick={() => navigate("/")}
                className="p-2 hover:bg-gray-100 rounded-lg transition duration-200 mt-1"
                aria-label="Go back"
              >
                <FiArrowLeft size={20} className="text-gray-700" />
              </button>
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  Mafundisho ya Dini
                </h2>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 font-medium">
                <span className="text-lg font-bold text-gray-900">
                  {products.length}
                </span>
              </p>
              <p className="text-xs text-gray-500">bidhaa</p>
            </div>
          </div>

          {/* Bottom Row - Search and Sort */}
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
            {/* Search Input */}
            <div className="flex-1 relative">
              <FiSearch
                className="absolute left-3 top-3 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Tafuta ndani ya kategoria..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent transition duration-200 text-base"
              />
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "price")}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent bg-white text-gray-700 font-medium transition duration-200 text-base cursor-pointer whitespace-nowrap"
            >
              <option value="name">Kwa Jina</option>
              <option value="price">Kwa Bei (Chini kwanza)</option>
            </select>

            {/* Result Count */}
            <div className="text-right sm:pl-2">
              <p className="text-sm text-gray-600 font-medium">
                <span className="text-gray-900 font-semibold">
                  {filteredProducts.length}
                </span>{" "}
                matokeo
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-gray-50 py-12 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-24">
              <div className="inline-block text-center">
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-gray-600 text-lg font-medium mb-6">
                  {searchQuery
                    ? "Hakuna bidhaa inayolingana na utafutaji wako"
                    : "Hakuna bidhaa inayopatikana"}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    navigate("/");
                  }}
                  className="px-6 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg transition duration-200 text-base"
                >
                  Rudi Nyumbani
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredProducts.map((product) => (
                  <a
                    key={product.id}
                    href={`/product/${product.id}`}
                    className="group bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-xl transition duration-300 overflow-hidden block no-underline flex flex-col"
                  >
                    {/* Product Image Container */}
                    <div className="relative w-full h-40 bg-gray-100 overflow-hidden flex items-center justify-center">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-contain bg-gray-50 p-3 group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <span className="text-6xl opacity-20">📚</span>
                      )}
                    </div>

                    {/* Product Info Container */}
                    <div className="flex-1 p-3 flex flex-col justify-between">
                      {/* Top Section */}
                      <div className="space-y-1 mb-2">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                          Digital Book
                        </p>
                        <h3 className="text-xs font-semibold text-gray-900 line-clamp-2 leading-tight">
                          {product.name}
                        </h3>
                        {product.description && (
                          <p className="text-xs text-gray-500 line-clamp-1">
                            {product.description}
                          </p>
                        )}
                      </div>

                      {/* Bottom Section - Price & Button */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-xs font-bold text-gray-900">
                          {product.price.toLocaleString()} TSh
                        </span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            addToCart(product.id);
                          }}
                          className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white font-semibold text-xs rounded-md transition duration-200 whitespace-nowrap"
                        >
                          ADD
                        </button>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

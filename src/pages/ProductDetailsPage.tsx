import { useParams, useNavigate } from "react-router-dom";
import * as React from "react";
import { products as productsAPI } from "../lib/supabaseClient";
import type { Product } from "../lib/supabaseClient";
import Footer from "../components/Footer";
import { useToast } from "../components/Toast";
import { CommentSection } from "../components/CommentSection";
import { ProductDetailSkeleton } from "../components/Skeleton";

export function ProductDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = React.useState<Product | null>(null);
  const [allProducts, setAllProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [quantity, setQuantity] = React.useState(1);
  const { showToast } = useToast();

  React.useEffect(() => {
    const fetchProductDetails = async () => {
      if (!id) return;

      setLoading(true);
      setError(null);

      try {
        const productId = parseInt(id, 10);
        const { data: productData, error: productError } =
          await productsAPI.getProduct(productId);

        if (productError) {
          setError("Kosi haipo.");
          setProduct(null);
        } else {
          setProduct(productData);
        }

        // Fetch all products for "Similar Products" section
        const { data: allProductsData, error: allProductsError } =
          await productsAPI.getAllProducts();

        if (!allProductsError && allProductsData) {
          setAllProducts(allProductsData);
        }
      } catch (err) {
        setError("Kosa likatokea wakati wa kupakua kozi.");
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;

    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const existingItem = cart.find(
      (item: { id: number }) => item.id === product.id,
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({ id: product.id, quantity });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
    showToast("Imewekwa Kikapuni", "success");
    navigate("/cart");
  };

  // Loading state
  if (loading) {
    return <ProductDetailSkeleton />;
  }

  // Error state
  if (error || !product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-black mb-4">Kozi Haipo</h1>
          <p className="text-gray-600 mb-4">
            {error || "Kosa likatokea wakati wa kupakua kozi."}
          </p>
          <a
            href="/"
            className="text-amber-700 hover:text-amber-800 font-semibold"
          >
            Rudi
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Back Link */}
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <a
          href="/"
          className="text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-2 w-fit"
        >
          ← Rudi
        </a>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Product Image - Left */}
          <div className="flex items-center justify-center rounded-xl h-80">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <div className="text-6xl">📚</div>
            )}
          </div>

          {/* Product Details - Right */}
          <div className="text-left">
            {/* Category */}
            <p className="text-sm text-amber-700 font-bold uppercase tracking-wider mb-2">
              Mafundisho ya Dini
            </p>

            {/* Title */}
            <h2 className="text-xl md:text-2xl font-bold text-black mb-4">
              {product.name}
            </h2>

            {/* Description */}
            <p className="text-gray-700 mb-6 text-base leading-relaxed text-left text-justify">
              {product.description}
            </p>

            {/* Price */}
            <div className="mb-8 mt-4">
              <span className="text-2xl font-bold text-amber-700">
                Tsh {product.price.toLocaleString("sw-TZ")}
              </span>
            </div>

            {/* Quantity Selector and Button */}
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 text-gray-600 hover:text-black transition"
                >
                  −
                </button>
                <span className="px-6 py-2 text-black font-semibold min-w-[60px] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2 text-gray-600 hover:text-black transition"
                >
                  +
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                className="flex-1 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition"
              >
                Nunua Sasa
              </button>
            </div>
          </div>
        </div>

        {/* Similar Products Section */}
        <div className="mt-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-black">
              Hazina Zaidi za Kiroho
            </h2>
            <a
              href="/products"
              className="text-amber-700 hover:text-amber-800 font-semibold"
            >
              Tazama Zaidi →
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {allProducts.slice(0, 4).map((relatedProduct) => (
              <a
                key={relatedProduct.id}
                href={`/product/${relatedProduct.id}`}
                className="group bg-white rounded-lg border border-gray-200 hover:border-amber-400 hover:shadow-lg transition overflow-hidden block no-underline text-decoration-none"
              >
                {/* Product Image */}
                <div className="h-40 bg-gradient-to-br from-amber-50 to-yellow-50 flex items-center justify-center border-b border-gray-100 group-hover:from-amber-100 group-hover:to-yellow-100 transition overflow-hidden">
                  {relatedProduct.image ? (
                    <img
                      src={relatedProduct.image}
                      alt={relatedProduct.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                    />
                  ) : (
                    <span className="text-6xl group-hover:scale-110 transition duration-300">
                      📚
                    </span>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <h3 className="text-sm font-bold text-black mb-3 line-clamp-2 group-hover:text-amber-700 transition">
                    {relatedProduct.name}
                  </h3>

                  {/* Price and Button */}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-700">
                      Tsh {relatedProduct.price.toLocaleString("sw-TZ")}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        const cart = JSON.parse(
                          localStorage.getItem("cart") || "[]",
                        );
                        const existingItem = cart.find(
                          (item: { id: number }) =>
                            item.id === relatedProduct.id,
                        );

                        if (existingItem) {
                          existingItem.quantity += 1;
                        } else {
                          cart.push({ id: relatedProduct.id, quantity: 1 });
                        }

                        localStorage.setItem("cart", JSON.stringify(cart));
                        window.dispatchEvent(new Event("storage"));
                        showToast("Imewekwa Kikapuni", "success");
                        navigate("/cart");
                      }}
                      className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs rounded transition"
                    >
                      ADD
                    </button>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Comments Section */}
        <CommentSection productId={product.id} />
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

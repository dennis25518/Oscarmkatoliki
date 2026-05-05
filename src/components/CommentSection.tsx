import * as React from "react";
import {
  FiStar,
  FiSend,
  FiImage,
  FiX,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import { useAuth } from "../lib/AuthContext";
import { useToast } from "./Toast";
import {
  comments as commentsApi,
  storage,
  profiles,
} from "../lib/supabaseClient";
import type { ProductComment } from "../lib/supabaseClient";

interface CommentSectionProps {
  productId: number;
}

function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 20,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: number;
}) {
  const [hover, setHover] = React.useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readOnly && setHover(star)}
          onMouseLeave={() => !readOnly && setHover(0)}
          className={`transition ${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
        >
          <FiStar
            size={size}
            className={
              star <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "text-gray-300"
            }
          />
        </button>
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sw-TZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function averageRating(list: ProductComment[]) {
  if (!list.length) return 0;
  return list.reduce((s, c) => s + c.rating, 0) / list.length;
}

export function CommentSection({ productId }: CommentSectionProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [commentList, setCommentList] = React.useState<ProductComment[]>([]);
  const [loadingComments, setLoadingComments] = React.useState(true);

  // Form state
  const [rating, setRating] = React.useState(0);
  const [body, setBody] = React.useState("");
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [proofPreview, setProofPreview] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load comments
  React.useEffect(() => {
    setLoadingComments(true);
    commentsApi.getComments(productId).then(({ data }) => {
      setCommentList(data ?? []);
      setLoadingComments(false);
    });
  }, [productId]);

  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Picha lazima iwe chini ya 5 MB", "warning");
      return;
    }
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const clearProof = () => {
    setProofFile(null);
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (rating === 0) {
      showToast("Tafadhali chagua nyota za tathmini", "warning");
      return;
    }
    if (!body.trim()) {
      showToast("Tafadhali andika maoni yako", "warning");
      return;
    }

    setSubmitting(true);
    try {
      // Get display name from profile
      const { data: profile } = await profiles.getProfile(user.id);
      const userName =
        profile?.name || user.email?.split("@")[0] || "Mtumiaji";
      const userAvatar = profile?.profile_picture ?? null;

      // Upload proof image if provided
      let proofUrl: string | null = null;
      if (proofFile) {
        const { url, error: uploadErr } = await storage.uploadCommentProof(
          user.id,
          proofFile,
        );
        if (uploadErr) {
          showToast("Kosa la kupakia picha: " + uploadErr.message, "error");
          setSubmitting(false);
          return;
        }
        proofUrl = url;
      }

      const { data: newComment, error } = await commentsApi.createComment({
        product_id: productId,
        user_id: user.id,
        user_name: userName,
        user_avatar: userAvatar,
        rating,
        body: body.trim(),
        proof_image_url: proofUrl,
      });

      if (error) {
        showToast("Kosa la kutuma maoni: " + error.message, "error");
      } else if (newComment) {
        setCommentList((prev) => [newComment, ...prev]);
        setRating(0);
        setBody("");
        clearProof();
        showToast("Maoni yako yametumwa. Asante!", "success");
      }
    } catch (err) {
      showToast("Hitilafu isiyojulikana", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await commentsApi.deleteComment(commentId);
    if (!error) {
      setCommentList((prev) => prev.filter((c) => c.id !== commentId));
      showToast("Maoni yamefutwa", "success");
    }
  };

  const avg = averageRating(commentList);

  return (
    <div className="mt-20">
      {/* Section header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-black">
            Maoni ya Wasomaji
          </h2>
          {commentList.length > 0 && (
            <div className="flex items-center gap-3 mt-2">
              <StarRating value={Math.round(avg)} readOnly size={18} />
              <span className="text-sm text-gray-600">
                {avg.toFixed(1)} kati ya 5 ({commentList.length}{" "}
                {commentList.length === 1 ? "tathmini" : "tathmini"})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Post a comment – registered users only */}
      {user ? (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-10"
        >
          <h3 className="text-lg font-bold text-black mb-4">
            Andika Maoni Yako
          </h3>

          {/* Rating */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tathmini (Nyota) *
            </label>
            <StarRating value={rating} onChange={setRating} size={28} />
          </div>

          {/* Comment body */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Maoni Yako *
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Shiriki uzoefu wako na bidhaa hii..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-700 resize-none text-sm"
              disabled={submitting}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {body.length}/1000
            </p>
          </div>

          {/* Proof image */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Picha ya Uthibitisho (Hiyari)
            </label>
            {proofPreview ? (
              <div className="relative inline-block">
                <img
                  src={proofPreview}
                  alt="Proof preview"
                  className="w-32 h-32 object-cover rounded-xl border border-gray-200"
                />
                <button
                  type="button"
                  onClick={clearProof}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                >
                  <FiX size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-amber-400 hover:text-amber-700 transition text-sm"
              >
                <FiImage size={18} />
                Bonyeza kuongeza picha (max 5 MB)
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProofChange}
              className="hidden"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-8 py-3 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white font-bold rounded-xl transition"
          >
            <FiSend size={16} />
            {submitting ? "Inatuma..." : "Tuma Maoni"}
          </button>
        </form>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-10 text-center">
          <FiUser size={36} className="mx-auto text-amber-600 mb-3" />
          <p className="text-gray-700 font-semibold mb-1">
            Ingia ili uweze kuandika maoni
          </p>
          <p className="text-gray-500 text-sm mb-4">
            Lazima uwe umesajili na umeingia ili uweze kutoa tathmini.
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition text-sm"
          >
            Ingia / Sajili
          </a>
        </div>
      )}

      {/* Comments list */}
      {loadingComments ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-700 border-t-transparent" />
        </div>
      ) : commentList.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-lg">Bado hakuna maoni.</p>
          <p className="text-sm mt-1">Kuwa wa kwanza kuandika maoni!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {commentList.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {c.user_avatar ? (
                      <img
                        src={c.user_avatar}
                        alt={c.user_name}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <span className="text-amber-700 font-bold text-sm">
                          {c.user_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-black text-sm">
                        {c.user_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(c.created_at)}
                      </span>
                    </div>
                    <StarRating value={c.rating} readOnly size={14} />
                    <p className="text-gray-700 text-sm mt-3 leading-relaxed">
                      {c.body}
                    </p>
                    {c.proof_image_url && (
                      <a
                        href={c.proof_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-3"
                      >
                        <img
                          src={c.proof_image_url}
                          alt="Uthibitisho"
                          className="w-24 h-24 object-cover rounded-xl border border-gray-200 hover:opacity-90 transition"
                        />
                      </a>
                    )}
                  </div>
                </div>

                {/* Delete button – only for comment owner */}
                {user?.id === c.user_id && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition flex-shrink-0"
                    title="Futa maoni"
                  >
                    <FiTrash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

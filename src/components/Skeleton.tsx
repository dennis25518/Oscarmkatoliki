import * as React from "react";

/** Base shimmer block */
function Bone({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} />;
}

/** Circle variant for avatars */
function BoneCircle({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-full ${className}`} />;
}

// ─── Product card ────────────────────────────────────────────────────────────
export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* image */}
      <Bone className="w-full h-40" />
      {/* body */}
      <div className="flex-1 p-3 flex flex-col gap-2">
        <Bone className="h-4 w-4/5" />
        <Bone className="h-3 w-3/5" />
        <Bone className="h-3 w-2/5 mt-1" />
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <Bone className="h-5 w-1/3" />
          <Bone className="h-8 w-2/5 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── Product detail page ─────────────────────────────────────────────────────
export function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      {/* back link */}
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <Bone className="h-4 w-20" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* left: image */}
          <Bone className="h-80 w-full rounded-xl" />

          {/* right: details */}
          <div className="flex flex-col gap-4">
            <Bone className="h-3 w-24" />
            <Bone className="h-6 w-4/5" />
            <Bone className="h-6 w-3/5" />
            <div className="flex flex-col gap-2 mt-2">
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-4/5" />
              <Bone className="h-3 w-3/5" />
            </div>
            <Bone className="h-8 w-1/3 mt-4" />
            <div className="flex gap-3 mt-4">
              <Bone className="h-10 w-28 rounded-lg" />
              <Bone className="h-10 flex-1 rounded-lg" />
            </div>
          </div>
        </div>

        {/* similar products heading */}
        <div className="mt-20">
          <Bone className="h-5 w-48 mx-auto mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Comment card ─────────────────────────────────────────────────────────────
export function CommentSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* top row */}
      <div className="flex items-start gap-3 mb-3">
        <BoneCircle className="w-10 h-10 flex-shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <Bone className="h-3 w-32" />
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Bone key={i} className="h-3 w-4 rounded-sm" />
            ))}
          </div>
        </div>
      </div>
      {/* body + image row */}
      <div className="flex items-start gap-4">
        <div className="flex-1 flex flex-col gap-2">
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-4/5" />
          <Bone className="h-3 w-3/5" />
        </div>
        <Bone className="w-24 h-24 flex-shrink-0 rounded-xl" />
      </div>
    </div>
  );
}

// ─── User Profile page ────────────────────────────────────────────────────────
export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* top bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 bg-white border-b border-gray-200">
        <Bone className="h-4 w-20" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* header card */}
        <div className="bg-gradient-to-r from-amber-100 to-amber-50 rounded-t-3xl p-8 mb-0">
          <div className="flex flex-col items-center gap-4">
            <BoneCircle className="w-20 h-20" />
            <Bone className="h-5 w-40" />
            <Bone className="h-3 w-56" />
          </div>
        </div>

        {/* tabs */}
        <div className="bg-white rounded-b-3xl shadow-sm px-6 py-4 mb-6">
          <div className="flex gap-4 overflow-x-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bone key={i} className="h-8 w-28 flex-shrink-0 rounded-full" />
            ))}
          </div>
        </div>

        {/* content card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1">
              <Bone className="h-3 w-24" />
              <Bone className="h-10 w-full rounded-lg" />
            </div>
          ))}
          <Bone className="h-10 w-40 rounded-lg mt-2" />
        </div>
      </div>
    </div>
  );
}

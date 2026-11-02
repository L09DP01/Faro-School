"use client";

import { useTranslations } from "next-intl";
import { Star } from "lucide-react";

export interface CourseReviewItem {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  verified?: boolean;
}

interface CourseReviewsProps {
  reviews: CourseReviewItem[];
  averageRating: number | null;
  reviewsCount?: number | null;
}

export function CourseReviews({ reviews, averageRating, reviewsCount=reviews.length }: CourseReviewsProps) {
  const t = useTranslations("courseDetail.reviews");

  const facts = useTranslations("courseFacts");
  const displayList = reviews.slice(0,20);

  return (
    <div className="rounded-[18px] border border-line bg-surface p-6 sm:p-8 space-y-6 shadow-card">
      {/* Reviews Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-ink">
            {t("title")}
          </h2>
          <p className="mt-0.5 font-sans text-xs text-muted-faro">{t("basedOn")}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-heading text-2xl font-black text-ink">
            <span className="text-orange">★</span>
            <span>{averageRating == null ? "—" : averageRating.toFixed(1)}</span>
            <span className="text-xs text-muted-faro font-normal">/5</span>
          </div>
          <span className="font-sans text-xs text-muted-faro">
            {reviewsCount == null ? facts("unavailable") : facts("reviewCount",{count:reviewsCount})}
          </span>
        </div>
      </div>

      {reviewsCount === 0 && <p className="text-sm text-muted-faro">{facts("noReviews")}</p>}
      {/* Real enrolled-student reviews only */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {displayList.map((rev) => (
          <div
            key={rev.id}
            className="rounded-2xl border border-line bg-bg p-4.5 space-y-3 flex flex-col justify-between shadow-subtle hover:border-orange/40 transition-colors"
          >
            <div className="space-y-2">
              {/* Rating stars */}
              <div className="flex items-center gap-1 text-orange">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 text-orange ${i < rev.rating ? "fill-current" : ""}`}
                  />
                ))}
              </div>
              {/* Comment */}
              <p className="font-sans text-xs text-ink/90 leading-relaxed italic line-clamp-4">
                &ldquo;{rev.comment}&rdquo;
              </p>
            </div>

            {/* Author */}
            <div className="flex items-center gap-2.5 pt-2 border-t border-line/60">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-tint text-orange font-heading font-bold text-xs">
                {rev.authorName.charAt(0)}
              </div>
              <div className="truncate">
                <p className="font-heading font-bold text-xs text-ink truncate">
                  {rev.authorName}
                </p>
                <p className="font-sans text-[10px] text-muted-faro">
                  {rev.verified ? facts("verified") : ""}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

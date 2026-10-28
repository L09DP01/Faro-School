import { Container } from "@/components";
import { useTranslations } from "next-intl";

export interface ReviewItem {
  id: string;
  name: string;
  role?: string;
  city?: string;
  courseTitle: string;
  rating: number;
  comment: string;
}

interface TestimonialsSectionProps {
  reviews?: ReviewItem[];
}

export function TestimonialsSection({ reviews = [] }: TestimonialsSectionProps) {
  const t = useTranslations("landing.testimonials");

  // Fallback reviews if database has none
  const defaultReviews: ReviewItem[] = [
    {
      id: "f1",
      name: t("fallback1.name"),
      role: t("fallback1.role"),
      city: t("fallback1.city"),
      courseTitle: t("fallback1.course"),
      rating: 5,
      comment: t("fallback1.comment"),
    },
    {
      id: "f2",
      name: t("fallback2.name"),
      role: t("fallback2.role"),
      city: t("fallback2.city"),
      courseTitle: t("fallback2.course"),
      rating: 5,
      comment: t("fallback2.comment"),
    },
    {
      id: "f3",
      name: t("fallback3.name"),
      role: t("fallback3.role"),
      city: t("fallback3.city"),
      courseTitle: t("fallback3.course"),
      rating: 5,
      comment: t("fallback3.comment"),
    },
  ];

  const itemsToRender = reviews.length >= 3 ? reviews.slice(0, 3) : defaultReviews;

  return (
    <section className="py-12 md:py-16 border-b border-border bg-background">
      <Container className="space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t("badge")}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {itemsToRender.map((rev) => (
            <div
              key={rev.id}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <div>
                {/* Rating stars */}
                <div className="flex items-center gap-1 text-amber-500 mb-3" aria-label={`${rev.rating} étoiles sur 5`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className="text-sm">
                      {i < rev.rating ? "★" : "☆"}
                    </span>
                  ))}
                </div>

                {/* Comment */}
                <p className="text-xs sm:text-sm text-foreground leading-relaxed italic">
                  &ldquo;{rev.comment}&rdquo;
                </p>
              </div>

              {/* Author footer */}
              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-xs font-bold text-foreground">{rev.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {rev.role ? `${rev.role} • ` : ""}{rev.city}
                </p>
                <p className="mt-1 text-[10px] font-medium text-primary uppercase tracking-wider">
                  {rev.courseTitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

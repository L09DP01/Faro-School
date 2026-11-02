import { Link } from "@/i18n/navigation";
import { PriceTag } from "./PriceTag";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Pill } from "./ui/badge";
import { Clock, BookOpen, Star, ShoppingCart } from "lucide-react";

export interface CourseCardData {
  id: string;
  slug: string;
  title: string;
  description?: string;
  priceHtg: number;
  comparePriceHtg?: number | null;
  level: string;
  category: string;
  lessonsCount?: number;
  modulesCount?: number;
  coverUrl?: string | null;
  durationMin?: number | null;
  durationHours?: number | null;
  rating?: number | null;
  reviewsCount?: number | null;
  isPopular?: boolean;
  instructorName?: string;
}

interface CourseCardProps {
  course: CourseCardData;
  className?: string;
}

export function CourseCard({ course, className }: CourseCardProps) {
  const t = useTranslations("courseFacts");

  const durationText = course.durationHours
    ? `${course.durationHours}h`
    : course.durationMin
    ? `${Math.round(course.durationMin / 60)}h`
    : null;

  return (
    <article
      className={cn(
        "group flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-200 hover:-translate-y-1 hover:shadow-card",
        className
      )}
    >
      <div>
        {/* 16:9 Thumbnail with Overlays */}
        <div className="relative aspect-video w-full overflow-hidden bg-bg">
          {course.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.coverUrl}
              alt={course.title}
              width={640}
              height={360}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-orange-tint/40 text-orange font-bold text-sm">
              <span>{course.category}</span>
            </div>
          )}

          {/* Category Pill Overlay Bottom-Left */}
          <div className="absolute bottom-3 left-3">
            <Pill variant="navy" className="text-[11px] py-0.5 px-2.5 shadow-md">
              {course.category}
            </Pill>
          </div>

          {/* "Populaire" Pill Top-Right if Popular */}
          {course.isPopular && (
            <div className="absolute top-3 right-3">
              <Pill variant="orange" className="text-[11px] py-0.5 px-2.5 shadow-md">
                {t("popular")}
              </Pill>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Rating Row */}
          <div className="flex items-center gap-1.5 text-xs text-muted-faro mb-2.5">
            <div className="flex items-center text-orange">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn("w-3.5 h-3.5 text-orange", i < Math.round(course.rating ?? 0) && "fill-current")}
                />
              ))}
            </div>
            <span className="font-bold text-ink text-xs">
              {course.rating != null && (course.reviewsCount ?? 0)>0 ? course.rating.toFixed(1) : "—"}
            </span>
            <span className="text-muted-faro text-[11px]">
              {course.reviewsCount == null ? t("unavailable") : t("reviewCount", {count: course.reviewsCount})}
            </span>
          </div>

          {/* Title: 2 lines max */}
          <h3 className="font-heading text-base font-bold text-ink line-clamp-2 leading-snug group-hover:text-orange-strong transition-colors">
            <Link
              href={`/formations/${course.slug}`}
              className="focus:outline-none focus:ring-1 focus:ring-orange rounded"
            >
              {course.title}
            </Link>
          </h3>

          {course.instructorName && <p className="mt-2 text-xs text-muted-faro">{course.instructorName}</p>}
          {/* Meta specs: modules & duration with clean outline icons */}
          <div className="mt-3.5 flex items-center gap-4 text-xs font-medium text-muted-faro">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-muted-faro" />
              <span>
                {course.modulesCount == null ? t("unavailable") : t("modules", {count:course.modulesCount})}
              </span>
            </div>
            {durationText && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-muted-faro" />
                <span>{durationText}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with Price and Square Orange Cart Button */}
      <div className="p-5 pt-0 mt-2">
        <div className="pt-3.5 border-t border-line flex items-center justify-between gap-3">
          <div>
            <PriceTag
              priceHtg={course.priceHtg}
              comparePriceHtg={course.comparePriceHtg}
              size="md"
            />
          </div>

          {/* Orange square button with cart icon linking to /checkout/[slug] */}
          <Link
            href={`/checkout/${course.slug}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange text-white shadow-orange hover:bg-orange-strong transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
            aria-label={t("buy", {title:course.title})}
          >
            <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
          </Link>
        </div>
      </div>
    </article>
  );
}

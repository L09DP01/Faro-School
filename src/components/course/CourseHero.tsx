import { Link } from "@/i18n/navigation";
import { Container } from "@/components";
import { useTranslations } from "next-intl";
import { Star, Users, BookOpen, Clock, Globe } from "lucide-react";

interface CourseHeroProps {
  title: string;
  description: string;
  category: string;
  level: string;
  rating: number;
  reviewsCount: number;
  studentsCount: number;
  modulesCount: number;
  lessonsCount: number;
  totalDurationMin: number;
}

export function CourseHero({
  title,
  description,
  category,
  level,
  rating,
  reviewsCount,
  studentsCount,
  modulesCount,
  lessonsCount,
  totalDurationMin,
}: CourseHeroProps) {
  const t = useTranslations("courseDetail");

  const hours = Math.floor(totalDurationMin / 60);
  const mins = totalDurationMin % 60;
  const durationText = hours > 0 ? `${hours}h ${mins}min` : `${mins} min`;

  return (
    <section className="bg-gradient-to-r from-navy via-navy to-navy-hero text-white py-10 md:py-14 border-b border-navy-deep shadow-md">
      <Container>
        <div className="max-w-3xl space-y-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-blue-tint/70 font-sans" aria-label="Fil d'Ariane">
            <Link href="/" className="hover:text-white transition-colors">
              Accueil
            </Link>
            <span>/</span>
            <Link href="/formations" className="hover:text-white transition-colors">
              {t("breadcrumb")}
            </Link>
            <span>/</span>
            <span className="text-white font-medium truncate max-w-[200px] sm:max-w-none">
              {title}
            </span>
          </nav>

          {/* Amber-tint category tag & level */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-heading font-semibold bg-orange-tint text-orange-strong border border-orange/20 shadow-subtle uppercase tracking-wider">
              {category}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-heading font-medium bg-white/10 text-white/90 border border-white/15">
              {t("level", { level })}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-heading font-medium bg-white/10 text-white/90 border border-white/15">
              <Globe className="w-3.5 h-3.5" />
              <span>Français & Créole</span>
            </span>
          </div>

          {/* 52px Title */}
          <h1 className="font-heading font-black text-3xl sm:text-4xl lg:text-[52px] leading-[1.12] tracking-tight text-white">
            {title}
          </h1>

          {/* White-blue subtitle */}
          <p className="font-sans text-base sm:text-lg text-blue-tint/90 leading-relaxed max-w-2xl">
            {description}
          </p>

          {/* Metadata Specs line */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 pt-2 text-xs sm:text-sm text-blue-tint/80 font-sans">
            {/* Rating (Amber Stars) */}
            <div className="flex items-center gap-1.5 font-heading font-bold text-white">
              <div className="flex items-center text-orange">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-current text-orange"
                  />
                ))}
              </div>
              <span className="text-sm">{rating.toFixed(1)}</span>
              <span className="text-blue-tint/70 font-normal text-xs">
                ({t("ratingStats", { rating: rating.toFixed(1), count: reviewsCount })})
              </span>
            </div>

            <span className="text-white/30 hidden sm:inline">•</span>

            {/* Students Count */}
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-tint/70" />
              <span>
                {t("enrolledStudents", { count: studentsCount > 0 ? studentsCount : 120 })}
              </span>
            </div>

            <span className="text-white/30 hidden sm:inline">•</span>

            {/* Modules and Duration */}
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-tint/70" />
              <span>
                {t("curriculumSummary", {
                  modules: modulesCount,
                  lessons: lessonsCount,
                  duration: durationText,
                })}
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

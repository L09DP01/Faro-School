"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/Container";
import { CourseCard, type CourseCardData } from "@/components/CourseCard";
import { BookOpen } from "lucide-react";

interface PopularCoursesSectionProps {
  courses: CourseCardData[];
}

export function PopularCoursesSection({ courses }: PopularCoursesSectionProps) {
  const [activeDot, setActiveDot] = useState(0);
  const displayCourses = courses.slice(0, 4);

  return (
    <section className="py-14 md:py-20 bg-surface border-y border-line">
      <Container className="space-y-8">
        {/* Header with Title, Subtitle, and Blue Underlined Link */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-orange">
              Formations populaires
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Les compétences les plus demandées en Haïti
            </h2>
            <p className="text-sm text-muted-faro max-w-xl">
              Des cursus complets pour te former rapidement et lancer ton activité professionnelle.
            </p>
          </div>
          <Link
            href="/formations"
            className="text-sm font-semibold text-blue underline underline-offset-4 hover:text-blue/80 transition-colors shrink-0"
          >
            Voir toutes les formations →
          </Link>
        </div>

        {/* Courses Display */}
        {displayCourses.length > 0 ? (
          <div>
            {/* Desktop: Grid of 4 Cards */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {displayCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>

            {/* Mobile: Horizontal Snap Carousel with Dots */}
            <div className="sm:hidden">
              <div
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 pt-1 px-1 -mx-4 scrollbar-none"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const itemWidth = target.offsetWidth * 0.85;
                  const newIndex = Math.round(target.scrollLeft / itemWidth);
                  setActiveDot(Math.min(displayCourses.length - 1, Math.max(0, newIndex)));
                }}
              >
                {displayCourses.map((course) => (
                  <div
                    key={course.id}
                    className="w-[85vw] shrink-0 snap-center first:pl-3 last:pr-3"
                  >
                    <CourseCard course={course} />
                  </div>
                ))}
              </div>

              {/* Dots Indicator on Mobile */}
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {displayCourses.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Afficher la formation ${i + 1}`}
                    className={`h-2 rounded-full transition-all duration-200 ${
                      activeDot === i ? "w-6 bg-orange" : "w-2 bg-line"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-bg p-12 text-center space-y-3">
            <BookOpen className="w-8 h-8 text-muted-faro mx-auto" />
            <p className="text-sm font-semibold text-ink">Aucune formation disponible pour le moment.</p>
            <p className="text-xs text-muted-faro">Revenez très vite pour découvrir nos nouveaux cours en ligne.</p>
          </div>
        )}
      </Container>
    </section>
  );
}

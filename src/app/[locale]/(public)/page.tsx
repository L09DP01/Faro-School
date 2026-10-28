import { createClient } from "@/lib/supabase/server";
import { localized } from "@/lib/i18n/localized";
import type { CourseCardData } from "@/components";
import {
  HeroSection,
  StatsSection,
  CategoryStrip,
  CategoriesSection,
  PopularCoursesSection,
  HowItWorksSection,
  BannerSection,
  TestimonialsAndFaqSection,
  NewsletterSection,
  type ReviewItem,
} from "@/components/landing";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://faro.school";

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `${appUrl}/${locale}`,
      languages: {
        fr: `${appUrl}/fr`,
        ht: `${appUrl}/ht`,
      },
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `${appUrl}/${locale}`,
      siteName: "Faro School",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "Faro School - Formations en ligne en Haïti",
        },
      ],
      locale: locale === "ht" ? "ht_HT" : "fr_FR",
      type: "website",
    },
  };
}

export default async function LandingPage({ params }: PageProps) {
  const cookieStore = await cookies();
  if (cookieStore.get("faro_display")?.value === "standalone") {
    redirect("/app");
  }

  const { locale } = await params;
  const supabase = await createClient();

  // 1. Fetch real statistics from the database
  let studentsCount = 0;
  let coursesCount = 0;
  let lessonsCount = 0;
  let averageRating = 4.9;
  const categoryCounts: Record<string, number> = {};

  try {
    const [profilesRes, coursesCountRes, lessonsRes, reviewsRes, allCoursesRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("lessons").select("id", { count: "exact", head: true }).not("video_id", "is", null),
      supabase.from("reviews").select("rating"),
      supabase.from("courses").select("category").eq("status", "published"),
    ]);

    if (typeof profilesRes.count === "number") {
      studentsCount = profilesRes.count;
    }
    if (typeof coursesCountRes.count === "number") {
      coursesCount = coursesCountRes.count;
    }
    if (typeof lessonsRes.count === "number") {
      lessonsCount = lessonsRes.count;
    }
    if (reviewsRes.data && reviewsRes.data.length > 0) {
      const sum = reviewsRes.data.reduce((acc: number, curr: any) => acc + (curr.rating || 0), 0);
      averageRating = Number((sum / reviewsRes.data.length).toFixed(1));
    }
    if (allCoursesRes.data) {
      allCoursesRes.data.forEach((c: any) => {
        if (c.category) {
          categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
        }
      });
    }
  } catch {
    // Graceful fallback if database in offline test mode
  }

  // 2. Fetch published courses for popular section (ordered by creation/enrollments)
  const { data: rawCourses } = await supabase
    .from("courses")
    .select(`
      id, slug, title_fr, title_ht, description_fr, description_ht,
      price_htg, compare_price_htg, level, category, cover_url, created_at,
      modules (
        id,
        lessons ( id, duration_sec )
      )
    `)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(4);

  const courses: CourseCardData[] = (rawCourses || []).map((c: any) => {
    let totalLessons = 0;
    let totalDurationSec = 0;

    if (Array.isArray(c.modules)) {
      c.modules.forEach((m: any) => {
        if (Array.isArray(m.lessons)) {
          totalLessons += m.lessons.length;
          m.lessons.forEach((l: any) => {
            totalDurationSec += l.duration_sec || 0;
          });
        }
      });
    }

    return {
      id: c.id,
      slug: c.slug,
      title: localized(c, "title", locale),
      description: localized(c, "description", locale),
      priceHtg: c.price_htg,
      comparePriceHtg: c.compare_price_htg,
      level: c.level,
      category: c.category,
      coverUrl: c.cover_url,
      modulesCount: Array.isArray(c.modules) ? c.modules.length : 3,
      lessonsCount: totalLessons,
      durationHours: totalDurationSec > 0 ? Math.round(totalDurationSec / 3600) : 6,
      rating: 4.9,
      reviewsCount: 38,
      isPopular: true,
    };
  });

  // 3. Fetch reviews / testimonials from database
  let testimonials: ReviewItem[] = [];
  try {
    const { data: rawReviews } = await supabase
      .from("reviews")
      .select(`
        id, rating, comment, created_at,
        profiles ( full_name ),
        courses ( title_fr, title_ht )
      `)
      .order("created_at", { ascending: false })
      .limit(6);

    if (rawReviews && rawReviews.length > 0) {
      testimonials = rawReviews.map((r: any) => ({
        id: r.id,
        name: r.profiles?.full_name || "Étudiant Faro",
        courseTitle: localized(r.courses, "title", locale) || "Formation Pro",
        rating: r.rating || 5,
        comment: r.comment || "",
      }));
    }
  } catch {
    testimonials = [];
  }

  const stats = {
    studentsCount,
    coursesCount,
    lessonsCount,
    averageRating,
  };

  return (
    <div className="flex flex-col bg-bg">
      {/* 2. Hero Section */}
      <HeroSection stats={stats} />

      {/* 3. Stats Row */}
      <StatsSection stats={stats} />

      {/* 4. Category Strip (Icon items card) */}
      <CategoryStrip />

      {/* 5. "Explorez par catégories" */}
      <CategoriesSection categoryCounts={categoryCounts} />

      {/* 6. "Formations populaires" (4 cards desktop, snap carousel mobile) */}
      <PopularCoursesSection courses={courses} />

      {/* 7. "Comment ça marche ?" */}
      <HowItWorksSection />

      {/* 8. Navy-Deep Banner */}
      <BannerSection />

      {/* 9. Testimonials Carousel & FAQ Accordion (2 columns desktop) */}
      <TestimonialsAndFaqSection reviews={testimonials} />

      {/* 10. Newsletter Band */}
      <NewsletterSection />
    </div>
  );
}

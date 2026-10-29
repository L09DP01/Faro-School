import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { localized } from "@/lib/i18n/localized";
import { Container } from "@/components";
import {
  CourseHero,
  StickyPurchaseCard,
  WhatYouWillLearn,
  CourseCurriculum,
  CourseInstructor,
  CourseReviews,
  CourseFaq,
  CourseCta,
  type CurriculumModule,
  type CourseReviewItem,
} from "@/components/course";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 60; // 1-minute server-side revalidation

interface CoursePageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const supabase = await createClient();

  const { data: dbCourse } = await supabase
    .from("courses")
    .select("title_fr, title_ht, description_fr, description_ht, cover_url")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const course = dbCourse;

  if (!course) {
    return {
      title: "Formation introuvable — Faro School",
      description: "La formation demandée n'existe pas ou n'est plus disponible sur Faro School.",
      robots: { index: false, follow: false },
    };
  }

  const title = localized(course, "title", locale);
  const description = localized(course, "description", locale);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://faroschool.com";

  return {
    title: `${title} — Faro School`,
    description,
    alternates: {
      canonical: `${appUrl}/${locale}/formations/${slug}`,
      languages: {
        fr: `${appUrl}/fr/formations/${slug}`,
        ht: `${appUrl}/ht/formations/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${appUrl}/${locale}/formations/${slug}`,
      siteName: "Faro School",
      locale: locale === "ht" ? "ht_HT" : "fr_FR",
      type: "website",
      images: course.cover_url ? [{ url: course.cover_url }] : [],
    },
  };
}

export default async function CourseDetailPage({ params }: CoursePageProps) {
  const { locale, slug } = await params;
  const supabase = await createClient();

  // 1. Fetch published course with modules and lessons
  const { data: dbCourse, error } = await supabase
    .from("courses")
    .select(`
      id, slug, title_fr, title_ht, description_fr, description_ht,
      price_htg, compare_price_htg, level, category, cover_url, status, created_at,
      modules (
        id, position, title_fr, title_ht,
        lessons (
          id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht
        )
      )
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const course: any = dbCourse;

  // Unknown slug or unpublished course -> return 404
  if (!course) {
    notFound();
  }

  // 2. Check enrollment for current user
  let isEnrolled = false;
  const currentUser = await getCurrentUser();
  if (currentUser) {
    if (currentUser.role === "admin") {
      isEnrolled = true;
    } else {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", currentUser.id)
        .eq("course_id", course.id)
        .maybeSingle();

      if (enrollment) {
        isEnrolled = true;
      }
    }
  }

  // 3. Sort modules and lessons by position
  const rawModules = Array.isArray(course.modules) ? [...course.modules] : [];
  rawModules.sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

  let totalDurationSec = 0;
  let totalLessonsCount = 0;
  let firstPreviewLessonId: string | null = null;
  const learningTakeaways: string[] = [];

  const curriculumModules: CurriculumModule[] = rawModules.map((m: any) => {
    const rawLessons = Array.isArray(m.lessons) ? [...m.lessons] : [];
    rawLessons.sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

    const lessons = rawLessons.map((l: any) => {
      totalDurationSec += l.duration_sec || 0;
      totalLessonsCount += 1;

      if (l.is_free_preview && !firstPreviewLessonId) {
        firstPreviewLessonId = l.id;
      }

      const lessonTitle = localized(l, "title", locale);
      if (learningTakeaways.length < 6 && lessonTitle) {
        learningTakeaways.push(lessonTitle);
      }

      return {
        id: l.id,
        position: l.position || 0,
        title: lessonTitle,
        description: localized(l, "description", locale),
        durationSec: l.duration_sec || 0,
        isFreePreview: Boolean(l.is_free_preview),
      };
    });

    return {
      id: m.id,
      position: m.position || 0,
      title: localized(m, "title", locale),
      lessons,
    };
  });

  // 4. Fetch reviews and aggregate stats
  let reviews: CourseReviewItem[] = [];
  let averageRating = 4.9;
  let studentsCount = 120; // fallback base

  try {
    const [reviewsRes, enrollmentsCountRes] = await Promise.all([
      supabase
        .from("reviews")
        .select(`
          id, rating, comment, created_at,
          profiles ( full_name )
        `)
        .eq("course_id", course.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("course_id", course.id),
    ]);

    if (reviewsRes.data && reviewsRes.data.length > 0) {
      reviews = reviewsRes.data.map((r: any) => ({
        id: r.id,
        authorName: r.profiles?.full_name || "Étudiant Faro",
        rating: r.rating || 5,
        comment: r.comment || "",
        createdAt: r.created_at,
      }));

      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      averageRating = Number((sum / reviews.length).toFixed(1));
    }

    if (typeof enrollmentsCountRes.count === "number" && enrollmentsCountRes.count > 0) {
      studentsCount = enrollmentsCountRes.count;
    }
  } catch {
    // Keep default fallbacks
  }

  // Localized title & description
  const courseTitle = localized(course, "title", locale);
  const courseDesc = localized(course, "description", locale);
  const totalDurationMin = Math.round(totalDurationSec / 60);

  // 5. JSON-LD structured data Schema.org Course
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://faroschool.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: courseTitle,
    description: courseDesc,
    provider: {
      "@type": "Organization",
      name: "Faro School",
      sameAs: appUrl,
    },
    offers: {
      "@type": "Offer",
      price: course.price_htg,
      priceCurrency: "HTG",
      category: "Paid",
      url: `${appUrl}/${locale}/checkout/${course.slug}`,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: averageRating,
      reviewCount: Math.max(1, reviews.length),
    },
  };

  return (
    <div className="min-h-screen bg-bg pb-28 lg:pb-16">
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 1. Hero Section: Dark gradient hero band (navy to navy-hero) */}
      <CourseHero
        title={courseTitle}
        description={courseDesc}
        category={course.category}
        level={course.level}
        rating={averageRating}
        reviewsCount={reviews.length}
        studentsCount={studentsCount}
        modulesCount={curriculumModules.length}
        lessonsCount={totalLessonsCount}
        totalDurationMin={totalDurationMin}
      />

      {/* 2. Main Content Grid (Left column: white cards, Right column: 400px sticky purchase card) */}
      <div className="py-8 md:py-12">
        <Container>
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
            {/* Left Column: Pedagogical Details (White cards with radius 18px) */}
            <div className="flex-1 w-full space-y-8 lg:space-y-10 min-w-0">
              {/* 3. What You Will Learn (2-column list with green check marks) */}
              <WhatYouWillLearn points={learningTakeaways} />

              {/* 4. Curriculum (rows with module name left, duration right, locks / preview) */}
              <CourseCurriculum
                modules={curriculumModules}
                courseSlug={course.slug}
              />

              {/* 5. Instructor Card (round photo placeholder) */}
              <CourseInstructor />

              {/* 6. Reviews (three tinted mini cards) */}
              <CourseReviews
                reviews={reviews}
                averageRating={averageRating}
              />

              {/* 7. FAQ */}
              <CourseFaq />

              {/* Closing CTA */}
              <CourseCta
                courseSlug={course.slug}
                priceHtg={course.price_htg}
                comparePriceHtg={course.compare_price_htg}
                isEnrolled={isEnrolled}
              />
            </div>

            {/* Right Column: Sticky Purchase Card (400px wide, sticky top-24) */}
            <div className="w-full lg:w-[400px] shrink-0">
              <StickyPurchaseCard
                courseSlug={course.slug}
                priceHtg={course.price_htg}
                comparePriceHtg={course.compare_price_htg}
                coverUrl={course.cover_url}
                title={courseTitle}
                isEnrolled={isEnrolled}
                firstPreviewLessonId={firstPreviewLessonId}
              />
            </div>
          </div>
        </Container>
      </div>
    </div>
  );
}

import {getPublicCourseFacts} from "@/lib/public-course-facts";
import {CourseReviewForm} from "@/components/course/CourseReviewForm";
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
      price_htg, compare_price_htg, level, category, cover_url, status, created_at, instructor_id, options,
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
    if (currentUser.role === "admin" || (currentUser.role === "instructor" && course.instructor_id === currentUser.id)) {
      isEnrolled = true;
    } else {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", currentUser.id)
        .eq("course_id", course.id)
        .is("revoked_at",null).or("expires_at.is.null,expires_at.gt."+new Date().toISOString())
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

  const facts=(await getPublicCourseFacts([course.id])).get(course.id);
  const reviews=facts?.reviews || [];
  const averageRating=facts?.averageRating ?? null;
  const studentsCount=facts?.studentsCount ?? null;

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
    ...(averageRating != null && (facts?.reviewsCount ?? 0)>0 ? {aggregateRating: {
      "@type":"AggregateRating", ratingValue:averageRating, reviewCount:facts!.reviewsCount
    }} : {}),
  };

  return (
    <div className="min-h-screen bg-bg pb-28 lg:pb-16">
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g,"\\u003c") }}
      />

      {/* 1. Hero Section: Dark gradient hero band (navy to navy-hero) */}
      <CourseHero
        title={courseTitle}
        description={courseDesc}
        category={course.category}
        level={course.level}
        rating={averageRating}
        reviewsCount={facts?.reviewsCount ?? null}
        studentsCount={studentsCount}
        modulesCount={curriculumModules.length}
        lessonsCount={totalLessonsCount}
        totalDurationMin={totalDurationMin}
        language={course.options?.language}
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
              <CourseInstructor instructor={facts?.instructor ?? null} />

              {/* 6. Reviews (three tinted mini cards) */}
              <CourseReviews
                reviews={reviews}
                averageRating={averageRating}
                reviewsCount={facts?.reviewsCount ?? null}
              />
              {currentUser?.role === "student" && isEnrolled && <CourseReviewForm courseId={course.id}/> }

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

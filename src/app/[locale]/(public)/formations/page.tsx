import { createClient } from "@/lib/supabase/server";
import { localized } from "@/lib/i18n/localized";
import {
  Container,
  CourseCard,
  EmptyState,
  type CourseCardData,
} from "@/components";
import { Button } from "@/components/ui/button";
import {
  CatalogSearch,
  CatalogFilters,
  CatalogMobileDrawer,
  CatalogSort,
  CatalogPagination,
} from "@/components/catalog";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";

export const revalidate = 60; // 1-minute server-side ISR caching for catalog

interface FormationsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    level?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
  }>;
}

export async function generateMetadata({ params }: FormationsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog.meta" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://faroschool.com";

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `${appUrl}/${locale}/formations`,
      languages: {
        fr: `${appUrl}/fr/formations`,
        ht: `${appUrl}/ht/formations`,
      },
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `${appUrl}/${locale}/formations`,
      siteName: "Faro School",
      locale: locale === "ht" ? "ht_HT" : "fr_FR",
      type: "website",
    },
  };
}

export default async function CatalogPage({ params, searchParams }: FormationsPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "catalog" });

  const currentPage = Math.max(1, parseInt(sp.page || "1", 10));
  const pageSize = 12;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  // Build Supabase query
  let query = supabase
    .from("courses")
    .select(
      `
      id, slug, title_fr, title_ht, description_fr, description_ht,
      price_htg, compare_price_htg, level, category, cover_url, created_at,
      modules (
        id,
        lessons ( id, duration_sec )
      )
    `,
      { count: "exact" }
    )
    .eq("status", "published");

  // Filter: Category
  if (sp.category) {
    const cats = sp.category.split(",").filter(Boolean);
    if (cats.length > 0) {
      query = query.in("category", cats);
    }
  }

  // Filter: Level
  if (sp.level && sp.level !== "all") {
    query = query.eq("level", sp.level);
  }

  // Filter: Max Price
  if (sp.maxPrice) {
    const max = Number(sp.maxPrice);
    if (!isNaN(max) && max > 0) {
      query = query.lte("price_htg", max);
    }
  }

  // Filter: Search Query (?q=) across both French and Creole titles and descriptions
  if (sp.q && sp.q.trim()) {
    const searchVal = sp.q.trim();
    query = query.or(
      `title_fr.ilike.%${searchVal}%,title_ht.ilike.%${searchVal}%,description_fr.ilike.%${searchVal}%,description_ht.ilike.%${searchVal}%`
    );
  }

  // Sort
  switch (sp.sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "price_asc":
      query = query.order("price_htg", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price_htg", { ascending: false });
      break;
    case "popular":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  query = query.range(from, to);

  const { data: rawCourses, count, error } = await query;

  const totalCount = typeof count === "number" ? count : rawCourses?.length || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Map courses to CourseCardData
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
      lessonsCount: totalLessons,
      durationMin: totalDurationSec > 0 ? Math.round(totalDurationSec / 60) : undefined,
      rating: 4.9,
    };
  });

  const hasActiveFilters = Boolean(sp.category || (sp.level && sp.level !== "all") || sp.maxPrice || sp.q);

  return (
    <div className="min-h-screen bg-bg">
      {/* 1. White Title Band under Header */}
      <section className="border-b border-line bg-surface py-8 md:py-10">
        <Container>
          <div className="max-w-3xl space-y-2">
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-ink leading-[1.15]">
              {t("title")}
            </h1>
            <p className="font-sans text-sm sm:text-base text-muted-faro leading-relaxed">
              {t("subtitle")}
            </p>
          </div>

          {/* Large search field and sort select on the same row (sticky on mobile under header) */}
          <div className="sticky top-[60px] md:static z-20 bg-surface/95 backdrop-blur md:backdrop-blur-none py-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:py-0 mt-6 pt-1">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1">
                <CatalogSearch initialQuery={sp.q || ""} />
              </div>
              <div className="shrink-0 flex items-center justify-between sm:justify-end gap-3">
                <div className="lg:hidden">
                  <CatalogMobileDrawer />
                </div>
                <CatalogSort />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* 2. Main Catalog Body */}
      <section className="py-8 md:py-10">
        <Container>
          {/* Header row above grid: Results count and clear link */}
          <div className="flex items-center justify-between pb-6">
            <div className="flex items-center gap-3">
              <p className="font-sans text-sm font-medium text-muted-faro">
                {t("resultsCount", { count: totalCount })}
              </p>
              {hasActiveFilters && (
                <Link
                  href="/formations"
                  className="font-heading text-xs font-semibold text-blue hover:underline"
                >
                  {t("clearFilters")}
                </Link>
              )}
            </div>
          </div>

          {/* Two columns layout: 260px filter card on left, 3-column CourseCard grid on right */}
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Desktop Left Sidebar: 260px filter card */}
            <aside className="hidden lg:block w-[260px] shrink-0 rounded-2xl border border-line bg-surface p-5 sticky top-24 shadow-card">
              <CatalogFilters />
            </aside>

            {/* Right Column: Course Cards Grid */}
            <div className="flex-1 w-full space-y-8">
              {error && (
                <div className="p-4 rounded-xl border border-red/30 bg-red-tint text-xs text-red font-medium">
                  Une erreur est survenue lors du chargement des cours.
                </div>
              )}

              {courses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={t("noResults")}
                  description={t("noResultsDesc")}
                  action={
                    <Link href="/formations">
                      <Button variant="primary" size="default">
                        {t("clearFilters")}
                      </Button>
                    </Link>
                  }
                />
              )}

              {/* Pagination */}
              <CatalogPagination currentPage={currentPage} totalPages={totalPages} />
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

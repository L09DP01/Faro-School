import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localized } from "@/lib/i18n/localized";
import { Check, CreditCard, CheckCircle2 } from "lucide-react";

interface CheckoutPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: CheckoutPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("title_fr, title_ht")
    .eq("slug", slug)
    .maybeSingle();

  const title = course
    ? localized(course, "title", locale as "fr" | "ht")
    : slug;

  return {
    title: `${t("title")} — ${title} | Faro School`,
    description: t("subtitle"),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { locale, slug } = await params;

  // 1. Guard: Authentication check
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/connexion?next=/checkout/${slug}`);
  }

  // 2. Fetch course from database
  const supabase = await createClient();
  const { data: course, error } = await supabase
    .from("courses")
    .select("id, slug, title_fr, title_ht, cover_url, price_htg, compare_price_htg, status")
    .eq("slug", slug)
    .maybeSingle();

  // Guard: Course not found or not published
  if (error || !course || course.status !== "published") {
    notFound();
  }

  // 3. Guard: Already enrolled check
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", course.id)
    .maybeSingle();

  if (enrollment) {
    redirect(`/${locale}/dashboard`);
  }

  const courseTitle = localized(course, "title", locale as "fr" | "ht");
  const whatsappNumber =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "+509 36 00 00 00";

  return (
    <div className="py-6 sm:py-8 bg-bg min-h-screen">
      <Container className="space-y-6">
        {/* Progress chips: Compte (green with check), Paiement (blue, current), Confirmation (muted) */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 py-2">
          {/* Chip 1: Compte (green with check) */}
          <div className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-ok-tint text-ok border border-ok/20 font-heading text-xs font-bold shadow-subtle">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Compte</span>
          </div>

          <div className="h-0.5 w-6 sm:w-10 bg-ok/40" />

          {/* Chip 2: Paiement (blue, current) */}
          <div className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-blue text-white font-heading text-xs font-bold shadow-subtle">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Paiement</span>
          </div>

          <div className="h-0.5 w-6 sm:w-10 bg-line" />

          {/* Chip 3: Confirmation (muted) */}
          <div className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-surface text-muted-faro border border-line font-heading text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirmation</span>
          </div>
        </div>

        {/* Interactive Checkout Form */}
        <CheckoutForm
          courseId={course.id}
          courseSlug={course.slug}
          courseTitle={courseTitle}
          basePriceHtg={course.price_htg}
          comparePriceHtg={course.compare_price_htg}
          coverUrl={course.cover_url}
          defaultPhone={user.phone}
          locale={locale}
          whatsappNumber={whatsappNumber}
        />
      </Container>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { ConfirmationCard } from "@/components/confirmation/ConfirmationCard";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localized } from "@/lib/i18n/localized";

interface ConfirmationPageProps {
  params: Promise<{
    locale: string;
    orderId: string;
  }>;
  searchParams: Promise<{
    status?: string;
  }>;
}

export async function generateMetadata({
  params,
}: ConfirmationPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "confirmation" });

  return {
    title: `${t("title")} | Faro School`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: ConfirmationPageProps) {
  const { locale, orderId } = await params;
  const { status: queryStatus } = await searchParams;

  // 1. Guard: Authenticate user
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  // 2. Fetch order with course, modules, lessons and payments
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      id,
      reference,
      amount_htg,
      status,
      user_id,
      created_at,
      courses (
        id,
        slug,
        title_fr,
        title_ht,
        modules (
          id,
          position,
          lessons (
            id,
            position
          )
        )
      ),
      payments (
        id,
        provider,
        provider_txn_id,
        status,
        created_at
      )
    `)
    .eq("id", orderId)
    .maybeSingle();

  // Guard: Order must belong to current user
  if (error || !order || order.user_id !== user.id) {
    notFound();
  }

  const courseData = order.courses as {
    id?: string;
    slug?: string;
    title_fr?: string;
    title_ht?: string;
    modules?: Array<{
      id: string;
      position: number;
      lessons?: Array<{
        id: string;
        position: number;
      }>;
    }>;
  } | null;

  const courseTitle = courseData
    ? localized(courseData, "title", locale as "fr" | "ht")
    : "Formation Faro";
  const courseSlug = courseData?.slug || "";

  // Find first lesson for "Commencer la formation" CTA
  let firstLessonId: string | null = null;
  if (courseData?.modules && courseData.modules.length > 0) {
    const sortedModules = [...courseData.modules].sort(
      (a, b) => a.position - b.position
    );
    for (const mod of sortedModules) {
      if (mod.lessons && mod.lessons.length > 0) {
        const sortedLessons = [...mod.lessons].sort(
          (a, b) => a.position - b.position
        );
        firstLessonId = sortedLessons[0].id;
        break;
      }
    }
  }

  const firstLessonUrl =
    courseSlug && firstLessonId
      ? `/dashboard/learn/${courseSlug}/${firstLessonId}`
      : "/dashboard";

  // Determine initial state
  const paymentsList = Array.isArray(order.payments) ? order.payments : [];
  const latestPayment =
    paymentsList.length > 0 ? paymentsList[paymentsList.length - 1] : null;

  const hasValidatedPayment = paymentsList.some(
    (p) => p.status === "validated"
  );
  const hasAwaitingPayment = paymentsList.some(
    (p) => p.status === "awaiting_validation"
  );
  const hasFailedPayment = paymentsList.some(
    (p) => p.status === "failed"
  );

  let initialState: "success" | "pending" | "failed" = "pending";

  if (order.status === "paid" || hasValidatedPayment) {
    initialState = "success";
  } else if (
    order.status === "failed" ||
    order.status === "cancelled" ||
    hasFailedPayment
  ) {
    initialState = "failed";
  } else {
    initialState = "pending";
  }

  const paymentMethod =
    latestPayment?.provider === "natcash"
      ? "NatCash"
      : latestPayment?.provider === "moncash"
      ? "MonCash"
      : "MonCash / NatCash";

  const formattedDate = new Date(order.created_at).toLocaleDateString(
    locale === "ht" ? "ht-HT" : "fr-HT",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  const whatsappNumber =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "+509 36 00 00 00";

  return (
    <div className="py-8 sm:py-14 bg-bg flex items-center justify-center w-full">
      <div className="w-full max-w-[720px] mx-auto px-4 sm:px-6">
        <ConfirmationCard
          orderId={order.id}
          reference={order.reference}
          initialState={initialState}
          courseTitle={courseTitle}
          courseSlug={courseSlug}
          firstLessonUrl={firstLessonUrl}
          paymentMethod={paymentMethod}
          amountHtg={order.amount_htg}
          formattedDate={formattedDate}
          whatsappNumber={whatsappNumber}
          locale={locale}
        />
      </div>
    </div>
  );
}

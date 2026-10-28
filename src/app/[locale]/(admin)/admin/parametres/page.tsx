import { requireAdmin } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

interface AdminSettingsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminSettingsPage({ params }: AdminSettingsPageProps) {
  const { locale } = await params;
  await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: "admin.dashboard.placeholders" });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("settingsTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("settingsDesc")}
        </p>
      </div>
    </div>
  );
}

import { setRequestLocale } from "next-intl/server";
import { Container } from "@/components/Container";
import { Link } from "@/i18n/navigation";
import { Users, ShieldCheck, Heart, AlertTriangle, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Charte & Règles de la Communauté | Faro School",
  description:
    "Consultez les 5 règles d'or de la communauté Faro School pour des échanges bienveillants et constructifs.",
};

interface CommunityRulesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CommunityRulesPage({ params }: CommunityRulesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const isHt = locale === "ht";

  return (
    <div className="py-12 sm:py-16 md:py-20 bg-bg">
      <Container>
        <div className="max-w-[720px] mx-auto space-y-8">
          {/* Back link */}
          <div>
            <Link
              href="/dashboard/communaute"
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-faro hover:text-ink transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isHt ? "Retounen nan kominote a" : "Retour à l'espace communauté"}</span>
            </Link>
          </div>

          {/* Header */}
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-tint text-orange border border-orange/20">
              <Users className="w-3.5 h-3.5" />
              <span>{isHt ? "Règleman Kominote" : "Charte Communautaire"}</span>
            </span>
            <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-ink tracking-tight">
              {isHt ? "Règ lò kominote Faro School" : "Les 5 règles d'or de la communauté"}
            </h1>
            <p className="text-sm sm:text-base text-muted-faro leading-relaxed">
              {isHt
                ? "Kominote Faro School se yon espas aprantisaj ak pataje kote chak etidyan, fòmatè ak manm dwe santi yo an sekirite epi respekte."
                : "La communauté Faro School est un espace d'entraide, de collaboration et d'apprentissage où chacun s'engage à respecter les principes suivants."}
            </p>
          </div>

          {/* Amber Notice */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 flex items-start gap-3.5 shadow-subtle">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-amber-900 leading-relaxed">
              <strong className="font-semibold block mb-0.5">
                {isHt ? "Respè se kle a" : "Modération active"}
              </strong>
              {isHt
                ? "Nenpòt kont ki pa respekte règleman sa yo ka resevwa yon avètisman, silans (mute), oswa ekspilsyon nèt nan kominote a san ranbousman."
                : "Tout manquement répété à ces règles entraîne la mise en sourdine temporaire ou l'exclusion définitive du groupe après décision de l'équipe d'administration."}
            </div>
          </div>

          {/* 5 Rules Articles */}
          <div className="space-y-6 pt-2">
            {/* Rule 1 */}
            <div className="p-6 rounded-2xl bg-surface border border-line shadow-subtle space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange text-white font-heading font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <h2 className="font-heading font-bold text-base text-ink">
                  {isHt ? "Respè ak koutwazi" : "Respect mutuel et courtoisie"}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-faro leading-relaxed pl-9">
                {isHt
                  ? "Nou kominike ak respè tout tan. Jouman, denigrasyon, agresyon vèbal oswa diskriminasyon pa tolere ditou."
                  : "Chaque membre s'adresse aux autres avec bienveillance et considération. Les insultes, le harcèlement, les provocations et les discriminations sous toutes leurs formes sont strictement prohibés."}
              </p>
            </div>

            {/* Rule 2 */}
            <div className="p-6 rounded-2xl bg-surface border border-line shadow-subtle space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange text-white font-heading font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h2 className="font-heading font-bold text-base text-ink">
                  {isHt ? "Pa gen spam ni piblisite sovaj" : "Zéro spam et aucun démarchage commercial"}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-faro leading-relaxed pl-9">
                {isHt
                  ? "Pataje lyen pou fè lajan fasil, sistèm piramid, piblisite pou lòt sèvis oubyen gwoup WhatsApp ekstèn entèdi nèt."
                  : "La promotion de services tiers, d'opportunités d'enrichissement facile, de pyramides financières ou de liens externes non sollicités est formellement bannie."}
              </p>
            </div>

            {/* Rule 3 */}
            <div className="p-6 rounded-2xl bg-surface border border-line shadow-subtle space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange text-white font-heading font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <h2 className="font-heading font-bold text-base text-ink">
                  {isHt ? "Sekirite done pèsonèl" : "Protection des données et de la vie privée"}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-faro leading-relaxed pl-9">
                {isHt
                  ? "Pa janm pataje kòd PIN, modpas, enfòmasyon sekrè MonCash/NatCash oswa dokiman idantite nan gwoup piblik la."
                  : "Ne publiez jamais de numéros de compte confidentiels, de codes de validation SMS, de codes secrets ou de pièces d'identité sur le groupe public."}
              </p>
            </div>

            {/* Rule 4 */}
            <div className="p-6 rounded-2xl bg-surface border border-line shadow-subtle space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange text-white font-heading font-bold text-xs flex items-center justify-center">
                  4
                </span>
                <h2 className="font-heading font-bold text-base text-ink">
                  {isHt ? "Èd ak pataj konesans" : "Entraide pédagogique et partage constructif"}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-faro leading-relaxed pl-9">
                {isHt
                  ? "Objektif prensipal la se aprann. Poze kesyon sou kou yo, ede kamarad ou yo, epi selebre siksè chak moun."
                  : "La communauté existe pour favoriser votre progression. Partagez vos découvertes, posez vos questions sur les exercices et soutenez vos collègues dans leurs projets."}
              </p>
            </div>

            {/* Rule 5 */}
            <div className="p-6 rounded-2xl bg-surface border border-line shadow-subtle space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange text-white font-heading font-bold text-xs flex items-center justify-center">
                  5
                </span>
                <h2 className="font-heading font-bold text-base text-ink">
                  {isHt ? "Lang ki otorize" : "Langues et clarté"}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-faro leading-relaxed pl-9">
                {isHt
                  ? "Franse ak Kreyòl Ayisyen se 2 lang ofisyèl nou yo. Ekri klèman pou tout moun ka konprann ou."
                  : "Le Français et le Créole haïtien sont pleinement accueillis. Veillez à rédiger des messages lisibles et clairs pour enrichir les échanges."}
              </p>
            </div>
          </div>

          {/* Action CTA */}
          <div className="text-center pt-6">
            <Link
              href="/dashboard/communaute"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-semibold text-xs shadow-orange transition-all"
            >
              <Users className="w-4 h-4" />
              <span>{isHt ? "Rejwenn kominote a kounye a" : "Accéder à la communauté Faro School"}</span>
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}

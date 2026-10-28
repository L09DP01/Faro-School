import { Link } from "@/i18n/navigation";
import { Container } from "@/components/Container";
import {
  Code2,
  Bot,
  TrendingUp,
  Briefcase,
  Palette,
  Film,
  FileSpreadsheet,
  Stethoscope,
} from "lucide-react";

interface CategoriesSectionProps {
  categoryCounts?: Record<string, number>;
}

export function CategoriesSection({ categoryCounts = {} }: CategoriesSectionProps) {
  const categories = [
    {
      name: "Développement Web",
      slug: "developpement-web",
      icon: <Code2 className="w-5 h-5 text-orange" />,
      defaultCount: 4,
    },
    {
      name: "Intelligence Artificielle",
      slug: "intelligence-artificielle",
      icon: <Bot className="w-5 h-5 text-orange" />,
      defaultCount: 2,
    },
    {
      name: "Marketing Digital",
      slug: "marketing-digital",
      icon: <TrendingUp className="w-5 h-5 text-orange" />,
      defaultCount: 3,
    },
    {
      name: "Entrepreneuriat",
      slug: "entrepreneuriat",
      icon: <Briefcase className="w-5 h-5 text-orange" />,
      defaultCount: 3,
    },
    {
      name: "Design Graphique",
      slug: "design-graphique",
      icon: <Palette className="w-5 h-5 text-orange" />,
      defaultCount: 2,
    },
    {
      name: "Montage Vidéo",
      slug: "montage-video",
      icon: <Film className="w-5 h-5 text-orange" />,
      defaultCount: 2,
    },
    {
      name: "Bureautique",
      slug: "bureautique",
      icon: <FileSpreadsheet className="w-5 h-5 text-orange" />,
      defaultCount: 3,
    },
    {
      name: "Santé & Bien-être",
      slug: "sante",
      icon: <Stethoscope className="w-5 h-5 text-orange" />,
      defaultCount: 1,
    },
  ];

  return (
    <section className="py-12 md:py-16 bg-bg">
      <Container className="space-y-8">
        {/* Header with Title, Subtitle, and Blue Underlined Link */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-6">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-orange">
              Explore par catégories
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Trouve la formation idéale pour tes ambitions
            </h2>
            <p className="text-sm text-muted-faro max-w-xl">
              Des cours conçus par des spécialistes haïtiens pour acquérir des compétences pratiques.
            </p>
          </div>
          <Link
            href="/formations"
            className="text-sm font-semibold text-blue underline underline-offset-4 hover:text-blue/80 transition-colors shrink-0"
          >
            Voir toutes les catégories →
          </Link>
        </div>

        {/* Categories Grid: Desktop 8 cards, Mobile 4 cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
          {categories.map((cat, idx) => {
            const count = categoryCounts[cat.slug] ?? categoryCounts[cat.name] ?? cat.defaultCount;
            // On mobile, show first 4 items, rest hidden unless sm+
            const mobileHiddenClass = idx >= 4 ? "hidden sm:flex" : "flex";

            return (
              <Link
                key={cat.slug}
                href={`/formations?category=${cat.slug}` as any}
                className={`${mobileHiddenClass} group flex-col justify-between p-4 rounded-2xl border border-line bg-surface transition-all duration-200 hover:-translate-y-1 hover:shadow-card hover:border-orange/30`}
              >
                <div className="space-y-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-tint text-orange border border-orange/15 transition-transform group-hover:scale-105">
                    {cat.icon}
                  </div>
                  <div>
                    <h3 className="font-heading text-xs sm:text-sm font-bold text-ink group-hover:text-orange-strong transition-colors line-clamp-2 leading-snug">
                      {cat.name}
                    </h3>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-line/60">
                  <span className="text-[11px] font-medium text-muted-faro">
                    {count} {count > 1 ? "formations" : "formation"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

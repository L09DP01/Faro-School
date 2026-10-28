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
  MoreHorizontal,
} from "lucide-react";

export function CategoryStrip() {
  const categories = [
    {
      name: "Dév Web",
      fullName: "Développement Web",
      slug: "developpement-web",
      icon: <Code2 className="w-5 h-5 text-orange" />,
    },
    {
      name: "IA",
      fullName: "Intelligence Artificielle",
      slug: "intelligence-artificielle",
      icon: <Bot className="w-5 h-5 text-orange" />,
    },
    {
      name: "Marketing",
      fullName: "Marketing Digital",
      slug: "marketing-digital",
      icon: <TrendingUp className="w-5 h-5 text-orange" />,
    },
    {
      name: "Business",
      fullName: "Entrepreneuriat",
      slug: "entrepreneuriat",
      icon: <Briefcase className="w-5 h-5 text-orange" />,
    },
    {
      name: "Design",
      fullName: "Design Graphique",
      slug: "design-graphique",
      icon: <Palette className="w-5 h-5 text-orange" />,
    },
    {
      name: "Montage",
      fullName: "Montage Vidéo",
      slug: "montage-video",
      icon: <Film className="w-5 h-5 text-orange" />,
    },
    {
      name: "Bureautique",
      fullName: "Bureautique & Excel",
      slug: "bureautique",
      icon: <FileSpreadsheet className="w-5 h-5 text-orange" />,
    },
    {
      name: "Plus…",
      fullName: "Et bien plus…",
      slug: "",
      icon: <MoreHorizontal className="w-5 h-5 text-orange" />,
    },
  ];

  return (
    <section className="mb-14">
      <Container>
        <div className="rounded-[20px] border border-line bg-surface p-4 sm:p-6 shadow-card">
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3 sm:gap-4">
            {categories.map((cat) => {
              const href = cat.slug ? `/formations?category=${cat.slug}` : "/formations";
              return (
                <Link
                  key={cat.fullName}
                  href={href as any}
                  className="group flex flex-col items-center justify-center p-2.5 rounded-xl transition-all duration-150 hover:bg-orange-tint/40 hover:-translate-y-0.5 text-center"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-tint/80 border border-orange/15 transition-transform group-hover:scale-105 group-hover:bg-orange-tint">
                    {cat.icon}
                  </div>
                  <span className="mt-2 text-xs font-semibold text-ink group-hover:text-orange-strong leading-tight truncate w-full">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}

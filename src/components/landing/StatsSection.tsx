import { Container } from "@/components/Container";
import { Users, Video, BookOpen, Star } from "lucide-react";

interface StatsSectionProps {
  stats: {
    studentsCount: number;
    coursesCount: number;
    lessonsCount: number;
    averageRating: number;
  };
}

export function StatsSection({ stats }: StatsSectionProps) {
  // Real database values with friendly formatting
  const studentDisplay =
    stats.studentsCount > 50
      ? `+${stats.studentsCount.toLocaleString()}`
      : stats.studentsCount > 0
      ? `${stats.studentsCount}`
      : "+1 500";

  const videoDisplay =
    stats.lessonsCount > 10
      ? `${stats.lessonsCount}+`
      : stats.lessonsCount > 0
      ? `${stats.lessonsCount}`
      : "50+";

  const courseDisplay =
    stats.coursesCount > 0 ? `${stats.coursesCount}` : "6";

  const satisfactionDisplay =
    stats.averageRating > 0
      ? `${Math.round((stats.averageRating / 5) * 100)}%`
      : "98%";

  const items = [
    {
      icon: <Users className="w-5 h-5 text-orange" />,
      value: studentDisplay,
      label: "Apprenants inscrits",
    },
    {
      icon: <Video className="w-5 h-5 text-orange" />,
      value: videoDisplay,
      label: "Vidéos de formation",
    },
    {
      icon: <BookOpen className="w-5 h-5 text-orange" />,
      value: courseDisplay,
      label: "Formations certifiantes",
    },
    {
      icon: <Star className="w-5 h-5 text-orange fill-orange" />,
      value: satisfactionDisplay,
      label: "Taux de satisfaction",
    },
  ];

  return (
    <section className="relative z-20 -mt-6 md:-mt-8 mb-12">
      <Container>
        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-card">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-line">
            {items.map((item, idx) => (
              <div
                key={item.label}
                className={`flex items-center gap-3.5 p-3 sm:px-5 ${
                  idx === 1 ? "border-t-0" : ""
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-tint text-orange border border-orange/20">
                  {item.icon}
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-heading text-xl sm:text-2xl font-extrabold text-ink tracking-tight">
                    {item.value}
                  </span>
                  <span className="text-xs text-muted-faro font-medium leading-snug">
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

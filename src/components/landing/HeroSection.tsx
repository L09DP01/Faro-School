"use client";

import { useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/Container";
import { Highlight } from "@/components/brand/Highlight";
import { Button } from "@/components/ui/button";
import { VideoModal } from "./VideoModal";
import { Play, Sparkles, Users, Video, Award } from "lucide-react";

interface HeroSectionProps {
  stats: {
    studentsCount: number;
    coursesCount: number;
    lessonsCount: number;
    averageRating: number;
  };
}

export function HeroSection({ stats }: HeroSectionProps) {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-tint/50 via-bg to-bg pt-8 pb-14 md:pt-14 md:pb-20">
      {/* Background Decorative Shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Pale Circle Glow */}
        <div className="absolute -top-24 right-0 w-[500px] h-[500px] rounded-full bg-blue-tint/80 blur-3xl opacity-60" />
        {/* Large Orange Diagonal Geometric Accent */}
        <div className="absolute top-10 right-0 w-72 h-72 md:w-96 md:h-96 bg-orange/10 -rotate-12 rounded-3xl blur-2xl transform translate-x-1/4" />
      </div>

      <Container className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* LEFT COLUMN: Copy & CTAs (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Pill Tag with Star-Hexagon Icon */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-tint border border-orange/20 text-orange-strong font-heading font-semibold text-xs shadow-subtle">
              <Sparkles className="w-3.5 h-3.5 text-orange" />
              <span>Plateforme de formation en ligne</span>
            </div>

            {/* H1 Headline */}
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-black tracking-tight text-ink leading-[1.12]">
              Apprends des compétences réelles et propulse{" "}
              <Highlight>ton avenir</Highlight>
            </h1>

            {/* Muted Paragraph with MonCash & NatCash */}
            <p className="font-sans text-base sm:text-lg text-muted-faro max-w-xl leading-relaxed">
              Accède à des formations pratiques conçues par des experts haïtiens. Apprends à ton rythme
              sur ton smartphone et paie en toute sécurité par <strong>MonCash</strong> et <strong>NatCash</strong>.
            </p>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:w-auto">
              <Link href="/formations" className="w-full sm:w-auto">
                <Button variant="primary" size="lg" className="w-full sm:w-auto text-base">
                  Commencer maintenant →
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                type="button"
                onClick={() => setIsVideoModalOpen(true)}
                className="w-full sm:w-auto text-base flex items-center justify-center gap-2"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-white">
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                </div>
                <span>Découvrir les formations</span>
              </Button>
            </div>
          </div>

          {/* RIGHT COLUMN: Hero Photo & Floating Stat Cards (lg:col-span-5) */}
          <div className="lg:col-span-5 relative flex justify-center lg:justify-end mt-4 lg:mt-0">
            {/* Visual Canvas Backdrop */}
            <div className="relative w-full max-w-[460px] aspect-[4/3] sm:aspect-square md:aspect-[4/3] lg:aspect-square flex items-center justify-center">
              {/* Geometric Circle behind Photo */}
              <div
                className="absolute inset-4 rounded-full bg-gradient-to-tr from-orange-tint via-blue-tint/50 to-surface border border-line shadow-card"
                aria-hidden="true"
              />

              {/* Diagonal Orange Triangle Accent */}
              <div
                className="absolute -top-4 -right-4 w-32 h-32 bg-orange/20 rounded-2xl rotate-45 blur-lg"
                aria-hidden="true"
              />

              {/* Hero Photo (Priority Loading for LCP) */}
              <div className="relative z-10 w-[90%] h-[90%] overflow-hidden rounded-2xl shadow-lift border-2 border-surface bg-surface">
                <Image
                  src="/brand/hero.webp"
                  alt="Étudiant Faro School avec ordinateur et cahiers"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 500px"
                  className="object-cover object-center"
                />
              </div>

              {/* Floating Stat Card 1: Top Left */}
              <div className="absolute -top-2 left-2 z-20 flex items-center gap-2.5 rounded-xl border border-line bg-surface/95 backdrop-blur px-3.5 py-2.5 shadow-card transition-transform hover:-translate-y-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-tint text-orange font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="font-heading text-xs font-bold text-ink leading-tight">
                    +{stats.studentsCount > 0 ? stats.studentsCount.toLocaleString() : "10 000"}
                  </p>
                  <p className="text-[10px] text-muted-faro font-medium">Apprenants</p>
                </div>
              </div>

              {/* Floating Stat Card 2: Right Center */}
              <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-20 flex items-center gap-2.5 rounded-xl border border-line bg-surface/95 backdrop-blur px-3.5 py-2.5 shadow-card transition-transform hover:-translate-y-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-tint text-blue font-bold">
                  <Video className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="font-heading text-xs font-bold text-ink leading-tight">
                    {stats.lessonsCount > 0 ? `${stats.lessonsCount}+` : "500+"}
                  </p>
                  <p className="text-[10px] text-muted-faro font-medium">Vidéos de cours</p>
                </div>
              </div>

              {/* Floating Stat Card 3: Bottom Left */}
              <div className="absolute -bottom-3 left-6 z-20 flex items-center gap-2.5 rounded-xl border border-line bg-surface/95 backdrop-blur px-3.5 py-2.5 shadow-card transition-transform hover:-translate-y-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ok-tint text-ok font-bold">
                  <Award className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="font-heading text-xs font-bold text-ink leading-tight">Certificat</p>
                  <p className="text-[10px] text-muted-faro font-medium">À la fin du cours</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Video Presentation Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        title="Présentation de Faro School"
      />
    </section>
  );
}

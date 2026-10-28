import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { Logo } from "@/components/brand/Logo";
import { Highlight } from "@/components/brand/Highlight";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ProgressBar";
import { StatItem } from "@/components/StatItem";
import { CourseCard, type CourseCardData } from "@/components/CourseCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, BookOpen, Award, CheckCircle2, ShieldCheck, ShoppingCart } from "lucide-react";

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const sampleCourse: CourseCardData = {
    id: "sample-1",
    slug: "marketing-digital-haiti",
    title: "Marketing Digital & Vente en Ligne pour Entreprises en Haïti",
    description: "Apprenez à générer des prospects qualifiés et à accepter des paiements MonCash et NatCash.",
    priceHtg: 2500,
    comparePriceHtg: 3500,
    level: "Débutant",
    category: "Business",
    modulesCount: 4,
    lessonsCount: 16,
    durationHours: 6,
    rating: 4.9,
    reviewsCount: 128,
    isPopular: true,
  };

  const colors = [
    { name: "Navy Deep", token: "--navy-deep", hex: "#031047", bg: "bg-navy-deep", text: "text-white" },
    { name: "Navy", token: "--navy", hex: "#0B1F4B", bg: "bg-navy", text: "text-white" },
    { name: "Orange", token: "--orange", hex: "#FF7F0E", bg: "bg-orange", text: "text-white" },
    { name: "Orange Strong", token: "--orange-strong", hex: "#E56A00", bg: "bg-orange-strong", text: "text-white" },
    { name: "Orange Tint", token: "--orange-tint", hex: "#FFF5EB", bg: "bg-orange-tint", text: "text-ink" },
    { name: "Blue", token: "--blue", hex: "#1F5BDB", bg: "bg-blue", text: "text-white" },
    { name: "Blue Tint", token: "--blue-tint", hex: "#EFF4FE", bg: "bg-blue-tint", text: "text-ink" },
    { name: "Ink (Text)", token: "--ink", hex: "#101828", bg: "bg-ink", text: "text-white" },
    { name: "Muted Text", token: "--muted", hex: "#5B6478", bg: "bg-muted-faro", text: "text-white" },
    { name: "Line / Border", token: "--line", hex: "#E2E8F0", bg: "bg-line", text: "text-ink" },
    { name: "Page Background", token: "--bg", hex: "#F8FAFC", bg: "bg-bg", text: "text-ink" },
    { name: "Surface (Card)", token: "--surface", hex: "#FFFFFF", bg: "bg-surface", text: "text-ink border" },
    { name: "Success Ok", token: "--ok", hex: "#16A34A", bg: "bg-ok", text: "text-white" },
    { name: "Error Red", token: "--red", hex: "#DC2626", bg: "bg-red", text: "text-white" },
  ];

  const contrastPairs = [
    { pair: "Ink (#101828) on White (#FFFFFF)", ratio: "17.75:1", standard: "Passes AAA (> 7.0:1)", usage: "Headings & main body text" },
    { pair: "White (#FFFFFF) on Navy-Deep (#031047)", ratio: "17.96:1", standard: "Passes AAA (> 7.0:1)", usage: "Footer & sidebar text" },
    { pair: "White (#FFFFFF) on Navy (#0B1F4B)", ratio: "16.01:1", standard: "Passes AAA (> 7.0:1)", usage: "Secondary button & badges" },
    { pair: "Navy-Deep (#031047) on Orange (#FF7F0E)", ratio: "7.10:1", standard: "Passes AAA (> 7.0:1)", usage: "High-contrast text on orange" },
    { pair: "Navy (#0B1F4B) on Orange (#FF7F0E)", ratio: "6.32:1", standard: "Passes AA (> 4.5:1)", usage: "Subheadings on orange banners" },
    { pair: "Blue (#1F5BDB) on White (#FFFFFF)", ratio: "5.87:1", standard: "Passes AA (> 4.5:1)", usage: "Links & interactive anchors" },
    { pair: "Muted (#5B6478) on White (#FFFFFF)", ratio: "5.93:1", standard: "Passes AA (> 4.5:1)", usage: "Secondary labels & metadata" },
    { pair: "White (#FFFFFF) on Orange-Strong (#E56A00)", ratio: "3.28:1", standard: "Passes AA Large (> 3.0:1)", usage: "Primary CTA bold buttons" },
  ];

  return (
    <div className="py-12 bg-bg min-h-screen">
      <Container className="space-y-16">
        {/* Title Header */}
        <div className="border-b border-line pb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-tint text-orange-strong font-bold text-xs">
            <span>Guide Officiel</span>
            <span>•</span>
            <span>Design System v1.0</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-black text-ink tracking-tight">
            Faro School <Highlight>Design System</Highlight>
          </h1>
          <p className="text-base text-muted-faro max-w-2xl leading-relaxed">
            Infrastructure de style, jetons de design, typographie, composants réutilisables et
            conformité d&apos;accessibilité WCAG 2.1 pour Faro School.
          </p>
        </div>

        {/* 1. Brand Logos */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-bold text-ink">1. Identité & Logos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-line bg-surface p-8 shadow-card flex flex-col items-center justify-center space-y-4">
              <span className="text-xs font-bold text-muted-faro uppercase tracking-wider">
                Variant &ldquo;on-light&rdquo; (Surfaces claires, Header)
              </span>
              <div className="p-6 bg-white rounded-xl border border-line shadow-subtle flex items-center justify-center w-full">
                <Logo variant="on-light" width={220} height={60} priority />
              </div>
            </div>

            <div className="rounded-2xl border border-navy-deep bg-navy-deep p-8 shadow-card flex flex-col items-center justify-center space-y-4">
              <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
                Variant &ldquo;on-dark&rdquo; (Surfaces sombres, Footer, Sidebar)
              </span>
              <div className="p-6 bg-navy-deep rounded-xl border border-white/10 flex items-center justify-center w-full">
                <Logo variant="on-dark" width={220} height={60} priority />
              </div>
            </div>
          </div>
        </section>

        {/* 2. Color Palette */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-bold text-ink">2. Palette de Couleurs & Jetons</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {colors.map((c) => (
              <div key={c.token} className="rounded-xl border border-line bg-surface p-3 shadow-subtle flex flex-col space-y-2">
                <div className={`h-16 w-full rounded-lg ${c.bg} flex items-center justify-center shadow-inner`}>
                  <span className={`text-[10px] font-bold ${c.text}`}>{c.hex}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-ink truncate">{c.name}</p>
                  <code className="text-[10px] text-muted-faro block font-mono truncate">{c.token}</code>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Typography */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-bold text-ink">3. Typographie (Poppins & Inter)</h2>
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-subtle space-y-6">
            <div className="space-y-2 border-b border-line pb-6">
              <span className="text-xs font-mono text-muted-faro uppercase">Heading H1 — Poppins 700 / 600</span>
              <h1 className="font-heading text-4xl sm:text-5xl font-bold text-ink tracking-tight">
                L&apos;éducation qui <Highlight>propulse</Highlight> votre avenir en Haïti
              </h1>
            </div>

            <div className="space-y-2 border-b border-line pb-6">
              <span className="text-xs font-mono text-muted-faro uppercase">Heading H2 — Poppins 700</span>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ink">
                Des formations conçues pour le marché du travail
              </h2>
            </div>

            <div className="space-y-2 border-b border-line pb-6">
              <span className="text-xs font-mono text-muted-faro uppercase">Heading H3 — Poppins 600</span>
              <h3 className="font-heading text-xl font-semibold text-ink">
                Paiement instantané par MonCash et NatCash
              </h3>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono text-muted-faro uppercase">Body & UI — Inter 400 / 500 / 600</span>
              <p className="font-sans text-base text-ink leading-relaxed max-w-2xl">
                Accédez à des cours pratiques enregistrés avec soin, suivez votre progression à votre propre rythme
                et téléchargez votre certificat de réussite reconnu.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Buttons */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-bold text-ink">4. Boutons & Actions</h2>
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-subtle space-y-8">
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary" size="lg">
                Commencer maintenant
              </Button>
              <Button variant="primary" size="default">
                Acheter la formation
              </Button>
              <Button variant="secondary" size="default">
                Mon compte
              </Button>
              <Button variant="outline" size="default">
                Se connecter
              </Button>
              <Button variant="ghost" size="default">
                En savoir plus
              </Button>
              <Button variant="link" size="default">
                Consulter les CGU
              </Button>
              <Button variant="destructive" size="default">
                Supprimer
              </Button>
              <Button variant="primary" size="icon" aria-label="Cart">
                <ShoppingCart className="w-5 h-5" />
              </Button>
            </div>

            <div className="pt-4 border-t border-line">
              <p className="text-xs text-muted-faro">
                Tous les boutons interactifs respectent une hauteur tactile minimale de <strong>44px</strong> sur mobile
                et disposent d&apos;un rayon de courbure standard de <strong>12px</strong> (<code>rounded-xl</code>).
              </p>
            </div>
          </div>
        </section>

        {/* 5. Inputs & Forms */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-bold text-ink">5. Champs de Saisie (Inputs)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-subtle">
              <Input
                label="Nom complet"
                placeholder="Jean-Baptiste Pierre"
                hint="Votre nom officiel pour le certificat"
              />
            </div>
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-subtle">
              <Input
                label="Numéro MonCash"
                defaultValue="50937123456"
                hint="Format 8 ou 11 chiffres"
              />
            </div>
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-subtle">
              <Input
                label="Adresse email"
                defaultValue="jean.invalid"
                error="Adresse email invalide"
              />
            </div>
          </div>
        </section>

        {/* 6. Pills & Tags */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-bold text-ink">6. Badges, Pilules & Statuts</h2>
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-subtle flex flex-wrap items-center gap-3">
            <Pill variant="orange">Populaire</Pill>
            <Pill variant="orange">Nouveau</Pill>
            <Pill variant="navy">Business</Pill>
            <Pill variant="navy">Technologie</Pill>
            <Pill variant="blue">Débutant</Pill>
            <Pill variant="neutral">Intermédiaire</Pill>
            <Pill variant="success">Validé</Pill>
            <Pill variant="danger">Échoué</Pill>
          </div>
        </section>

        {/* 7. StatItems with Dividers */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-bold text-ink">7. Éléments Statistiques (StatItem)</h2>
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-card">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
              <StatItem
                icon={<Users className="w-6 h-6" />}
                value="+5 000"
                label="Élèves inscrits en Haïti"
              />
              <StatItem
                icon={<BookOpen className="w-6 h-6" />}
                value="12"
                label="Formations professionnelles"
              />
              <StatItem
                icon={<Award className="w-6 h-6" />}
                value="98%"
                label="Taux de satisfaction"
              />
            </div>
          </div>
        </section>

        {/* 8. Progress Bar */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-bold text-ink">8. Barre de Progression (ProgressBar)</h2>
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-subtle space-y-6 max-w-xl">
            <ProgressBar value={35} showLabel />
            <ProgressBar value={75} showLabel />
            <ProgressBar value={100} showLabel />
          </div>
        </section>

        {/* 9. Course Card Preview */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-bold text-ink">9. Carte de Formation (CourseCard)</h2>
          <div className="max-w-sm">
            <CourseCard course={sampleCourse} />
          </div>
        </section>

        {/* 10. Table with Status Pills */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-bold text-ink">10. Tableau de Données (Table)</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead>
                <TableHead>Formation</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold">Jean Baptiste</TableCell>
                <TableCell>Marketing Digital</TableCell>
                <TableCell>
                  <Pill variant="neutral" className="text-[11px] py-0.5">MonCash</Pill>
                </TableCell>
                <TableCell className="font-bold text-ink">2 500 HTG</TableCell>
                <TableCell>
                  <Pill variant="success" className="text-[11px] py-0.5">Validé</Pill>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Marie Lourdes</TableCell>
                <TableCell>Comptabilité Pratique</TableCell>
                <TableCell>
                  <Pill variant="neutral" className="text-[11px] py-0.5">NatCash</Pill>
                </TableCell>
                <TableCell className="font-bold text-ink">3 000 HTG</TableCell>
                <TableCell>
                  <Pill variant="orange" className="text-[11px] py-0.5">En attente</Pill>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        {/* 11. WCAG Contrast Compliance Table */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-bold text-ink">11. Mesures d&apos;Accessibilité WCAG 2.1</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Combinaison Couleur</TableHead>
                <TableHead>Ratio Mesuré</TableHead>
                <TableHead>Standard WCAG</TableHead>
                <TableHead>Cas d&apos;Usage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contrastPairs.map((cp) => (
                <TableRow key={cp.pair}>
                  <TableCell className="font-medium text-xs font-mono">{cp.pair}</TableCell>
                  <TableCell className="font-bold text-xs text-orange-strong font-mono">{cp.ratio}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ok">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{cp.standard}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-faro">{cp.usage}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </Container>
    </div>
  );
}

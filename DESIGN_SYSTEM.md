# Faro School — Design System (v1.0)

> **RÈGLE PRIMORDIALE** : Tout développeur ou agent effectuant une tâche de design, d'intégration UI ou de retouche visuelle sur Faro School **DOIT LIRE CE DOCUMENT EN PREMIER**.
> **RÈGLE DES COULEURS** : Il est strictement **interdit** d'écrire des codes hexadécimaux en dur (`#FF7F0E`, `#031047`, etc.) dans les composants TSX/JSX. Utilisez exclusivement les classes sémantiques de Tailwind (`bg-orange`, `text-ink`, `bg-navy-deep`, etc.) reliées aux jetons CSS.

---

## 1. Identité de Marque & Histoire

- **Nom de la marque** : **Faro School** (« Faro » = Phare en créole / espagnol : la lumière qui guide, le repère sur le chemin de la réussite professionnelle).
- **Mission** : Offrir aux jeunes, professionnels et entrepreneurs en Haïti une éducation pratique de premier plan, accessible sur smartphone et payable nativement via **MonCash** et **NatCash** en Gourdes (HTG).
- **Tonalité (Voice & Tone)** : Confiante, dynamique, chaleureuse, accessible et digne de confiance. Le tutoiement (« tu ») est privilégié dans les communications marketing et les accroches de la landing page pour encourager l'action et créer un lien de proximité fraternel.

---

## 2. Source de Vérité Visuelle & Règle des Maquettes

Les maquettes officielles Faro School (`mockup-desktop.jpg` et `mockup-mobile.png`) situées dans `public/brand/` constituent la **source de vérité visuelle absolue**.

> **Règle de préséance** : Toute divergence visuelle constatée entre une ancienne implémentation neutre et les maquettes officielles est systématiquement résolue en faveur du style des maquettes Faro School.

---

## 3. Logos & Actifs Graphiques

Les logos officiels de Faro School sont stockés dans `public/brand/` et ne doivent en aucun cas être redessinés, recolorés ou déformés :

- `public/brand/logo-on-light.png` : Version avec lettrage marine pour surfaces blanches/claires (ex: Header sticky, bannières claires).
- `public/brand/logo-on-dark.png` : Version avec lettrage blanc pour surfaces marines/sombres (ex: Footer, Sidebar Admin, bannières hero).
- `public/favicon.ico` et `public/favicon.png` : Icône de favori (32x32) sur fond marine `#031047`.
- `public/apple-touch-icon.png` : Icône pour appareils iOS (180x180) sur fond marine `#031047`.
- `public/og-image.png` : Image Open Graph (1200x630) pour le partage sur réseaux sociaux (toque + FARO SCHOOL sur fond `#031047`).

### Composant `<Logo />`
Disponible via `@/components/brand/Logo` ou `@/components` :
```tsx
import { Logo } from "@/components/brand/Logo";

<Logo variant="on-light" width={160} height={44} />
<Logo variant="on-dark" width={160} height={44} />
```

---

## 4. Jetons de Couleurs (Design Tokens)

Toutes les couleurs sont définies dans `src/styles/tokens.css` et mappées dans `tailwind.config.ts` :

| Nom du Jeton | Variable CSS | Code Hex | Classe Tailwind | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Navy Deep** | `--navy-deep` | `#031047` | `bg-navy-deep`, `text-navy-deep` | Footer, Sidebar persistante admin, fonds d'accentuation sombres |
| **Navy** | `--navy` | `#0B1F4B` | `bg-navy`, `text-navy`, `border-navy` | Boutons secondaires, contours, badges sombres |
| **Orange** | `--orange` | `#FF7F0E` | `bg-orange`, `text-orange`, `border-orange` | Couleur primaire d'action, CTA, panier, jauges de progression |
| **Orange Strong** | `--orange-strong` | `#E56A00` | `bg-orange-strong`, `text-orange-strong` | Survol hover des boutons, texte sur fond clair accessible AA |
| **Orange Tint** | `--orange-tint` | `#FFF5EB` | `bg-orange-tint`, `text-orange-tint` | Fonds de badges actifs, highlights, pilules "Populaire" |
| **Blue** | `--blue` | `#1F5BDB` | `bg-blue`, `text-blue` | Liens hypertextes interactifs, alertes informatives |
| **Blue Tint** | `--blue-tint` | `#EFF4FE` | `bg-blue-tint` | Fonds de badges de niveau (Débutant, etc.) |
| **Ink** | `--ink` | `#101828` | `text-ink`, `bg-ink` | Titres principaux (H1-H4), corps de texte sur fond clair |
| **Muted** | `--muted` | `#5B6478` | `text-muted-faro` | Sous-titres, libellés d'icônes, métadonnées des cours |
| **Line** | `--line` | `#E2E8F0` | `border-line` | Bordures de cartes, séparateurs, contours de champs |
| **Bg** | `--bg` | `#F8FAFC` | `bg-bg` | Fond global d'arrière-plan de l'application |
| **Surface** | `--surface` | `#FFFFFF` | `bg-surface` | Fond blanc pur des cartes, modales et formulaires |
| **Success Ok** | `--ok` | `#16A34A` | `text-ok`, `bg-ok` | Paiements validés, icônes de complétion, réussite |
| **Success Tint** | `--ok-tint` | `#F0FDF4` | `bg-ok-tint` | Fond des badges de succès |
| **Destructive Red** | `--red` | `#DC2626` | `text-red`, `bg-red`, `border-red` | Erreurs de formulaire, statuts de paiement rejetés |
| **Red Tint** | `--red-tint` | `#FEF2F2` | `bg-red-tint` | Fond des bannières d'erreur |

---

## 5. Typographie & Fontes

- **Titres & Boutons** : **Poppins** (graisses 600 SemiBold, 700 Bold, et 600 Italic pour les mises en valeur). Variable CSS `--font-heading`, classe `font-heading`.
- **Corps de texte & Interface** : **Inter** (graisses 400 Regular, 500 Medium, 600 SemiBold). Variable CSS `--font-sans`, classe `font-sans`.
- **Composant `<Highlight>`** : Affiche les mots-clés signature en italique Poppins orange :
  ```tsx
  import { Highlight } from "@/components/brand/Highlight";

  <h1>L'éducation qui <Highlight>propulse</Highlight> votre avenir</h1>
  ```

---

## 6. Composants Partagés & Règles UI

### 1. Bouton (`<Button />`)
- **Primary** : `bg-orange hover:bg-orange-strong text-white font-heading font-semibold rounded-xl shadow-orange`. Min-height 44px sur mobile.
- **Secondary** : `bg-navy hover:bg-navy-deep text-white font-heading font-semibold rounded-xl`.
- **Outline** : `border-2 border-navy text-navy hover:bg-navy/5 font-heading font-semibold rounded-xl`.
- **Ghost** : `text-navy hover:bg-navy/5`.
- **Link** : `text-blue hover:underline font-sans`.
- **Icon** : Bouton carré 44x44px `rounded-xl`.

### 2. Badges & Pilules (`<Pill />` / `<Tag />` / `<Badge />`)
- Entièrement arrondis : `rounded-full px-3 py-1 text-xs font-semibold`.
- Variantes : `orange` (Populaire, Nouveau), `navy` (Catégories Business, Tech), `blue` (Niveaux), `success` (Validé), `danger` (Échoué).

### 3. Champs de Saisie (`<Input />`)
- Rayon de courbure : `rounded-xl` (12px).
- Bordure nette : 1.5px (`border-[1.5px] border-line`).
- État focus : anneau orange discret (`focus-visible:border-orange focus-visible:ring-orange/20`).
- Libellé toujours positionné au-dessus (`label`).
- État d'erreur avec icône d'alerte rouge et message descriptif en dessous.

### 4. Carte de Formation (`<CourseCard />`)
- Format d'image : 16:9 (`aspect-video`) avec zoom fluide au survol.
- Badge catégorie en superposition en bas à gauche de la vignette.
- Badge « Populaire » en superposition en haut à droite si le cours est plébiscité.
- Titre : limité à 2 lignes (`line-clamp-2`), en gras Poppins.
- Rangée métadonnées : icônes épurées (livre pour modules, horloge pour durée).
- Étoiles de notation : 5 étoiles dorées/orange avec moyenne numérique et nombre d'avis.
- Pied de carte : grand prix en Gourdes (`HTG`) avec prix barré comparatif, et bouton d'action carré orange avec icône caddie redirigeant directement vers `/checkout/[slug]`.

### 5. En-tête Global (`<SiteHeader />`)
- Fond blanc pur semi-transparent avec flou d'arrière-plan (`bg-surface/95 backdrop-blur`).
- Logo variant `on-light`.
- Liens de navigation avec soulignement orange animé sous l'onglet actif.
- Sélecteur de langue bilingue FR / KR.
- Bouton contour marine pour « Se connecter » et bouton plein orange pour « S'inscrire ».

### 6. Pied de Page Global (`<SiteFooter />`)
- Fond bleu marine profond (`bg-navy-deep #031047`).
- Logo variant `on-dark`.
- Typographie blanche contrastée et textes secondaires à opacité 70%.
- Liens vers les réseaux sociaux (Facebook, Instagram, WhatsApp, YouTube, TikTok).
- Mention fière en bas de page : `🇭🇹 Fait en Haïti avec fierté`.

### 7. Barre Latérale Admin / Espace Étudiant (`<DashboardShell />`)
- Sidebar en bleu marine profond (`bg-navy-deep`), active item souligné d'une bordure gauche orange de 4px avec fond blanc translucide 12%.
- Tiroir rétractable moderne sur écrans mobiles.

### 8. Barre de Progression (`<ProgressBar />`)
- Rayon circulaire complet (`rounded-full`), hauteur 8px.
- Remplissage orange dynamique sur piste claire (`bg-line`).

### 9. Éléments Statistiques (`<StatItem />`)
- Chiffre imposant en gras Poppins (ex: `+5 000 élèves`).
- Icône épurée dans un carré arrondi teinté d'orange.
- Séparateurs verticaux fins entre les statistiques.

---

## 7. Conformité d'Accessibilité WCAG 2.1 (Mesures Réelles)

Toutes les combinaisons de couleurs ont été mesurées et validées conformément aux standards WCAG 2.1 :

| Combinaison | Ratio de Contraste | Statut WCAG | Justification & Usage |
| :--- | :--- | :--- | :--- |
| **Ink (`#101828`) sur Blanc (`#FFFFFF`)** | **17.75:1** | Conforme AAA (> 7.0:1) | Texte principal, titres, descriptions |
| **Blanc (`#FFFFFF`) sur Navy-Deep (`#031047`)** | **17.96:1** | Conforme AAA (> 7.0:1) | Footer, Sidebar admin, bannières |
| **Blanc (`#FFFFFF`) sur Navy (`#0B1F4B`)** | **16.01:1** | Conforme AAA (> 7.0:1) | Boutons secondaires, badges sombres |
| **Navy-Deep (`#031047`) sur Orange (`#FF7F0E`)** | **7.10:1** | Conforme AAA (> 7.0:1) | Textes haute lisibilité sur fond orange |
| **Navy (`#0B1F4B`) sur Orange (`#FF7F0E`)** | **6.32:1** | Conforme AA (> 4.5:1) | Badges et titres sur bannières orangées |
| **Blue (`#1F5BDB`) sur Blanc (`#FFFFFF`)** | **5.87:1** | Conforme AA (> 4.5:1) | Liens d'action et éléments cliquables |
| **Muted (`#5B6478`) sur Blanc (`#FFFFFF`)** | **5.93:1** | Conforme AA (> 4.5:1) | Métadonnées, labels secondaires, icônes |
| **Blanc (`#FFFFFF`) sur Orange-Strong (`#E56A00`)** | **3.28:1** | Conforme AA Large (> 3.0:1) | Gros boutons CTA primaires (texte en gras $\ge$ 16px) |

---

## 8. Page de Prévisualisation

Une page de démonstration interactive de tous les composants et jetons est disponible en environnement de développement à l'adresse suivante :
`/[locale]/design-system` (désactivée en production via `process.env.NODE_ENV === "production"`).

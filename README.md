# Faro School — Base Infrastructure

Plateforme de formation vidéo en ligne pour Haïti.
Bilingue Français (`fr`) et Créole Haïtien (`ht`, affiché « KR »).
Paiements en Gourdes Haïtiennes (HTG) via MonCash et NatCash.

---

## 1. Quick Start

### Prérequis
- Node.js 20+ ou 24+
- `pnpm` (v10 ou v11)
- Compte Supabase
- Compte Bunny.net (Bunny Stream + Storage)
- Compte Cloudflare (pour le déploiement Workers)

### Commandes d'installation et de démarrage
```bash
# 1. Cloner et installer les dépendances
pnpm install

# 2. Configurer les variables d'environnement
cp .env.example .env.local

# 3. Démarrer le serveur de développement local
pnpm dev
```
L'application démarre sur `http://localhost:3000/fr`.

---

## 2. Base de données Supabase (Migrations & Seed)

### Appliquer la migration SQL
Dans votre projet Supabase (ou localement avec Supabase CLI) :
1. Ouvrez le **SQL Editor** de Supabase.
2. Exécutez le script contenu dans `supabase/migrations/20250101000000_initial_schema.sql`.
   - Crée les 14 tables avec Row Level Security (RLS).
   - Crée le déclencheur `on_auth_user_created` (synchronisation profil).
   - Crée le déclencheur `on_payment_status_validated` (inscription automatique et passage de la commande à `paid`).

### Charger les données de test (Seed)
1. Dans le **SQL Editor** de Supabase, exécutez `supabase/seed.sql`.
2. Cela insère 6 formations publiées avec 3 modules et des leçons complètes :
   - *Marketing Digital pour Entreprises en Haïti*
   - *Excel pour Entreprise : de Zéro à Avancé*
   - *Comptabilité Pratique pour PME et Indépendants*
   - *Créer du Contenu Vidéo avec son Smartphone*
   - *Lancer et Gérer son Entreprise en Haïti*
   - *Anglais des Affaires pour Professionnels*

---

## 3. Configuration Manuelle Obligatoire sur Bunny.net

Voici la liste exacte de toutes les étapes à réaliser manuellement dans votre console **Bunny.net** :

### A. Configuration Bunny Stream (Protection des vidéos de cours)
1. **Créer une Vidéo Library** :
   - Allez dans **Stream** > **Add Video Library** (ex: `faro-courses`).
   - Notez le `Library ID` et l'**API Key** (située dans les paramètres de la bibliothèque).
2. **Activer MediaCage DRM** :
   - Dans votre Video Library, allez dans **Security & DRM**.
   - Activez l'option **MediaCage DRM** (chiffrement dynamique des segments HLS).
3. **Activer l'Authentification par Jeton (Token Authentication)** :
   - Dans **Security** > **Token Authentication**, activez le commutateur.
   - Copiez la **Token Authentication Key** et collez-la dans `BUNNY_STREAM_TOKEN_AUTH_KEY`.
   - Réglez le format de token sur **Path-style tokens** pour les flux HLS (`playlist.m3u8`).
   - L'application génère des jetons avec une expiration inférieure à 2 heures (par défaut 3600 secondes).
4. **Limiter les Domaines Autorisés (Allowed Domains / Referrers)** :
   - Dans **Security** > **Allowed Referrers**, ajoutez :
     - `faroschool.com` (domaine de production)
     - `*.workers.dev` (domaines de preview Cloudflare)
     - `localhost:3000` (développement local)
   - Activez l'interdiction d'accès pour les requêtes sans Referrer correspondant.
5. **Désactiver l'accès direct aux fichiers originaux et MP4 Fallback** :
   - Dans **Encoding Settings** / **Player** :
     - Désactivez **MP4 Fallback**.
     - Désactivez **Allow Original Video Download** (bloquer l'accès URL direct au fichier source).

### B. Configuration Bunny Storage & CDN (Images et ressources téléchargeables)
1. **Créer un Storage Zone** :
   - Allez dans **Storage** > **Add Storage Zone** (ex: `faro-storage`).
   - Connectez-le à un **Pull Zone** CDN dédié (ex: `cdn.faroschool.com`).
2. **Protection des ressources élèves (Token Authentication)** :
   - Dans les paramètres de la Pull Zone liée, activez **Token Authentication**.
   - Notez la clé secrète dans `BUNNY_STORAGE_TOKEN_KEY`.
   - Seuls les élèves inscrits recevront une URL signée temporaire pour télécharger les exercices et PDF.

---

## 4. Passerelle de Paiement Kobara (MonCash & NatCash)

L'intégration des paiements est unifiée via **Kobara.app** (`https://docs.kobara.app/docs/quickstart`).

### Fonctionnement des boutons MonCash & NatCash
- Le bouton **Payer avec MonCash** envoie `provider: "moncash"` à l'API Kobara et redirige instantanément l'étudiant vers l'écran de paiement MonCash.
- Le bouton **Payer avec NatCash** envoie `provider: "natcash"` à l'API Kobara et redirige instantanément l'étudiant vers l'écran de paiement NatCash.

### Mode Démo Local (`APP_MODE=demo`)
Les simulateurs et fixtures locales sont accessibles **uniquement** en environnement de développement lorsque `APP_MODE=demo` est explicitement défini dans `.env.local` et que `NODE_ENV !== 'production'`.

En production :
- Le système applique le principe **Fail Closed** : toute clé manquante (`KOBARA_SECRET_KEY`, `KOBARA_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `CRON_SECRET`) refuse immédiatement l'opération et consigne une erreur serveur explicite.
- Aucun paiement ne peut être validé par un paramètre d'URL de retour (`/return`). La validation des paiements s'effectue exclusivement par webhook serveur sécurisé (signature HMAC SHA-256 avec vérification de l'horodatage sous 5 minutes) via la fonction transactionnelle PostgreSQL `validate_payment_transactional` avec verrouillage de ligne `FOR UPDATE`.
- Le démarrage en production lève une exception bloquante si `APP_MODE=demo` est détecté.

### Webhooks en production
Sur votre tableau de bord **Kobara.app** :
- **URL du webhook** : `https://votre-domaine.com/api/webhooks/kobara`
- **Événements écoutés** : `payment.succeeded`
- **En-têtes requis** : `x-kobara-signature` et `x-kobara-timestamp`
- **Secret de signature** : configuré dans `KOBARA_WEBHOOK_SECRET`

---

## 5. Règle des 2 Appareils Actifs (Device Session Limit)
La table `playback_sessions` limite chaque compte étudiant à **2 appareils actifs simultanés**.
Lors d'une 3ème connexion, la fonction `registerDeviceSession` termine automatiquement la session la plus ancienne (`ended_at = NOW()`), garantissant l'intégrité des accès.

---

## 6. Variables d'Environnement Obligatoires en Production

| Variable | Description & Rôle |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de votre instance Supabase de production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique anonyme Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé secrète d'administration Supabase (`server-only`) |
| `KOBARA_SECRET_KEY` | Clé secrète de l'API Kobara (`kobara_sk_live_...`) |
| `KOBARA_WEBHOOK_SECRET` | Secret HMAC de signature des webhooks Kobara |
| `ANTHROPIC_API_KEY` | Clé d'API Claude (Anthropic) pour l'assistant pédagogique |
| `CRON_SECRET` | Jeton secret de déclenchement des tâches planifiées cron |
| `BUNNY_API_KEY` | Clé de gestion Bunny.net |
| `BUNNY_STREAM_API_KEY` | Clé d'administration Bunny Stream |
| `BUNNY_STREAM_TOKEN_AUTH_KEY` | Clé de signature des jetons de lecture vidéo HLS |
| `BUNNY_STORAGE_ACCESS_KEY` | Clé d'accès au stockage Bunny Storage |
| `BUNNY_STORAGE_TOKEN_KEY` | Clé de signature des URL de téléchargement des ressources |

---

## 7. Scripts de Build, Audit de Sécurité et Déploiement

```bash
# Vérification globale de sécurité et tests d'intégrité (Recommandé avant chaque déploiement)
pnpm verify

# Vérification TypeScript stricte
pnpm typecheck

# Exécution de l'audit complet de sécurité (66 assertions de sécurité et RLS)
pnpm audit

# Exécution des tests de base de données et RLS
pnpm test:db

# Exécution de la suite de tests complète
pnpm test

# Linting ESLint
pnpm lint

# Build de l'application Next.js
pnpm build

# Build OpenNext Cloudflare Adapter
pnpm build:worker

# Prévisualisation locale avec wrangler
pnpm preview

# Déploiement sur Cloudflare Workers
pnpm deploy
```

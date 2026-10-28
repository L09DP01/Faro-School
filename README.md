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

### Mode MOCK pour le développement
Lorsque `KOBARA_SECRET_KEY` est vide ou commence par `mock_` dans `.env.local` :
1. Cliquer sur l'un des boutons de paiement génère une URL pointant vers le simulateur Kobara `/api/payments/kobara/mock-gate`.
2. Le simulateur affiche l'interface fidèle Kobara avec l'onglet du mode choisi (MonCash ou NatCash).
3. Cliquez sur **Valider le paiement** : la redirection vers `/api/payments/kobara/return` valide le paiement.
4. Le déclencheur Postgres `on_payment_status_validated` inscrit instantanément l'étudiant et passe la commande en `paid` !

### Webhooks en production
En production, configurez votre URL de webhook sur votre dashboard Kobara :
- URL : `https://votre-domaine.com/api/webhooks/kobara`
- Événement : `payment.succeeded`
- Signature : vérification HMAC SHA-256 via `x-kobara-signature` et `KOBARA_WEBHOOK_SECRET`.

---

## 5. Règle des 2 Appareils Actifs (Device Session Limit)
La table `playback_sessions` limite chaque compte étudiant à **2 appareils actifs simultanés**.
Lors d'une 3ème connexion, la fonction `registerDeviceSession` termine automatiquement la session la plus ancienne (`ended_at = NOW()`), garantissant l'intégrité des accès.

---

## 6. Scripts de Build et Déploiement Cloudflare Workers

```bash
# Vérification TypeScript stricte
pnpm typecheck

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

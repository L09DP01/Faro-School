# Journal des Correctifs de Sécurité (SECURITY_FIXES.md)

Ce document répertorie chronologiquement les vulnérabilités auditées, les correctifs appliqués, les preuves de vérification et la table des privilèges de base de données.

---

## STEP S1-A: Identité, Sessions et Contrôle d'Accès

### Ce qui n'allait pas (Vulnérabilités critiques)
1. **Contournement d'identité par cookie non signé (`faro_session`)** :
   - `src/lib/auth/get-user.ts` et `src/middleware.ts` décodaient un cookie Base64 `faro_session` et accordaient aveuglément l'identifiant `id` et le rôle `role` sans aucune validation cryptographique ni vérification auprès de Supabase Auth. Un attaquant pouvait forger `{"role": "admin"}` et s'octroyer des privilèges administrateur complets.
2. **Identifiants de démonstration codés en dur avec mots de passe fixes** :
   - `src/app/api/auth/login/route.ts` acceptait des mots de passe codés en dur (`Admin123!`, `Student123!`, `Instructor123!`) et générait un cookie `faro_session` sans vérifier le hash de mot de passe en base de données.
3. **Absence de protection `server-only` sur le client privilégié** :
   - `src/lib/supabase/admin.ts` n'était pas balisé `server-only` et basculait sur la clé anonyme publique si `SUPABASE_SERVICE_ROLE_KEY` était absent au lieu d'échouer immédiatement.
4. **Mise en cache du rôle** :
   - Le rôle n'était pas garanti vérifié depuis la table `profiles` sur chaque requête protégée.

### Ce qui a été modifié
1. **Suppression définitive de `faro_session`** :
   - Dans `src/lib/auth/get-user.ts` et `src/middleware.ts`, suppression intégrale de tout chemin de code lisant ou décodant `faro_session`.
   - L'unique source d'identité est désormais la session Supabase Auth vérifiée côté serveur via `supabase.auth.getUser()` (qui valide cryptographiquement le jeton JWT auprès du serveur d'authentification).
   - Le rôle est systématiquement lu depuis `profiles.role` pour le `user.id` vérifié et mémorisé uniquement pour la durée de la requête via `React.cache()`.
2. **Suppression des comptes de démonstration en dur dans la route de connexion** :
   - Dans `src/app/api/auth/login/route.ts`, suppression de tous les comptes de test et mots de passe codés en dur. Toute authentification passe obligatoirement par `supabase.auth.signInWithPassword()`.
   - Dans `src/app/api/auth/signup/route.ts`, suppression du repli qui créait une fausse session en cas d'échec d'inscription.
   - Dans `src/app/api/auth/signout/route.ts`, suppression du cookie résiduel.
3. **Protection `server-only` et principe "Fail Closed"** :
   - Ajout de `import "server-only";` dans `src/lib/supabase/admin.ts` et `src/lib/auth/get-user.ts`.
   - `createAdminClient()` lève une exception bloquante si `SUPABASE_SERVICE_ROLE_KEY` ou `NEXT_PUBLIC_SUPABASE_URL` est manquant en production.
   - Création de `isDemoMode()` dans `src/lib/config/index.ts` avec interdiction bloquante (`throw Error`) si `APP_MODE=demo` est détecté en production.
4. **Ajout de `requireInstructor()`** dans `src/lib/auth/require-admin.ts` pour garantir la validation de rôle formateur côté serveur.

### Comment cela a été vérifié
- **Test automatisé (`tests/step-s1a-identity.test.ts`)** :
  1. *Cookie forgé* : injection d'un cookie `faro_session` contenant `role: "admin"` -> `getCurrentUser()` renvoie strictement `null` (accès refusé).
  2. *Mots de passe fixes* : tentative de connexion avec `admin@faroschool.com` / `Admin123!` -> rejet avec statut HTTP 400/401 (`invalidCredentials`), aucun cookie de session délivré.
  3. *Actions protégées* : appels non authentifiés à `createInstructorAction` et `deleteReportedMessageAction` -> rejet immédiat avec refus d'accès.
- **Typecheck** : `tsc --noEmit` validé avec code 0.

---

## STEP S1-B: Rôles en Base de Données et Privilèges SQL

### Ce qui n'allait pas (Vulnérabilités critiques)
1. **Élévation de privilèges à l'inscription** :
   - La fonction `handle_new_user()` utilisait `COALESCE(NEW.raw_user_meta_data->>'role', 'student')`. Tout utilisateur pouvait s'inscrire en spécifiant `{ role: "admin" }` dans ses métadonnées et devenir administrateur dès la création du profil.
2. **Absence de protection sur `profiles.role` lors de la mise à jour** :
   - La politique RLS `Users can update own profile` autorisait les utilisateurs authentifiés à modifier n'importe quelle colonne de leur profil sans clause de restriction sur `role`.
3. **Absence de fonction RPC sécurisée et auditée pour le changement de rôle**.
4. **Permissions par défaut de l'utilisateur anonyme (`anon`)** : risque d'écriture non désirée si RLS n'était pas activé sur une nouvelle table.

### Ce qui a été modifié
1. **Nouvelle migration `supabase/migrations/20250118000000_role_security_and_privilege_guards.sql`** :
   - Redéfinition de `handle_new_user()` : le rôle attribué est **toujours** `'student'` de façon inconditionnelle. La valeur `raw_user_meta_data->>'role'` est strictement ignorée. Les champs `full_name` et `phone` sont nettoyés et limités en longueur.
   - Création du trigger `trg_protect_profile_privileged_fields` (BEFORE UPDATE sur `profiles`) : lève une exception SQL (`RAISE EXCEPTION`) immédiate si `role`, `banned_at` ou `muted_until` est altéré par un utilisateur non-administrateur.
   - Révocation formelle de la permission de mise à jour sur la colonne `role` : `REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;`.
   - Durcissement de la politique RLS avec clause `WITH CHECK` interdisant toute modification de `role`.
   - Création de la fonction RPC `public.set_user_role(target_user_id UUID, new_role TEXT)` : exclusivement exécutable par les administrateurs (`SECURITY DEFINER`), validant le nouveau rôle et consignant chaque changement dans `admin_audit_logs`.
   - Révocation formelle de tout droit d'écriture pour le rôle `anon` sur l'ensemble du schéma `public` : `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;`.
   - Révocation de `TRUNCATE` pour `authenticated` et verrouillage en écriture directe sur les tables d'audit et de configuration (`admin_audit_logs`, `coupons`, `ai_usage`, `platform_settings`).
2. **Ajout de la commande de test d'intégration `pnpm test:db`** dans `package.json` (`tests/db-roles-and-rls.test.ts`).

### Table des Grants et Politiques RLS du Schéma Public

| Table | Rôle `anon` | Rôle `authenticated` | Contrôle d'accès & Politiques RLS |
| :--- | :--- | :--- | :--- |
| `profiles` | SELECT (public info) | SELECT (own), UPDATE (own, colonnes sûres) | RLS : UPDATE sur `role` révoqué; trigger bloquant si non-admin |
| `courses` | SELECT (publiés) | SELECT (publiés + own formateur) | RLS : écriture réservée admin & formateur assigné |
| `modules` | SELECT | SELECT | RLS : écriture réservée formateur du cours & admin |
| `lessons` | SELECT (aperçus) | SELECT (selon inscription) | RLS : accès restreint aux inscrits |
| `lesson_resources` | Aucun | SELECT (selon inscription) | RLS : réservé aux apprenants inscrits |
| `coupons` | Aucun | SELECT (validation) | RLS : écritures directes révoquées; admin RPC |
| `enrollments` | Aucun | SELECT (own enrollments) | RLS : insertion automatique par validation paiement |
| `lesson_progress` | Aucun | SELECT, INSERT, UPDATE (own) | RLS : l'utilisateur ne peut modifier que sa progression |
| `orders` | Aucun | SELECT, INSERT (own orders) | RLS : un élève ne peut ni lire ni modifier les commandes d'autrui |
| `payments` | Aucun | SELECT (own payments) | RLS : écriture réservée au webhook/RPC serveur |
| `certificates` | SELECT (par code) | SELECT (own) | RLS : génération automatique sur 100% de progression |
| `reviews` | SELECT | SELECT, INSERT (own) | RLS : un avis par étudiant inscrit |
| `contact_messages` | INSERT (rate limited) | INSERT | RLS : lecture et gestion réservées admin |
| `playback_sessions` | Aucun | SELECT, INSERT, UPDATE (own) | RLS : vérification limite de 2 appareils simultanés |
| `lesson_notes` | Aucun | SELECT, INSERT, UPDATE, DELETE (own) | RLS : notes personnelles isolées par utilisateur |
| `admin_audit_logs` | Aucun | Aucun (écritures directes révoquées) | RLS : SELECT admin uniquement; écritures par triggers/RPC |
| `newsletter_subscribers`| INSERT | INSERT | RLS : gestion admin |
| `instructors` | SELECT (actifs) | SELECT (actifs) | RLS : gestion admin (`instructors.manage`) |
| `community_messages` | Aucun | SELECT, INSERT (si non banni/sourdine) | RLS : modération et suppression douce |
| `community_reactions`| Aucun | SELECT, INSERT, DELETE (own) | RLS : réactions isolées par utilisateur |
| `community_reports` | Aucun | INSERT (own reports) | RLS : examen admin |
| `community_reads` | Aucun | SELECT, INSERT, UPDATE (own) | RLS : horodatage de lecture individuel |
| `community_rules_accepted` | Aucun | SELECT, INSERT (own) | RLS : acceptation unique |
| `conversations` | Aucun | SELECT (participants), INSERT | RLS : validation stricte élève <-> formateur/admin |
| `messages` | Aucun | SELECT (participants), INSERT | RLS : messages privés strictement isolés |
| `escalations` | Aucun | SELECT (staff assigné/admin) | RLS : suivi des délais de réponse |
| `ai_usage` | Aucun | Aucun (écritures directes révoquées) | RLS : suivi comptable et plafonds par instance |
| `notifications` | Aucun | SELECT, UPDATE (own) | RLS : notifications isolées par utilisateur |
| `instructor_ai_versions` | Aucun | SELECT (staff/admin) | RLS : gestion par formateur assigné |
| `platform_settings` | Aucun | Aucun (écritures directes révoquées) | RLS : lecture/écriture admin |
| `private_conversation_access_logs` | Aucun | Aucun | RLS : audit log de consultation admin |
| `moderation_flags` | Aucun | INSERT (détection serveur) | RLS : lecture et traitement admin uniquement |

### Comment cela a été vérifié
- **Test automatisé (`tests/db-roles-and-rls.test.ts` via `pnpm test:db`)** :
  1. *Validation de la migration* : vérification stricte de l'interdiction de `role` dans `handle_new_user`, de la présence du trigger `protect_profile_privileged_fields`, de la révocation de l'UPDATE de colonne `role`, et de la fonction RPC `set_user_role`.
  2. *Vérification des privilèges* : vérification de la révocation de toutes les écritures pour `anon`.
  3. Exécution avec succès de `pnpm test:db`.
- **Typecheck** : `tsc --noEmit` validé avec code 0.


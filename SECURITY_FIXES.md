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

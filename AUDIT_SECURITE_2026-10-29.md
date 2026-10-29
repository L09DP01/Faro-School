# Réaudit sécurité — Faro School

Date : 29 octobre 2026. Relecture du code local actuel, en comparaison avec l'audit précédent. Aucune migration appliquée, aucun paiement ni compte créé à distance. Ce rapport ne certifie pas les droits effectifs de la base déployée.

## Authentification réellement utilisée

Le projet utilise **Supabase Auth**, et non NextAuth.

- `package.json` dépend de `@supabase/ssr` et `@supabase/supabase-js`, sans `next-auth` ni adaptateur `@auth/*`.
- `src/app/api/auth/login/route.ts` appelle `supabase.auth.signInWithPassword`.
- `src/app/api/auth/signup/route.ts` appelle `supabase.auth.signUp`.
- `src/lib/auth/get-user.ts` vérifie l'identité par `supabase.auth.getUser()` et relit `profiles.role`.
- Le middleware utilise également Supabase Auth ; la déconnexion utilise `supabase.auth.signOut`.
- Les migrations relient les profils à `auth.users`, et les politiques utilisent `auth.uid()`.

Next.js est le framework de l'application ; sa présence ne signifie pas que NextAuth est utilisé.

## Améliorations confirmées depuis le premier audit

1. Les branches de connexion avec identifiants de démonstration ont été retirées du gestionnaire actuel.
2. Le cookie Base64 `faro_session` n'est plus accepté par le middleware ni par `getCurrentUser`.
3. Le rôle est relu en base après vérification de l'identité.
4. Le client administrateur est marqué `server-only` et exige les clés hors démo.
5. La migration 18 impose `student` à l'inscription et ajoute un trigger de protection des rôles et sanctions.
6. La route de retour du paiement ne modifie plus les statuts à partir des paramètres de redirection.
7. Le fournisseur Kobara refuse en production une configuration sans mode live, clé ou secret webhook.
8. Le webhook exige maintenant des identifiants et passe par une RPC transactionnelle.
9. Une page et un formulaire de réinitialisation du mot de passe existent ; le formulaire échange le code et met à jour le mot de passe via Supabase.
10. La gouvernance IA dispose désormais de fonctions et de données persistées, et sa sortie est validée avec Zod.

Les corrections SQL restent conditionnées à l'application effective des migrations et à leurs droits réels.

## Risques restants

### R1 — Critique : RPC de validation des paiements sans autorisation interne

Fichier : `supabase/migrations/20250119000000_transactional_payment_validation.sql`.

`validate_payment_transactional` est une fonction `SECURITY DEFINER`. Elle ne vérifie ni l'identité, ni le rôle de l'appelant, ni une preuve de paiement. Le montant attendu, l'identifiant de transaction et l'administrateur peuvent être nuls. La migration ne révoque pas son droit d'exécution à `PUBLIC`, `anon` ou `authenticated`.

Avec les droits d'exécution PostgreSQL par défaut et l'exposition du schéma, un appel direct peut contourner les contrôles de la route webhook. La RLS des tables ne suffit pas à empêcher l'action d'une fonction privilégiée. C'est un défaut confirmé dans la migration ; son exploitabilité distante dépend des ACL effectives et du schéma déployé.

Correction attendue : réserver l'exécution au rôle serveur approprié, vérifier les appelants autorisés dans la fonction et séparer la validation automatique du chemin administratif. Tester explicitement le refus pour un visiteur et un élève.

### R2 — Élevé : preuve de paiement encore incomplète dans le webhook

Fichier : `src/app/api/webhooks/kobara/route.ts`.

- Une devise absente est remplacée par `HTG`.
- Un montant absent est remplacé par celui de la commande ; une comparaison avec soi-même ne valide pas le montant reçu.
- `amount || amount_htg` traite aussi zéro comme une absence, et `Math.round` permet un arrondi avant comparaison.
- Si la transaction ne correspond pas, le choix peut retomber sur un autre paiement en attente de la commande plutôt que refuser le décalage.

La signature constitue une amélioration réelle, mais ne remplace pas la validation stricte des champs métier. Rejeter les champs manquants/invalides et exiger une correspondance transaction–commande–montant–devise.

### R3 — Élevé : gouvernance IA encore contournable ou indisponible

Fichiers : `src/lib/messaging/ai-assistant.ts`, `src/lib/admin/messaging-supervision.ts`, migration 20.

- Le chargement des paramètres utilise le client de l'utilisateur. Si les réglages ne sont pas accessibles, le moteur revient à des valeurs avec `killSwitch: false`.
- `checkAiLimits` autorise l'appel lorsque la RPC échoue, même hors mode démo.
- La sauvegarde administrative des réglages ne contrôle pas le champ `error` renvoyé par Supabase, puis met à jour un magasin local. La migration 18 retire pourtant les droits directs d'écriture sur `platform_settings` à `authenticated`.
- `check_ai_limits` lit l'usage sans réserver une consommation : plusieurs requêtes simultanées peuvent toutes passer avant l'enregistrement de leur coût.
- `record_ai_usage`, fonction privilégiée, accepte les identifiants et coûts fournis sans contrôle d'appelant ou validation de signe ; aucune restriction d'exécution explicite n'est présente dans sa migration. Des droits par défaut peuvent permettre une pollution des compteurs, voire des coûts négatifs.

Correction : lecture serveur fiable des paramètres, refus ou escalade si leur contrôle échoue, écriture privilégiée autorisée, quotas avec réservation atomique et droits stricts sur les RPC.

### R4 — Moyen : anti-rejeu du webhook partiel

Fichier : `src/lib/payments/kobara.ts`.

Le timestamp reste facultatif. Le validateur accepte aussi une signature portant seulement sur le corps, même lorsqu'un timestamp est fourni. Ce timestamp peut donc ne pas être lié à la signature. Le contrôle de cinq minutes n'est pas une garantie générale anti-rejeu.

Aligner la vérification sur le protocole exact documenté par Kobara et dédupliquer durablement les événements. Les contrôles d'idempotence existants réduisent certains effets des répétitions, sans remplacer cette vérification.

### R5 — Moyen : limiteur de requêtes local au processus

`src/lib/security/rate-limit.ts` conserve une Map en mémoire. Les limites de connexion, inscription et autres API ne sont pas partagées entre instances Workers et disparaissent avec elles.

Utiliser un compteur partagé ou une protection d'infrastructure adaptée ; vérifier les limites par compte et par IP.

### R6 — Fiabilité financière : deux chemins incrémentent le coupon

La fonction déclencheur `handle_payment_validation`, redéfinie en migration 3 et attachée par la migration initiale, incrémente `coupons.used_count` lorsque le paiement devient validé. La nouvelle RPC en migration 19 réalise aussi cette incrémentation après sa mise à jour du paiement. Aucun retrait du trigger n'est prévu dans cette nouvelle migration.

Sur une installation suivant ces migrations, un premier paiement avec coupon peut donc être compté deux fois. Désigner une seule responsabilité et tester l'ensemble des migrations, avec répétition et concurrence des événements.

### R7 — Tests : résultats positifs insuffisants pour conclure sur la base

`tests/security-audit.ts` vérifie principalement des motifs textuels. Certains contrôles peuvent réussir sur un commentaire : le contrôle annonçant `timingSafeEqual` ne prouve pas l'appel de cette API dans le fournisseur.

Le test `db-roles-and-rls.test.ts` peut terminer sans erreur si la configuration distante manque ou si la création d'utilisateur échoue. Malgré son intitulé, son scénario distant ne démontre pas une matrice complète d'isolement de deux utilisateurs.

Les tests critiques doivent échouer ou être signalés comme ignorés lorsque leur précondition manque ; vérifier les permissions réelles des RPC et les comportements avec des comptes distincts sur une base de test.

### R8 — Élevé pour l'accès aux comptes : migration des profils incohérente

La migration 18 écrit et modifie `profiles.updated_at`, mais aucune création de cette colonne sur `profiles` n'apparaît dans les migrations du dépôt. Sur une base reconstruite depuis ces fichiers, le trigger d'inscription et les mises à jour de profil risquent donc d'échouer à l'exécution. Une colonne ajoutée manuellement à distance pourrait masquer ce défaut local de reproductibilité.

Par ailleurs, `admin-instructors.ts` appelle `set_user_role` avec le client service-role ; la RPC exige un `auth.uid()` administrateur non nul. Un client service-role sans session utilisateur ne satisfait pas ce contrôle. Il faut faire correspondre le mécanisme d'appel et l'autorisation SQL, sans ouvrir cette RPC au public.

### R9 — Moyen : validation globale de l'environnement non branchée au démarrage

`src/lib/env.ts` définit `validateEnvironment` et `getEnv`, mais aucun appel depuis le reste du code applicatif examiné n'a été trouvé. La promesse d'un arrêt global du démarrage sans configuration complète n'est donc pas démontrée. Certains services, comme Kobara et le client administrateur, ont bien leurs propres contrôles locaux : cela reste distinct d'une validation globale au démarrage.

## Vérifications exécutées

- `tsc --noEmit` : code de sortie 0.
- `node --experimental-strip-types tests/security-audit.ts` : 66/66 assertions annoncées réussies, code 0.
- Relecture des routes Auth, du fournisseur et webhook Kobara, des nouvelles migrations 18–20 et des mécanismes de gouvernance IA.
- Aucun test d'exploitation distant ; aucune preuve que les nouvelles migrations sont déployées. Les résultats précédents sur le lint ou la production ne sont pas reconduits implicitement.

## Ton souhait d'utiliser NextAuth

NextAuth/Auth.js peut gérer les connexions et sessions tout en conservant PostgreSQL chez Supabase. L'adaptateur Supabase officiel dans la documentation Auth.js utilise un schéma `next_auth` distinct et ne s'interface pas avec Supabase Auth.

Pour ce projet, remplacer Supabase Auth demande donc une migration des routes, sessions, récupération de compte, identifiants, triggers liés à `auth.users` et accès RLS/Realtime. Installer `next-auth` et changer le formulaire ne suffirait pas.

Deux architectures doivent être distinguées :

1. NextAuth devient la source d'identité et Supabase conserve la base ; les liens de profils et le mécanisme de jetons/accès aux données sont adaptés.
2. NextAuth est ajouté devant Supabase Auth ; deux cycles de sessions doivent alors être coordonnés. Cette option conserve une dépendance à Supabase Auth et ne réalise pas son remplacement.

Si ton intention est bien de remplacer Supabase Auth, la première architecture correspond à cette intention. Ce réaudit n'a engagé aucune migration d'authentification.

## Verdict

L'identité applicative est nettement mieux protégée qu'au premier audit. Les anciens constats ne doivent pas être présentés comme tous inchangés. Cependant, les fonctions SQL privilégiées introduisent un risque critique et les contrôles de paiement et d'IA restent incomplets. La mise en production ne peut pas être validée sur la seule base des 66 assertions statiques.

Références :
- Supabase, fonctions et privilèges : https://supabase.com/docs/guides/database/functions
- Supabase, RLS : https://supabase.com/docs/guides/database/postgres/row-level-security
- Auth.js, adaptateur Supabase : https://authjs.dev/getting-started/adapters/supabase

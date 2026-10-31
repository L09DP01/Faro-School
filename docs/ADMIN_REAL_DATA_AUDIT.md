# Audit administration — 31 octobre 2026

Constats avant correction, établis par lecture du code :
- dashboard.ts injecte des paiements et formations fictifs si les RPC retournent une liste vide ou une erreur.
- AdminLayoutClient.tsx contient deux badges fixes de 12 et un lien Emails de diagnostic.
- InstructorMessagesClient.tsx fabrique des messages au lieu de charger la table messages : les réponses reçues sont donc invisibles.
- messaging-supervision.ts calcule ses statistiques depuis la mémoire, avec 14 minutes, 3 escalades et des jetons fixes. Les écritures de configuration ignorent les erreurs.
- La boîte admin charge toutes les conversations, alors que le support et les cours doivent être séparés.
- Le filtre personnalisé de modération dépend de la mémoire du Worker et ne fonctionne pas entre instances.
- La page paramètres administrateur est un placeholder.

Aucune lecture ou modification du Supabase distant effectuée. Les données de test locales restent réservées aux tests.

## Corrections

- Dashboard admin : suppression du générateur d’exemples et des fallbacks sur listes vides ; erreurs RPC visibles. Répartition MonCash/NatCash à 0/0 quand aucun encaissement.
- Dashboard professeur : suppression des 42 élèves, statistiques et activités fictives ; cours réels, inscriptions actives, certificats non révoqués et messages réels. Progression calculée depuis les leçons publiées et lesson_progress.completed_at ; aucune valeur aléatoire ni dénominateur arbitraire de dix leçons.
- Messages : chargement de la table messages au lieu des faux messages dans le composant personnel ; actualisation toutes les cinq secondes et au retour dans l’app. Envois refusés conservés dans le champ, messages optimistes retirés. Les libellés et réponses rapides distinguent support et cours.
- Support technique : boîte commune aux administrateurs, prise en charge par un autre admin auditée en SQL. Les professeurs voient leurs discussions de cours ; un administrateur reçoit des questions pédagogiques seulement pour ses cours. Les autres discussions restent dans la supervision avec justification enregistrée, accès lecture limité à quinze minutes.
- Notifications : trigger SQL à chaque nouveau message. Les accusés de lecture vérifient le destinataire, y compris pour la boîte technique commune. Les nouveaux messages sont lus uniquement quand l’écran concerné est visible, pas lorsque la PWA est en arrière-plan ; événement d’actualisation immédiate des badges.
- Modération : même filtre FR/KR chargé en base pour la communauté et les messages privés ; échappement des expressions ; journal d’audit persistant. Les mots interdits s’appliquent aussi aux réponses humaines du personnel et aux réponses proposées par l’IA.
- Promotions : les erreurs de persistance ne donnent plus de succès ; identifiant réellement créé renvoyé au client. Désactivation des coupons utilisés plutôt que suppression de leur historique ; retours FR/KR en cas d’échec.
- Professeurs : renvoi d’une vraie invitation par la chaîne Resend existante, suppression du faux lien base64. Suspension vérifiée à la connexion et sur chaque requête de session ; aucune suspension implicite d’un compte admin. Retrait des faux formateurs et de la fausse vidéo d’introduction dans l’éditeur de cours ; auteur par défaut = administrateur connecté.
- Certificats : table et aperçu alimentés par les certificats enregistrés ; aucun nom/cours d’exemple affiché s’il n’y a aucun certificat. Les réglages de signature et le PDF protégé existants sont conservés.
- Paramètres : compte personnel séparé (/admin/compte) pour admin et professeur ; configuration système (/admin/parametres) réservée aux admins, avec accès aux modules réellement persistés (IA, modération, signature, formateurs). Les liens après changement d’e-mail reviennent au bon espace.
- Présence : disponibilité et dernière activité persistées pour admin ET professeur, sans dépendance à la mémoire d’un Worker. Se connecter ne marque plus une escalade comme résolue.
- Supervision IA : statistiques agrégées côté SQL à partir de conversations/messages/escalations/ai_usage ; le taux indique les discussions prises en charge par IA et ne prétend pas mesurer une résolution confirmée. Versions de configuration réellement enregistrées, restaurables et limitées aux cinq dernières, RPC protégé contre les appels étudiants et les modifications du profil d’un autre professeur.

## Modèles IA et coûts

Les valeurs héritées visaient Gemini 1.5 Flash et Claude 3. Le choix est maintenant utilisé pour sélectionner le fournisseur et sa clé, plutôt qu’envoyer systématiquement vers Google dès qu’une clé Google existe. Les alias hérités reconnus sont convertis vers les modèles pris en charge ; un modèle inconnu n’est jamais appelé avec une estimation de coût inventée.

Modèles vérifiés dans les documentations officielles le 31 octobre 2026 :
- Gemini 3.5 Flash-Lite : https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- Tarifs standard Google : https://ai.google.dev/gemini-api/docs/pricing
- Claude Haiku 5.5, identifiant, tarifs et paramètres : https://platform.claude.com/docs/en/models/haiku-5-5/overview

Les coûts affichés sont des estimations tarifaires sur les jetons réellement déclarés par les API, incluant les jetons de réflexion Google ; ce ne sont pas des factures et ils ne déduisent pas les éventuels crédits/gratuités du compte. Les blocs de réflexion ne sont jamais présentés comme une réponse. Les paramètres Claude incompatibles sont retirés ; les erreurs de fournisseur sont journalisées sans contenu brut ni clé.

## Migration et exploitation

Fichier : supabase/migrations/20261031044646_admin_real_data_messaging.sql. Migration idempotente testée dans PostgreSQL local, RLS et rôles réels. Application distante confirmée par l’utilisateur ; aucune inspection ou opération distante Supabase par l’agent.

Avant recette :
1. Vérifier les tickets avec deux comptes admin et un professeur auteur, puis lire/répondre depuis l’élève ; le support technique est partagé, le cours reste privé à son auteur.
2. Vérifier les badges avec un nouveau message d’un autre compte, puis ouvrir l’écran. Aucun badge pour zéro non-lu ou son propre message.
3. Configurer la clé du fournisseur choisi dans Cloudflare (GEMINI_API_KEY ou ANTHROPIC_API_KEY). Choisir un modèle pris en charge dans la supervision ; vider AI_MODEL si les réglages de l’interface doivent être prioritaires. Une valeur AI_MODEL explicite reste une surcharge de déploiement.
4. Chaque professeur configure et active son assistant avec de vrais éléments du cours. Sans version active de configuration pour ce cours, les questions sont escaladées au responsable. Sans clé, si les quotas/configurations sont indisponibles ou si le modèle ne sait pas répondre, aucune fausse réponse n’est fabriquée.
5. Vérifier le signataire et la signature dans Certificats, ainsi que les invitations reçues par les professeurs. Aucun email réel envoyé pendant les tests de ce correctif.

Les anciens jeux d’essai éventuellement insérés directement dans la base ne sont pas effacés par cette migration. Leur présence distante n’a pas été inspectée ; suppression de données financières ou de comptes non effectuée.

## Vérifications

Tests locaux dédiés : admin-real-data.test.ts, admin-real-messaging.test.ts et admin-ai-provider.test.ts. Ils couvrent états vides, erreurs d’écriture, identifiants persistés, filtres personnalisés, notifications, accusés de lecture, support multi-admin, isolation des cours, accès superviseur limité dans le temps, versions IA et transport des deux fournisseurs simulé. Les requêtes de fournisseurs et envois d’e-mails sont simulés ; aucun test local ne constitue une preuve de livraison ou de facturation sur les comptes de production.

Résultat final local : 33/33 suites passent, 66/66 assertions de sécurité passent ; typecheck et lint sans erreur ni avertissement ; build de production OpenNext terminé ; scan de secrets propre. Les 374 fichiers src/public du build isolé ont été comparés aux sources, sans différence.
Migration finale SHA-256 : 95742AB6764CCBE93B4CF9B5D5712EE6ADCC94A9DD4B11324D5DA3FFC19CF190.

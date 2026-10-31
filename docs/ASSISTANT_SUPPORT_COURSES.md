# Support, assistance pédagogique et modération

Diagnostic avant modification (31 octobre 2026) :
- Deux lectures .single() de réglages optionnels font échouer toute la page modération si une ligne manque. L’audit sélectionne des colonnes ajoutées par une migration ancienne, absentes du schéma de secours Auth.js. La cause exacte de production ne peut être confirmée sans ses logs ; ces chemins reproduisent l’erreur localement.
- Aucun résumé privé par cours n’est chargé. L’assistant pédagogique est désactivé par défaut sans version personnelle ; même un salut finit en escalade.
- Chaque message non résolu peut créer une escalade et un e-mail distincts.
- Le prompt confond support plateforme et pédagogie, et ne dispose d’aucun outil web.

Implémentation : deux périmètres, résumé privé par cours, recherche web bornée avec sources, reprise humaine dans la même conversation, pas de nouvelle notification d’escalade tant qu’une demande reste ouverte. Aucune opération sur le Supabase distant.

## Comportement livré
- `/admin/assistant-ia` : onglet « Résumés des cours », liste des cours de l’auteur et indication des résumés manquants ; après publication, ouverture du cours concerné dans cet onglet. Résumé FR et/ou KR, minimum 80 et maximum 12 000 caractères par langue, activation et recherche web configurables par cours. L’ancien onglet de personnalisation reste disponible.
- Support : procédures publiques du site uniquement, clarification du problème, puis relais à l’équipe administrative pour une intervention personnelle. Aucun résumé pédagogique et aucune recherche web dans ce mode.
- Pédagogie : résumé du cours réellement choisi par l’étudiant, paramètres de son auteur, derniers messages de cette conversation. L’auteur en ligne garde la main. Sans résumé fiable, sans fournisseur disponible, sur demande d’humain ou en cas d’incertitude : relais à l’auteur réel, y compris un administrateur auteur.
- « Salut », « Hi », « Bonjou » et les acquiescements reçoivent une réponse de clarification locale, sans appel payant. L’assistant peut aider pendant l’attente humaine ; le transfert reste ouvert jusqu’à une réponse du responsable. La procédure SQL verrouille la conversation et ne crée qu’une escalade et un e-mail tant qu’elle reste ouverte. Aucune suppression des anciennes conversations ou escalades.
- Réponses IA persistées dans la même table messages, avec le mode, les sources et les estimations de jetons. Le professeur voit l’échange à son retour dans sa messagerie. Les limites d’accès existantes et le filtre de mots interdits restent appliqués.
- Sources : liens HTTPS validés dans les deux interfaces ; suggestions Google isolées dans une iframe sans scripts ni accès au contexte de la page. Aucun rendu HTML du fournisseur dans le document principal.
- Modération : réglages optionnels absents acceptés, contenu JSON vérifié, audit lu avec les colonnes communes aux schémas existants. Les pannes de lecture deviennent des sections indisponibles avec réessai, jamais de fausses listes vides ni d’édition d’un réglage non chargé. Un échec de traitement d’un flag n’annonce plus un succès.

## Confidentialité autorisée le 31 octobre 2026
Le propriétaire a répondu « Oui, avec ces limites » à la description précise des destinataires et données :
1. Réponse : fournisseur configuré, Gemini (`generativelanguage.googleapis.com`) ou Claude (`api.anthropic.com`) ; résumé privé du cours et derniers messages de la conversation uniquement. Pas d’autre conversation ni accès général à la base.
2. Recherche : appel séparé, question courante débarrassée des e-mails, téléphones, URL et UUID, ainsi que du nom connu de l’étudiant ; titre public du cours. Aucun résumé privé, historique, identifiant de compte ou nom de l’étudiant ajouté au payload de recherche. Les utilisateurs doivent éviter d’inclure des données personnelles de tiers dans leurs questions.
3. Sources visibles et frais éventuels de recherche annoncés ; activation configurable par cours. Les coûts restent des estimations selon le fournisseur, pas une facture.
L’examen automatique avait initialement refusé l’ajout de cette transmission faute d’autorisation précise ; aucun script refusé n’a été exécuté. L’implémentation a repris après cet accord explicite.

## Migration
`supabase/migrations/20261031060204_course_ai_context_and_moderation_repair.sql` — application confirmée par le propriétaire pendant cette tâche. SHA-256 : `DDF1D9D2340304CD66EC4FC4646C64975859B42D5CF6423826B8024F2988B0E8`.
- `course_ai_context` : RLS, droits explicites ; auteur vérifié non banni ou administrateur seulement. Pas de droit anon, aucune lecture étudiante.
- Valeurs initiales des réglages de modération uniquement si absentes ; conservation des choix existants. Reprise de l’ancienne clé de réglages IA si nécessaire.
- RPC `queue_assistant_handoff` en SECURITY INVOKER, exécution service_role seulement, étudiant vérifié non banni, message persistant appartenant à l’étudiant, inscription non révoquée, verrou de conversation et déduplication. Réutilise l’envoi d’escalade existant.
- Notification après acceptation de l’e-mail : texte neutre support/professeur, sans prétendre que le destinataire l’a lu ou reçu dans sa boîte.
Aucune commande, lecture ou écriture effectuée sur le Supabase distant par l’agent.

## Vérification et limites
Tests ajoutés : `assistant-modes.test.ts`, `assistant-messaging-flow.test.ts`, `course-ai-context.test.ts`, `moderation-resilience.test.ts`. PostgreSQL réel local via PGlite pour les règles SQL ; fournisseurs et e-mails simulés, aucune recherche payante ni notification réelle déclenchée par les tests.
À vérifier avec les comptes réels après déploiement :
- ouvrir Modération et ses six onglets ; toute section indisponible signale un problème à diagnostiquer, pas « aucun signalement » ;
- chaque auteur renseigne un résumé fiable de chaque cours publié dans Résumés des cours ; vérifier activation et limites globales IA, clé fournisseur d’exécution et modèle autorisé ;
- élève : salutation au support, problème du site, puis demande explicite d’humain ; vérifier l’arrivée dans la boîte technique partagée ;
- professeur indisponible : question pédagogique avec résumé, recherche sourcée, puis question inconnue ; vérifier la notification unique et la reprise du même échange par l’auteur ;
- professeur disponible : vérifier qu’il reçoit directement la question et que l’IA reste silencieuse ;
- vérifier la réception réelle des e-mails, la capacité/quota du fournisseur et sa facturation. Les tests simulés ne prouvent pas ces réglages de production.

Références techniques consultées : [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [Google Search grounding](https://ai.google.dev/gemini-api/docs/google-search), [REST Gemini generateContent](https://ai.google.dev/api/generate-content), [Claude web search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool).

Résultats finaux avant push : 37/37 suites réussies (dont les 66 assertions de sécurité existantes), TypeScript sans erreur, lint sans avertissement, contrôle de secrets propre, build de production OpenNext réussi. Comparaison octet par octet de src/ et public/ avec les sources compilées : aucune différence. Les parcours authentifiés réels et les appels fournisseurs payants restent des vérifications opérationnelles à faire après déploiement ; aucune promesse de livraison e-mail réelle n’est déduite des tests simulés.

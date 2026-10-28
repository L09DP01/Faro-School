# Audit de Faro School

Date : 28 octobre 2026. Périmètre : dépôt local, documentation, configuration, routes, services métier, migrations et vérifications locales. Aucune modification fonctionnelle, aucun paiement réel, aucune écriture sur un service externe.

## Compréhension du produit

Faro School est une plateforme de formation vidéo destinée au marché haïtien. Sa proposition combine des cours pratiques, une interface français/créole haïtien, des prix en gourdes, MonCash/NatCash et une expérience mobile installable.

Le parcours métier est : découvrir une formation → créer un compte → payer → recevoir une inscription → suivre des modules et leçons → enregistrer sa progression → obtenir un certificat. Une communauté et une messagerie permettent l'accompagnement ; un assistant IA peut répondre en l'absence du formateur, avec escalade humaine.

Trois rôles structurent le produit : élève, formateur et administrateur. Le projet a donc dépassé son intention initiale de vente par un formateur indépendant pour couvrir une organisation avec plusieurs formateurs, supervision et modération.

## Architecture observée

- Next.js 15.5.28, React 19 et TypeScript ; routes App Router, API et Server Actions.
- Supabase pour Auth, PostgreSQL, politiques RLS et échanges temps réel.
- Bunny Stream pour les vidéos et Bunny Storage pour les fichiers.
- Kobara comme intermédiaire MonCash/NatCash.
- next-intl pour les routes `/fr` et `/ht` et les dictionnaires.
- Tailwind, tokens CSS et composants de marque ; design system documenté.
- OpenNext et Wrangler pour cibler Cloudflare Workers.
- Anthropic pour l'assistant et Resend pour les emails d'escalade.
- Service worker pour les ressources statiques et une page de repli hors ligne.

Il s'agit d'un monolithe web modulaire. Les dossiers `app`, `components` et `lib` séparent globalement routes, présentation et logique métier. Les migrations SQL portent également des règles critiques : inscriptions après paiement, permissions et validation des participants.

## Points solides

1. Positionnement produit cohérent avec la cible : langue, monnaie et moyens de paiement locaux.
2. Parcours pédagogique assez étendu : catalogue, paiement, progression, ressources et certificats.
3. Séparation explicite des rôles et fonction centrale `can()` pour les permissions.
4. Calcul du montant du cours côté serveur dans la création de paiement.
5. Migrations versionnées, politiques RLS, journalisation et contrôles SQL présents.
6. Contrôles d'inscription pour délivrer des accès vidéo et ressources temporaires.
7. Service worker conçu pour exclure API, paiements, vidéo et plusieurs espaces sensibles du cache.
8. Présence de scripts de vérification des permissions, de la modération, des traductions et de la PWA.

Ces éléments constituent une base ; leur présence ne prouve pas que la configuration distante ou les parcours complets sont corrects.

## Constats prioritaires

### Critique — identité et rôle acceptés depuis un cookie non signé

`src/lib/auth/get-user.ts` décode `faro_session` en Base64 et accepte directement `id` et `role`. `src/middleware.ts` fait de même. Il n'y a ni signature ni vérification Supabase pour cette branche, ni condition réservant son utilisation au développement.

`src/app/api/auth/login/route.ts` contient également des comptes de démonstration à mots de passe fixes, acceptés sans garde de production. Des Server Actions telles que `admin-instructors.ts` utilisent ensuite `getCurrentUser()` pour autoriser des opérations et un client privilégié pour écrire.

Conséquence : la confiance applicative dans l'identité et les privilèges peut être contournée. L'impact exact de chaque opération dépend du chemin emprunté et de la base distante ; le défaut de contrôle est confirmé dans le code.

Action : supprimer cette authentification du chemin de production et valider identité/session et rôle côté serveur.

### Critique — attribution du rôle depuis des métadonnées d'inscription

La fonction SQL `handle_new_user`, encore redéfinie dans la migration `20250109000000_admin_students_promotions_messages.sql`, copie `raw_user_meta_data.role` vers `profiles.role`. La politique de mise à jour de son propre profil limite les lignes par `id`, sans restriction de colonne sur `role` dans les migrations examinées. Aucune protection compensatoire correspondante n'a été repérée dans les migrations locales.

Conséquence : le schéma autorise des chemins d'élévation de privilèges si les droits exposés correspondent à ces migrations. À confirmer sur une base de test avec ses grants réels.

Action : imposer le rôle `student` à l'inscription et réserver les changements de rôle à une opération administrative contrôlée ; protéger aussi la colonne en base.

### Critique — validation des paiements insuffisamment liée à la commande

Dans `src/lib/payments/kobara.ts`, une clé absente active automatiquement la simulation. `verifyWebhookSignature()` renvoie vrai si le secret webhook manque ou si le fournisseur est en simulation.

Le webhook cherche le paiement le plus récent même si aucun identifiant de commande ou transaction n'est fourni. Il n'exige pas de correspondance entre le montant reçu, la devise, la transaction et la commande.

La route de retour vérifie un identifiant ou une référence fourni par la requête puis sélectionne la commande séparément. Elle ne démontre pas leur appartenance commune. Sa branche `status=failed` modifie commandes et paiements à partir du paramètre `orderId`, sans preuve du fournisseur.

Action : refuser le démarrage en production sans secrets, désactiver le simulateur et effectuer une validation transactionnelle liant événement, identifiant fournisseur, commande, montant, devise et état antérieur. Refuser tout événement sans référence exploitable.

### Élevé — données de démonstration et persistance réelle mélangées

Plusieurs services de paiements, élèves, formateurs et messagerie retournent des données simulées en cas d'absence de résultats ou d'erreur. Certaines écritures administratives basculent sur des magasins `globalThis`.

Conséquence : une erreur SQL ou une panne peut être présentée comme un succès ou comme des données normales. Les données en mémoire ne constituent pas une persistance partagée entre instances.

Exemples : `src/lib/admin/payments.ts`, `src/lib/messaging/data.ts`, `src/app/actions/admin-instructors.ts`. La requête de messagerie utilise aussi `courses(title)`, alors que le schéma de cours utilise des titres localisés ; ce décalage doit être corrigé plutôt que masqué par le fallback.

Action : réserver les fixtures à un mode démo explicite et afficher des états vide/erreur fidèles en production.

### Élevé — garde-fous IA incomplets

`src/lib/messaging/ai-assistant.ts` conserve cooldowns, quotas et coût quotidien en mémoire. Le compteur `platformDailyCostUsd.cost` est initialisé et consulté, mais aucune incrémentation n'a été repérée. Le moteur lit `dailyCostCap` dans le magasin global, tandis que les réglages administratifs exposent `dailyCostCapUsd`.

Le kill switch consulte une variable d'environnement ou un magasin local, sans relecture directe des paramètres persistés dans cette fonction. La désactivation globale entre instances n'est donc pas garantie par ce code. Une clé Anthropic absente déclenche également une réponse simulée.

Action : centraliser paramètres, quotas et comptabilité durable ; vérifier leur application effective ; valider strictement le JSON retourné par le modèle.

### Élevé — récupération du mot de passe incomplète

La route `src/app/api/auth/forgot-password/route.ts` envoie vers `/reinitialiser-mot-de-passe`. Aucune page correspondante n'apparaît dans les routes locales. L'API ignore aussi le résultat d'erreur de `resetPasswordForEmail`.

Action : compléter le traitement du lien de récupération et le formulaire de nouveau mot de passe, puis vérifier le parcours depuis un email.

### Élevé — création d'un formateur à réexaminer

`createInstructorAction` insère directement un profil sans créer d'utilisateur Supabase Auth ni fournir son identifiant. Or `profiles.id` référence `auth.users`. La branche peut échouer puis produire un formateur simulé, donnant une impression de réussite.

Action : créer/inviter l'utilisateur via Auth, utiliser son UUID et vérifier chaque résultat d'écriture.

### Moyen — protection contre les abus et exploitation

Le limiteur de requêtes utilise une `Map` locale. Ses compteurs ne sont pas partagés entre instances et disparaissent avec elles. Le cron d'escalade possède un secret de secours fixe et Wrangler ne déclare pas de planification pour cette route. Un ordonnanceur externe reste possible, mais n'est pas démontré par le dépôt.

Action : utiliser des compteurs partagés pour les opérations sensibles, exiger un secret de cron et documenter/tester son ordonnanceur.

### Moyen — tests et documentation donnent une assurance trop large

Le test `security-audit.ts` inspecte notamment des chaînes et expressions régulières dans la migration initiale. Cela ne teste pas réellement l'isolement des utilisateurs sur une base avec toutes les migrations. Le test de paiements commence principalement par le fournisseur simulé ; son intitulé « end-to-end » dépasse ce que cette partie vérifie.

Le README demande d'appliquer la première migration alors que 17 migrations sont présentes. `PROJECT_CONTEXT.md` contient une ancienne règle autorisant les messages entre élèves ; la configuration et la dernière migration les interdisent. Le README décrit la fermeture automatique d'un ancien appareil, mais `video/session.ts` refuse un troisième appareil et propose une terminaison séparée.

Action : aligner documentation et comportement ; ajouter une commande de tests reproductible et des scénarios d'intégration avec vraies identités de test.

## Expérience et maintenabilité

L'identité visuelle est formalisée et des captures existent. Aucun audit visuel interactif ou WCAG complet n'a été effectué ici ; l'accessibilité, les performances réseau et le confort sur téléphone restent à mesurer.

La PWA met en cache des ressources statiques et propose un repli hors ligne ; cela ne rend pas les formations vidéo disponibles sans connexion.

Des composants volumineux, comme les vues communauté et lecteur, concentrent beaucoup de responsabilités. Leur découpage par fonctionnalité faciliterait les corrections. Le nombre de membres en ligne de la communauté est artificiellement planché à 142 dans un traitement de présence : retirer cette donnée de démonstration du produit réel.

## Vérifications et limites

- TypeScript : `tsc --noEmit` terminé avec code 0.
- Traductions : 757 clés françaises et 757 créoles, parité de clés réussie. La qualité linguistique n'est pas évaluée par ce test.
- Script de sécurité : 36 contrôles sur 39 annoncés réussis, mais code de sortie 0 malgré trois échecs. Les trois contrôles portent sur des motifs administrateur devenus partiellement obsolètes avec le rôle formateur ; ils ne démontrent pas seuls trois vulnérabilités. Le script doit également signaler ses échecs par un code non nul.
- Lint : non validé, échec de chargement du module natif SWC/cache dans l'environnement d'exécution.
- Aucune preuve apportée ici sur un build de production frais, le déploiement, le DRM Bunny, un paiement réel ou la base distante.
- Les fichiers de configuration secrets n'ont pas été exposés dans le rapport.
- Référence de contrôle : documentation officielle Supabase sur les politiques RLS : https://supabase.com/docs/guides/database/postgres/row-level-security . Les constats ci-dessus proviennent du code local ; la configuration distante n'a pas été inspectée.

## Ordre de travail recommandé

1. Fermer les chemins d'authentification de démonstration et l'élévation de rôle en base.
2. Sécuriser les transitions de paiement et leurs preuves fournisseur.
3. Retirer les fallbacks simulés des chemins de production et contrôler les erreurs SQL.
4. Réparer récupération du compte, création des formateurs, quotas et arrêt global de l'IA.
5. Tester les migrations complètes et les parcours élève/formateur/admin sur un environnement isolé.
6. Vérifier le build Workers, les intégrations externes, le mobile et les réseaux lents ; mettre à jour le guide d'exploitation.

## Appréciation

Faro School possède une base fonctionnelle ambitieuse et une direction produit claire. Son principal chantier est la fiabilisation : les mécanismes de démonstration sont encore imbriqués dans l'identité, les données et les intégrations. Le code examiné ne justifie pas encore une mise en production avec de vrais paiements et utilisateurs avant correction des constats critiques.

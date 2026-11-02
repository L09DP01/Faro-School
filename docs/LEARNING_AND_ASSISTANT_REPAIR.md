# Lecture, contenu facultatif et assistants — 2 novembre 2026

## Causes constatées

- La route de lecture produit une URL signée du lecteur HTML Bunny. Le composant
  la passait à `<video src>`, qui attend un média : la lecture restait à 0:00.
- La rangée de contrôles et les onglets ne tenaient pas sur un écran étroit.
- L'onglet Questions contenait un faux auteur et un numéro WhatsApp de démonstration.
- Les modèles de leçon acceptaient déjà descriptions et ressources, mais l'éditeur
  n'offrait pas leurs champs. Retirer la dernière ressource ne supprimait pas sa ligne.
- Les notes vides n'étaient pas sauvegardées ; une sauvegarde refusée pouvait être
  présentée comme réussie.
- La présence du professeur suffisait à couper l'IA, sans prise de relais explicite.
  Le trigger de notification remettait chaque réponse élève à open, perdant le suivi
  du transfert humain. Les tickets pouvaient être rouverts et le mute ne couvrait
  pas toutes les écritures privées.

## Résultat

Le lecteur Bunny est intégré dans une iframe responsive avec son API officielle
player.js pour reprise, progression et complétion. Les signatures et les contrôles
d'accès restent sur le serveur. Les contrôles intégrés remplacent la fausse barre
0:00 ; les onglets passent sur plusieurs lignes sur mobile. La leçon doit appartenir
au cours de l'URL. La description du cours est utilisée si celle de la leçon est vide.
La question ouvre la discussion du vrai cours/auteur via les contrôles existants.
Les boutons « Continuer la formation » du catalogue détaillé ouvrent désormais
la première leçon réelle, plutôt que de renvoyer au dashboard générique.
Un certificat n'est plus présenté comme obtenu simplement parce que c'est la dernière
leçon. Documentation officielle : https://bunny.net/docs/stream/playback-api

L'éditeur propose les descriptions FR/KR, des PDF facultatifs (10 Mo maximum) et
un test facultatif de 20 questions maximum. Les PDF passent par Bunny Storage ; les
nouveaux téléchargements passent par une route qui vérifie l'inscription ou le rôle
et renvoie no-store. Le navigateur ne reçoit jamais la clé Storage. Les quiz ont
quatre propositions et une bonne réponse ; la correction reste privée, la note est
calculée et enregistrée sur le serveur. Cette note ne change pas le certificat.
Les notes personnelles sont chargées, sauvegardées et effacées ; elles restent
propres au compte. Un refus ne devient pas une fausse confirmation de sauvegarde.

## Deux assistants distincts

- Support : procédures du site uniquement. Une demande non résolue devient un ticket
  pour les administrateurs et suspend la saisie. L'administrateur prend le relais,
  répond, résout et ferme. Fermer est définitif ; un nouveau problème peut créer un
  nouveau ticket distinct, sans réouvrir l'ancien. Un seul ticket actif par élève.
- Professeur : le choix d'un cours est obligatoire ; son auteur et son résumé privé
  définissent l'assistance. L'identité de l'assistant est celle du même professeur,
  avec un contexte séparé par cours/conversation. Les historiques ne sont pas mélangés.
  L'IA répond sur plusieurs tours pendant l'absence et peut aider sur une autre
  question pendant qu'un point attend l'auteur. Un seul transfert/e-mail non résolu.
  Une absence de réponse fiable est annoncée, pas transformée en silence.
- Un popup dans l'espace du professeur propose de prendre le relais. La présence seule
  ne coupe plus l'assistant. La prise de relais est enregistrée et verrouillée contre
  une réponse IA déjà en cours ; le professeur peut rendre la main. Après 90 secondes
  sans présence disponible, l'IA pédagogique peut reprendre. Les quotas, le kill switch
  et les limites de connaissances continuent de s'appliquer.
- Une conversation fermée reste conservée pour le personnel et disparaît de la vue
  élève. Le chat (communauté et privé) est inaccessible pendant un mute actif, puis
  redevient disponible après son échéance. Les cours et services du compte restent
  accessibles. Contrôles dans les actions et dans PostgreSQL, même en accès direct.

## Migrations et vérifications

Le propriétaire a confirmé l'application de :
- `20261102200000_assistant_lifecycle_and_chat_suspensions.sql`
- `20261102203000_optional_lesson_quizzes.sql`

Aucune opération distante Supabase par l'agent. Tests PostgreSQL locaux : états,
contrôles de rôle, suspension expirée, fermeture, impossibilité de rouvrir, protection
des corrigés et notes. Tests HTTP : séquence multi-message, reprise explicite,
faux score ignoré, octets PDF contrôlés, refus avant lecture Storage et no-store.

Captures des composants réels avec données locales dans
`docs/screenshots/learning-repair/` : FR/KR à 320, 390, 768 et 1440 px, lecteur,
éditeur facultatif, ticket en pause et popup. L'API Bunny, l'IA et les écritures sont
simulées dans ce banc de test ; ces images ne prouvent pas une lecture Bunny réelle.

Validation locale finale : 48 suites passent, typecheck, lint sans avertissement,
contrôle des secrets propre et 32 captures FR/KR à quatre largeurs. Le build
OpenNext est vérifié avant le push. Aucun paiement réel ni message à un autre
compte n'a été envoyé par l'agent pendant ces tests.

## Contrôles réels restant au propriétaire

1. Sur iPhone/Android/PWA : lire la vidéo, passer en plein écran, reprendre la lecture
   et vérifier la progression. Le rendu natif iOS n'est pas confirmé par un test desktop.
2. Enregistrer une vraie description et un PDF, rouvrir le cours puis télécharger le
   document avec un élève inscrit. Ajouter un quiz, vérifier une note et effacer une note.
3. Avec deux comptes : plusieurs questions pendant l'absence, prise de relais du
   professeur, autre question pendant une attente, ticket support en pause puis résolu.
4. Vérifier le fournisseur IA, le résumé du cours et les budgets dans les réglages :
   les tests hors ligne ne confirment ni ses quotas réels ni ses réponses pédagogiques.
5. Les appels de paiement réels restent à vérifier par le propriétaire. Le correctif
   serveur du registre a été déployé séparément en priorité (`0d4e420`).

# Messages et navigation PWA — 30 octobre 2026

## Parcours étudiant

La page Messages s’ouvre sur la liste et ne force plus l’ouverture de la première
conversation. Les catégories sont Tous, Tickets (direction), Professeurs (cours)
et Système (notifications du compte). Les statuts des conversations existantes
sont conservés ; aucune table de tickets ou d’inscriptions supplémentaire.

« Écrire » propose « Écrire à un professeur » ou « Écrire à la direction ».
Pour un professeur, l’élève choisit parmi ses inscriptions actives et voit le nom
du responsable. La discussion correspondante s’ouvre directement ; une discussion
encore ouverte avec ce responsable est réutilisée. La direction est un véritable
administrateur vérifié et non banni, choisi côté serveur. Sans cours, la direction
reste accessible. Les échanges élève–élève ne sont jamais proposés ni acceptés
par ce parcours. Le premier message est écrit dans la discussion : ouvrir le
sélecteur ne déclenche ni message automatique ni email.

Le serveur ignore tout choix arbitraire de professeur : il relit l’inscription
active, le responsable actuel du cours et son rôle/état de vérification. Un cours
révoqué ou forgé est refusé. Les noms affichés privilégient le nom complet.
Pour la direction, lorsque RLS masque le profil joint, une lecture serveur limitée
aux champs d’affichage enrichit uniquement une conversation déjà autorisée par
RLS. Aucun email, téléphone ou secret de personnel n’est retourné.

Les messages système sont les notifications existantes, filtrées par le compte.
Le marqueur de lecture ne modifie que les notifications de cet utilisateur. La
liste est actualisée via Realtime sur ses conversations et notifications ; les
protections de conversation, les réponses staff et le comportement de l’assistant
existant sont conservés.

## Verrou SQL

`20261030210000_staff_messaging_active_enrollment.sql` met à jour le déclencheur
existant : inscription révoquée refusée, destinataire vérifié/non banni,
interdiction d’initier une conversation pour un professeur. Une réponse ou une
mise à jour de statut est maintenant permise au professeur affecté. Un utilisateur
non admin ne peut jamais changer les participants ni le cours d’une conversation.
Le propriétaire a confirmé avoir appliqué ce fichier ; aucune opération distante
sur Supabase n’a été effectuée par l’agent.

## Cadre fixe et absence de chevauchement

Le cadre partagé réserve trois lignes : en-tête, contenu `minmax(0,1fr)`, navigation.
La navigation reste montée, y compris lorsque le viewport se réduit avec le
clavier. Sa hauteur et sa safe area sont retirées de l’espace du contenu et du
sélecteur de destinataire. Les fenêtres longues possèdent leur propre défilement.

Les nouveaux messages font défiler uniquement le panneau de messages.
`scrollIntoView` a été retiré des chats privés et communautaires car il pouvait
faire défiler aussi leurs ancêtres cachés, en déplaçant le cadre autour du chat.
Le service worker v3 rend la mise à jour détectable et attend « Actualiser ».

## Validation

Tests PostgreSQL locaux : cours non acheté/révoqué refusé, professeur actuel
sélectionné, réutilisation d’une discussion, direction vérifiée, rôle suspendu,
notifications d’un autre utilisateur inchangées. Le déclencheur est aussi testé
en accès direct : l’inscription révoquée est refusée, un professeur peut mettre
à jour le statut de sa discussion, mais ne peut ni l’initier ni changer le cours.

Vérification dans le navigateur avec les vrais composants, données et transport
simulés : choix Professeur/Direction, cours et nom du professeur, ticket direction,
retour à la liste, onglet Système, absence de cours en KR. À 390×844, après une
discussion de 40 messages : défilement du panneau 3975 px, document y=0,
navigation y=780–844 et saisie terminée à y=775 (aucun recouvrement). À hauteur
420 : navigation y=356–420, saisie terminée à y=351. Desktop 1440 : aucun
débordement horizontal. Aucun message réel n’est envoyé par ces fixtures.

Le clavier physique, le notch et les barres système d’un iPhone installé restent
à vérifier sur appareil réel après déploiement ; une réduction de viewport ne
reproduit pas entièrement iOS. La landing n’a pas été redessinée.

Contrôles finaux réussis : 22/22 suites, TypeScript, lint, scan des secrets,
build OpenNext/Cloudflare et dry-run Wrangler. Les 325 fichiers source et le
service worker du build correspondent exactement aux sources publiées.

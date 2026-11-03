# Assistant support : audit et implémentation

## Constats vérifiés dans le code
- `private-messaging.ts` partage la génération avec l’assistant pédagogique et appelle `intakeReply` pour le support. Les expressions achat/paiement renvoient la même procédure, sans diagnostic persistant.
- `requestsHumanSupport` ne couvre pas les formulations créoles des captures. Un échec du modèle se transforme en consigne générique répétée.
- `commit_assistant_reply` protège l’enregistrement sous verrou et par replyTo ; il ne réserve pas à lui seul l’appel au fournisseur. Plusieurs traitements peuvent donc consommer le modèle pour la même demande avant de se départager.
- L’historique est enregistré et conservé. Il manque un état de problème structuré, une recherche d’articles publiés et des outils de consultation personnels limités au compte courant.

## Périmètre
Moteur et connaissances SUPPORT uniquement. Interface du chat et moteur pédagogique conservés. Aucun message, conversation ou historique supprimé. Tous les Markdown du dépôt deviennent des sources administrables, avec empreinte et provenance ; les contenus internes ne deviennent jamais publics sans validation et publication explicites.

## Sources vérifiées pour les articles initiaux
Auth : actions et règles Auth.js, validation e-mail, profil. Commerce : route payments/create, fournisseur Kobara, statuts orders/status et webhook signé. Formation : garde vidéo, ressources, quiz ; SQL certificate_eligibility et contrôle de téléchargement. Messagerie : contrôles de conversation, tickets, modes et accès communauté.

Les noms de tables ne constituent pas une validation. Les procédures initiales sont rattachées aux fichiers qui implémentent chaque contrôle. Les prix, cours, inscriptions, statuts et certificats sont lus dynamiquement ; aucune valeur d’exemple n’est présentée comme donnée réelle.


## Architecture livrée
- Moteur support séparé : plan sémantique multilingue, recherche des articles publiés, historique et diagnostic persistants. La recherche combine reformulation par le modèle, plein texte PostgreSQL et correspondances lexicales ; aucun index vectoriel n’est configuré.
- Les articles vérifiés sont versionnés et invalidés si leurs sources d’implémentation changent. Aucune information historique non validée n’est présentée comme procédure courante.
- Les Markdown sont recensés dans un manifeste de métadonnées. Leur texte intégral reste dans le fichier local ignoré `tmp/support-markdown-corpus.json`, puis dans une table privée après import par un administrateur. Aucun texte interne intégral n’est embarqué dans le Worker.
- Administration : Connaissances support IA, import privé, consultation des sources, rédaction, validation et publication. Seuls les articles publiés pour les étudiants alimentent le support.
- Outils de lecture : profil, catalogue public, inscriptions, accès, commandes, paiements, progression, certificats, tickets. Identité fixée côté serveur et autorisation de conversation obligatoire. Aucun outil ne modifie un paiement ou un accès.
- Consentement explicite : Gemini/Claude reçoivent uniquement messages nettoyés, diagnostic déclaré, articles publiés et catalogue public. Les résultats privés sont ajoutés localement à la réponse et exclus des historiques transmis au fournisseur.
- Réservation idempotente par message, bail limité et contrôle du ticket/epoch avant chaque enregistrement. La création d’un ticket suit le flux backend existant et n’est annoncée qu’après confirmation.

## Validation locale
Tests PostgreSQL : migration répétable, articles réels, tables internes inaccessibles aux étudiants, contrôle du propriétaire, réservation unique, invalidation après ouverture de ticket, historique conservé, validation administrative et conflits de révision.
Tests simulés : parcours conversationnel paiement/erreur/tentative échouée/débit, recherche nouvelle révision, demande humaine FR/HT, confirmation, refus des données d’un autre compte, arrêt pendant ticket, contrat fournisseur et masquage des secrets, neuf outils limités au propriétaire. Aucun appel fournisseur réel ni donnée de test en production.

Validation complète : 60/60 suites, TypeScript, lint et compilation Worker réussis. Migration appliquée par le propriétaire (confirmation reçue) ; aucun accès direct au Supabase distant.

## Mise en service
1. Le propriétaire applique `supabase/migrations/20261103010000_support_knowledge_and_runs.sql` dans son SQL Editor.
2. Déployer le code puis ouvrir Administration → Connaissances support IA → Sources Markdown.
3. Importer `tmp/support-markdown-corpus.json` généré par `npm run knowledge:index` pour la même version du code. Relancer l’index après modification des Markdown.
4. Sélectionner les passages utiles, vérifier leur actualité puis publier les articles destinés aux étudiants. Les documents internes ne sont jamais publiés automatiquement.
5. Un fournisseur IA configuré et autorisé doit être disponible pour les réponses génératives ; sinon le support utilise un diagnostic de secours vérifié et peut proposer un humain. La qualité des réponses réelles devra être observée sur les échanges autorisés, sans création de données de test.

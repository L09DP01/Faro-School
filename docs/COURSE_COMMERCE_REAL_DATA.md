# Cours, profils publics et paiement automatique — 2 novembre 2026

## Corrections

Le catalogue et les pages de cours utilisaient des valeurs de démonstration : notes,
avis, nombre d'apprenants et identité du formateur. Ils utilisent désormais les faits
publics calculés en base : inscriptions actives, modules et leçons réels, avis des
élèves vérifiés inscrits, nom complet et profil public de l'auteur. Un échec de
lecture n'est pas remplacé par un chiffre fictif. Sans avis, aucune note inventée.

Dans Administration / Mon compte, chaque auteur peut enregistrer son nom complet,
sa fonction, sa présentation et sa photo publique. La photo utilise Bunny Storage.
Les élèves inscrits peuvent déposer ou modifier leur avis ; le serveur contrôle
l'inscription active et la vérification du compte.

Migration `20261102160000_public_course_facts_and_author_profile.sql` : projection
publique limitée, écriture du seul profil auteur courant, avis contrôlés et
idempotents. Le propriétaire a confirmé son application. Aucun accès distant à
Supabase n'a été effectué par l'agent.

## Paiements

Les instructions de virement NatCash et la saisie d'un identifiant SMS sont retirées.
MonCash et NatCash passent tous deux par Kobara, avec les logos fournis. La création
utilise le prix enregistré en base et ne donne jamais accès à la formation.

Le webhook vérifie la signature horodatée, l'environnement, le montant HTG et le
paiement lié à la commande. La référence Kobara n'est plus confondue avec celle de
Faro. La confirmation appelle la transaction existante qui valide le paiement et
crée l'inscription. Les événements répétés ne valident pas deux fois.

Contrat vérifié dans la documentation officielle :
- https://docs.kobara.app/docs/payments
- https://docs.kobara.app/docs/webhooks
- https://docs.kobara.app/docs/authentication

## Vérifications et limites

Tests PostgreSQL locaux : compteurs, confidentialité, droits auteur et avis.
Tests HTTP avec fournisseur simulé : MonCash/NatCash, prix serveur, signatures,
rejeu, devise/montant/environnement incorrects, échec de liaison et refus anonyme.
Captures des composants réels en FR/KR, à 390, 768 et 1440 px dans
`docs/screenshots/course-commerce/`. Ce sont des données locales de test.
Le build OpenNext de production a réussi. Aucun paiement réel n'a été déclenché.

## Vérifications du propriétaire

1. Renseigner le profil public et la photo de chaque auteur dans son compte.
2. Vérifier dans Kobara que MonCash et NatCash sont activés pour le marchand.
3. Configurer le webhook `https://faroschool.com/api/webhooks/kobara` en production,
   avec le secret correspondant à `KOBARA_WEBHOOK_SECRET`, et `KOBARA_MODE=live`.
   Ne jamais partager ces secrets dans le chat.
4. Effectuer un petit achat réel par chaque moyen, puis vérifier la commande payée,
   l'inscription et l'accès au cours dans le dashboard, y compris dans la PWA.
5. Tester le parcours sur iPhone et Android réels : les tests navigateur ne
   confirment pas le comportement des applications de paiement installées.

Limite préexistante : le rachat après révocation d'une inscription
nécessite une politique explicite de réactivation ; ce cas n'est pas validé ici.


## Réparation du schéma réel (2 novembre 2026)

Le contrôle de production a révélé `42703: column e.expires_at does not exist`.
Cette colonne n'existe ni dans le schéma initial des inscriptions, ni dans une
migration ultérieure. Le premier test local l'avait ajoutée à tort dans sa fixture.
La migration corrective `20261102180000_repair_course_facts_enrollment_schema.sql`
remplace les fonctions avec le seul critère existant : `revoked_at IS NULL`.
Elle conserve les contrôles de compte vérifié, les restrictions auteur, les droits
et les données. Les quatre requêtes applicatives concernées sont corrigées aussi.
Aucune colonne d'expiration ni règle commerciale nouvelle n'est introduite.

Le test PostgreSQL utilise maintenant une table sans `expires_at`, reproduit
l'erreur de l'ancienne fonction, applique la réparation deux fois et vérifie les
compteurs, les avis et les refus d'accès. Le propriétaire doit appliquer ce nouveau
fichier ; l'application de la première migration ne suffit pas.

Le propriétaire a ensuite fourni une capture du résultat SQL réussi. Contrôle
en lecture seule du site : Marketing affiche désormais « Aucun avis »,
« 0 apprenant », un module et une leçon, ainsi que l'auteur « Lorvenson CEO ».
Les mentions « Données indisponibles » ont disparu de ces sections.


## Initialisation du paiement : droits serveur (2 novembre 2026)

La route utilisait le client RLS de l'élève pour créer puis lier `payments`.
Le schéma accorde à l'élève uniquement SELECT sur ce registre. Le serveur utilise
maintenant son client de confiance pour ces seules opérations, après authentification,
prix serveur et contrôle de propriété de la commande par le client RLS. La mise à
jour d'une commande réutilisée reste bornée à son propriétaire et au statut pending.
Aucun nouveau droit navigateur ni migration n'est nécessaire. Le test HTTP refuse
explicitement tout accès à payments par le client élève. Les diagnostics ne
journalisent que l'étape, un code fixe et le code d'erreur SQL, sans données du client
ni contenu de la réponse du prestataire. Le paiement réel reste à vérifier par le
propriétaire après déploiement ; un éventuel refus de configuration Kobara est
maintenant distingué du refus d'écriture.

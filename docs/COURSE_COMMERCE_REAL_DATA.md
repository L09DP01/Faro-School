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

Limite préexistante : le rachat après révocation/expiration d'une inscription
nécessite une politique explicite de réactivation ; ce cas n'est pas validé ici.

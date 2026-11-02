# Tickets support explicites — 2 novembre 2026

Une réponse IA incertaine demande des précisions et propose le bouton « Créer un ticket support — demander un administrateur ». Elle ne suspend plus automatiquement la saisie. Le clic demande explicitement un humain ; l’assistant pédagogique conserve son transfert vers l’auteur du cours.

La migration 20261102220000_explicit_numbered_support_tickets.sql conserve le verrou transactionnel et les contrôles existants. Pour le support, elle exige la demande explicite, génère une référence FARO-SUP liée à l’UUID aléatoire de l’escalade, insère un avis système numéroté, notifie l’administrateur assigné et ajoute la référence à son e-mail. Les appels répétés ne créent pas un autre ticket ni un autre e-mail. Les fonctions restent réservées au serveur.

La référence est visible dans la conversation et le filtre Tickets utilise les avis réels de création. La migration donne une référence visible aux escalades réellement en attente et répare uniquement les états d’attente sans escalade. Aucune demande réelle supprimée et aucune donnée de test insérée. Migration confirmée appliquée par le propriétaire.

L’en-tête du chat n’a plus d’ombre ; l’en-tête de l’application est opaque, sans filtre de flou ni ombre. Le flou natif de la barre système iOS peut subsister.

Validation : action serveur (message ordinaire, réponse incertaine, demande explicite), PostgreSQL local (numéro, avis, notification admin, e-mail numéroté, idempotence, droits), 52 suites de tests et compilation OpenNext. Les bases de test locales éphémères sont fermées après exécution. Aucun compte, ticket, paiement ou message de test créé en production. Vérifier sur iPhone le voile de l’en-tête après actualisation de la PWA.

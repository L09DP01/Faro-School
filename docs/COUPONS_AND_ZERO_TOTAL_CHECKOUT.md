# Coupons administrateur et activation à zéro HTG

La gestion des promotions exige un compte administrateur vérifié, non banni et une session actuelle. Les écritures directes de coupons par le navigateur restent interdites. Une fonction réservée au serveur enregistre ensemble la création, modification, activation ou suppression et sa trace d’audit. Une erreur d’audit annule aussi la mutation. Un code déjà référencé par une commande est désactivé au lieu d’être supprimé.

Les codes sont normalisés en majuscules, comportent 3 à 30 lettres, chiffres, tirets ou underscores. Une réduction est soit un pourcentage entier de 1 à 100, soit un montant HTG entier positif. Une limite d’utilisations facultative doit être positive. Le formulaire interprète la date d’expiration comme la fin de la journée UTC choisie. Le code cesse d’être valable à son échéance.

La prévisualisation exige un utilisateur connecté et une vraie formation publiée. Elle lit le prix de cette formation, l’état actif du coupon, son échéance et son compteur. Aucun prix de secours ni coupon fictif ne remplace une lecture indisponible. La prévisualisation ne réserve pas le code et ne donne aucun accès : il est revérifié à la confirmation.

Pour un total strictement positif, le montant réduit calculé côté serveur est envoyé à Kobara, avec MonCash ou NatCash selon la méthode activée. L’accès dépend toujours de la confirmation fiable du paiement. Les coupons ne permettent pas de valider un paiement depuis le navigateur.

Pour un total nul, le bouton indique « Activer ma formation ». Aucun numéro de paiement n’est requis et aucun appel à Kobara ni fausse ligne de paiement n’est créé. La fonction serveur relit la formation et le coupon, verrouille le code, vérifie la session, sa validité et sa limite, puis crée dans une seule transaction la commande à 0 HTG, l’inscription et la consommation du coupon. Deux tentatives ne peuvent pas utiliser deux fois la dernière utilisation d’un coupon gratuit. Une inscription révoquée nécessite le support ; cette fonction ne la réactive pas.

Une table interne associe chaque consommation à une commande payée unique. Le déclencheur de paiement et la fonction transactionnelle emploient la même opération idempotente. Une validation et son rejeu ne doublent donc pas le compteur. Les commandes déjà payées servent de référence initiale, sans recalculer ni effacer les compteurs historiques.

La migration locale 20261103080245_coupon_admin_and_free_redemption.sql est appliquée uniquement par le propriétaire dans son SQL Editor. Aucun accès direct au Supabase distant et aucune donnée de test en production. Les tests PostgreSQL et HTTP sont isolés, avec des prestataires simulés ; les commandes et inscriptions existantes ne sont pas supprimées.

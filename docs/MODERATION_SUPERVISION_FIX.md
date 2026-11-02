# Modération et supervision — 2 novembre 2026

## Diagnostic

La requête des sanctions utilisait `muted_until.is.not.null,banned_at.is.not.null`.
Dans un filtre OR PostgREST, la négation précède l’opérateur :
`muted_until.not.is.null,banned_at.not.is.null`. La syntaxe précédente fait échouer
le chargement des sanctions, même lorsque cette liste est vide. Les lectures des
autres sections restent indépendantes ; une file des signalements vide ne prouve
pas que la lecture des sanctions a réussi.

La supervision affichait directement la valeur flottante du coût journalier,
ainsi que les codes techniques de statut (`waiting_staff`). Les cinq cartes
étaient imposées dès 1024 px, avec une largeur insuffisante dans le shell admin.

## Corrections

- Filtre des sanctions corrigé, sans élargissement des accès et sans migration.
- Les sections indisponibles sont nommées ; leur onglet affiche une erreur explicite.
  Le compteur des sanctions affiche un tiret si la lecture échoue. Un utilisateur
  à la fois banni et en sourdine n’est compté qu’une fois.
- Les erreurs de sauvegarde des règles/filtres et de levée de sanction sont visibles.
- Coût USD limité à quatre décimales. Une valeur positive inférieure à 0,0001 USD
  affiche « < 0,0001 USD » au lieu d’un faux zéro. Les valeurs invalides affichent
  un tiret. Les données conservées en base ne sont pas arrondies.
- Les cinq cartes passent sur une ligne à 1280 px ; les onglets peuvent défiler
  horizontalement dans leur propre zone. Statuts et rôles affichés en FR/KR.
- Les intitulés « intervenant » et « transferts humains » couvrent aussi le support
  administratif. La période de sept jours et le coût moyen journalier sont précisés.

## Vérification

Les tests de modération rejettent la syntaxe incorrecte et vérifient la propagation
des erreurs réelles. La présentation teste les très petits coûts et tous les statuts.
`tests/admin_moderation_visual.py` exécute les vrais composants React avec des
données de test locales : FR/KR, 390/768/1440 px, absence de débordement du coût et
de la page, échec d’une sauvegarde et état de section indisponible. Captures dans
`docs/screenshots/admin-moderation/`. Ces données ne sont jamais insérées en production.

La base Supabase distante n’a pas été consultée ni modifiée par l’agent. Les captures
locales ne constituent pas une validation des données réelles de production.

Documentation : https://supabase.com/docs/reference/javascript/or

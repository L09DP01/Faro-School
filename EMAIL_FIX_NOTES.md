# Corrections email — branche email-fix

## Revalidation avant modification (base c8d9bed)

- E01 confirmé : signup, resend-code et forgot-password ne lisent pas le résultat send*.
- E02 confirmé : transport arrête avant fetch si email_suppressions est inaccessible ; production non vérifiée.
- E03 confirmé : statuts 403/429/500 regroupés dans email_delivery.
- E04 confirmé : validateEnvironment jamais appelé au démarrage ; documentation Supabase Auth erronée.
- E05 confirmé : page verification-email absente, liens pourtant générés.
- E06 confirmé : erreurs insert/update ignorées, Math.random, consommation non atomique.
- E07 confirmé : limite fail-open, alerte sans limite, alreadyVerified révélé, Map contact/newsletter.
- E08 confirmé : 48 h contre 72 h ; aucun user_credentials ; reset UPDATE non vérifié.
- E09 confirmé : destinataire global, interpolation HTML brute, message système anticipé.
- E10 confirmé : notifyStudent est un console.log ; contact et paiements sans envoi réel.
- E11 confirmé : currentPassword absent, changement email vérifié et notifications absents.
- E12 confirmé : aucune outbox, aucun cron ni écran administrateur.
- E13 confirmé : code dans le sujet, versions texte et Reply-To manquants. Certificat déjà échappé.

Aucun email réel envoyé, aucune opération sur Supabase distant. Corrections et tests locaux en cours.

Lot 1 : commit ad714f6, typecheck/lint et 12 suites + test SQL atomique réussis. Lot 2 : outbox privée, cron, catégories, santé admin et templates FR/KR. Tests réels des modules avec fournisseur simulé : 429/Retry-After, 4xx permanent, doublon, callback, fail-closed et refus du véritable hook de démarrage pour chacun des six secrets requis. Aucun envoi réel.

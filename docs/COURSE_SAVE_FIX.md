# Publication bloquée — 2 novembre 2026

## Cause constatée

Le formulaire de production restait sur « Enregistrement en cours… ». Sa couverture
était une URL `data:image/png;base64` de **1 495 010 caractères**. L’ancienne API
`/api/admin/upload/cover` retournait systématiquement les octets encodés, sans
réel stockage Bunny. Leur inclusion dans le Server Action dépasse la limite
Next.js par défaut de 1 Mo. Le gestionnaire du formulaire ne possédait aucun
`catch/finally` autour de cet appel : une exception de transport laissait `saving`
à true. La limite globale n’a pas été augmentée.

Référence : https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions#bodysizelimit

## Correction

- Upload multipart (JPG/PNG/WebP, maximum 3 Mo) vers Bunny Storage, préfixe public
  réservé `courses/covers/`, nom UUID aléatoire, type et signature de fichier vérifiés.
- Aucune image base64 ni clé retournée. Seule une URL courte `/api/covers/<uuid>.<ext>`
  est incluse dans la sauvegarde. La route de lecture récupère l’image depuis Storage
  avec la clé côté serveur, sans dépendre d’un CDN public configuré. Elle ne permet
  aucun chemin arbitraire ni lecture des PDF, signatures ou ressources privées.
- Les uploads restent réservés aux administrateurs/professeurs authentifiés et
  vérifiés via le contrôle existant ; rejet des origines différentes, timeout fournisseur.
- Les anciennes images inline sont envoyées séparément avant le Server Action.
  Celui-ci refuse aussi les couvertures inline ou les URL anormalement longues.
- Un `finally` libère les boutons en cas d’exception. Les champs restent en place
  après échec. Aucune nouvelle tentative de publication automatique n’est effectuée.
- Le formulaire ne démarre pas une sauvegarde pendant un upload de couverture/vidéo.

## Vérification et limites

- Tests HTTP locaux : octets multipart réels de 1,1 Mo, PUT Bunny simulé, URL courte,
  rôles, erreur de configuration/fournisseur, type invalide, chemins privés refusés.
- Test navigateur du vrai formulaire : image inline supérieure à 1 Mo, exception
  simulée du Server Action, boutons réactivés, titre conservé, puis succès au nouvel
  essai sans deuxième upload. Aucun cours de production créé par le test.
- Captures locales : `docs/screenshots/course-save/`.
- Un appel en lecture seule avec la configuration **locale** Bunny Storage a retourné
  401. Cela ne prouve pas la validité ou l’invalidité des secrets Cloudflare : vérifier
  `BUNNY_STORAGE_ZONE_NAME` et `BUNNY_STORAGE_API_KEY` (mot de passe Storage en écriture)
  dans les variables d’exécution Production. Ne pas utiliser la clé Stream.
- Aucune opération Supabase distante. Aucune migration nécessaire.
- Le formulaire déjà ouvert utilise l’ancien JavaScript : l’utilisateur conserve
  lui-même sa saisie avant de recharger. Il a refusé une copie locale de ses champs.

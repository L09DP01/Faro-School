# Certificats Faro School — implémentation et validation

## Installation manuelle

1. Appliquer **toi-même** `supabase/migrations/20261029000000_certificates.sql`, après les migrations existantes dont celle d'Auth.js. Aucune opération distante n'a été faite par l'agent.
2. Vérifier les grants des nouvelles fonctions : les RPC de délivrance, révocation, éligibilité et limitation publique sont réservées à `service_role`. Les étudiants/formateurs ont uniquement SELECT sur les certificats, filtré par RLS. `anon` n'a aucun accès à la table.
3. Déployer le code et les assets `public/fonts/certificates/`, le fond décoratif `public/brand/certificates/ornate-template.png` ainsi que les logos existants. Les polices sont embarquées dans le PDF ; aucun service de polices externe n'est nécessaire pour ce document.
4. Configurer `NEXT_PUBLIC_APP_URL` avec l'origine HTTPS réelle. Le QR utilise cette origine et `/fr/verification/<numéro>`.
5. Configurer les secrets serveur existants : `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `BUNNY_STORAGE_ZONE_NAME`, `BUNNY_STORAGE_API_KEY`, `BUNNY_STORAGE_CDN_HOSTNAME`. Aucun secret n'est envoyé au navigateur.
6. Dans `/fr/admin/certificats`, renseigner le signataire et charger le PNG transparent. Les chemins d'image sont générés côté serveur ; seule cette signature est stockée chez Bunny, jamais les PDF.

## Choix d'intégration

- Réutilisation des tables `enrollments` et `lesson_progress`, de `profiles` et du helper `can()` ; pas de seconde table de progression ou d'inscription.
- Extension de la table `certificates` existante. La contrainte unique porte sur le certificat **valide** par élève/formation, car une réémission crée une nouvelle ligne et conserve l'ancienne révoquée.
- Le trigger et la fonction d'émission automatique historiques sont retirés. Terminer une leçon annonce l'éligibilité, puis l'élève confirme son nom avant la première délivrance.
- La délivrance prend un verrou transactionnel par élève/formation et vérifie de nouveau le profil vérifié, l'inscription active, l'absence de remboursement, le cours publié, les leçons publiées et le seuil de progression. Les valeurs de progression ou de titre envoyées par le client ne sont jamais utilisées pour émettre.
- Le titre français (`courses.title_fr`) est toujours figé dans le certificat, même si la formation est enseignée en créole. Le nom, le titre, le formateur, le nombre d'heures et la signature sont des instantanés. Les ajouts ultérieurs de leçons ne modifient pas les certificats délivrés.
- Le nom confirmé est propre au certificat : les changements ultérieurs du profil ne modifient pas ce nom. Seul un admin peut réémettre.
- `lessons.is_published` est ajouté avec `true` par défaut, car le schéma antérieur publiait des cours entiers. Seules les leçons dont ce champ est vrai entrent dans le calcul.
- `enrollments.revoked_at` sert à la révocation douce ; les suppressions existantes d'inscription sont également interceptées. La FK du certificat est mise à NULL en cas de suppression, mais son historique est conservé.
- Pour le flux de remboursement existant, écrire `payments.refunded_at=now()` lors du remboursement confirmé. Un statut textuel `refunded`, si autorisé par ton schéma, est aussi reconnu sur paiements/commandes. La migration ne change pas les contraintes de statut du système de paiement ; elle ajoute le marqueur explicite `refunded_at` et le trigger.
- Une réémission révoque l'ancien numéro et écrit les événements de révocation/réémission dans `admin_audit_logs` ; une révocation manuelle exige un motif qui n'est jamais publié.
- Les anciennes lignes auto-délivrées sont conservées avec leurs codes et marquées `legacy_unconfirmed`, afin de ne pas présenter comme confirmés des noms qui ne l'ont jamais été. Les comptes éligibles peuvent suivre le nouveau parcours de confirmation.

## Parcours et sécurité

- Élève : `/fr/certificats` ou `/ht/certificats`, accessible depuis le menu existant ; cinq onglets mobiles conservés. L'ancienne route dashboard redirige vers la nouvelle.
- PDF : `GET /api/certificates/<id>/pdf`, propriétaire ou admin uniquement ; autre utilisateur → 404. Réponse `private, no-store`, nom `Certificat-Faro-School-<slug>.pdf`. Les PDF révoqués restent disponibles à la route autorisée et portent un marquage français de révocation.
- Vérification : `/<locale>/verification/<numéro>`, via une requête serveur avec sélection de champs autorisés. État valide : nom, formation, date, formateur ; état révoqué : état et date uniquement ; pas de motif, email ou téléphone. Ancienne route `/verifier/<code>` redirigée, sans accès direct à la table publique.
- Limitation publique : 30 requêtes par minute par empreinte d'IP, stockées dans `auth_attempts` et comptées sous verrou. Échec de la limite/base → indisponibilité, pas de contournement. `robots: noindex, nofollow` et route API non mise en cache.
- Administration : table filtrable, recherche, export CSV échappant les formules, révocation, réémission et réglages de signature. Les formateurs n'obtiennent que leurs cours et aucune action de mutation.
- L'email FR/KR est envoyé après commit, sans pièce jointe. Resend reçoit une clé d'idempotence par certificat ; une nouvelle demande identique peut réessayer un email non livré. Un défaut d'email ne supprime pas un certificat déjà délivré.

## Vérifications exécutées

- Tests PostgreSQL embarqués (PGlite), utilisant la **migration réelle** sur des tables métier minimales de test : refus de progression insuffisante, email non vérifié, seuil configuré, idempotence, noms, audit, réémission réservée aux admins, révocation sur suppression d'inscription et remboursement, RLS, grants et limite publique.
- Tests des véritables gestionnaires HTTP, avec identité/base/assets isolés : 401 non vérifié, 409 sous le seuil, 403 mutation étudiant/formateur, 404 PDF d'autrui, accès propriétaire/admin, no-store, nom du fichier et rejet interorigine.
- `pnpm test` : **11/11 suites réussies**, explicitement en mode hors ligne. Le test distant historique est ignoré par sa configuration placeholder ; ce résultat ne certifie pas ta base distante.
- Génération de cinq PDF à partir du moteur de production, rendu Poppler en PNG et décodage jsQR : **5/5 QR lisibles**, URL attendue `https://faroschool.com/fr/verification/FARO-2026-7K4M9X2A` sur les échantillons.
- Captures Playwright des vrais composants React avec des données de test explicites. Le serveur de fixtures est dans `scripts/` et n'ajoute aucun accès de démonstration à l'application déployée. Contrôles d'absence de débordement horizontal, confirmation de nom, recherche admin et interface KR avec certificat français.

Les preuves machine sont `browser-checks.json`, `qr-checks.json` et `pdf-checks.json` dans le dossier des captures. Les tests de composants n'attestent pas d'un parcours complet sur une base déployée.

## Captures réelles

Toutes se trouvent dans `docs/screenshots/certificates/` :

| Cas | Fichiers PNG |
| --- | --- |
| PDF standard, accents | `pdf-standard.png` |
| Formation KR, certificat français | `pdf-kr.png` |
| Nom de 60 caractères | `pdf-long-name.png` |
| Titre long, deux lignes maximum | `pdf-long-title.png` |
| Apostrophe | `pdf-apostrophe.png` |
| Aperçu | `preview-1440.png`, `preview-390.png` |
| Page élève | `student-1440.png`, `student-390.png`, `student-kr-390.png` |
| Célébration | `celebration-390.png` |
| Confirmation du nom | `confirm-390.png` |
| Vérification valide | `verification-valid-1440.png`, `verification-valid-390.png` |
| Vérification révoquée | `verification-revoked-1440.png`, `verification-revoked-390.png` |
| Introuvable | `verification-not_found-1440.png`, `verification-not_found-390.png` |
| Administration | `admin-1440.png` |
| Réglages et aperçu | `settings-preview-1440.png` |

Les PDF d'exemple associés contiennent uniquement des données fictives et restent des fichiers locaux de contrôle. Les données de test et les captures ne sont pas mises dans `public/`.

## Commandes reproductibles

```text
pnpm test:certificates
pnpm test:certificates:api
pnpm typecheck
pnpm lint
pnpm test
pnpm exec tsx scripts/certificates-assets.ts
```

Pour les captures : lancer `node scripts/certificates-visual-server.mjs`, (le CSS et le bundle sont générés automatiquement), puis `scripts/capture-certificates.py` avec le Python Playwright. Rendre les PDF avec Poppler et exécuter `scripts/check-certificate-qr.ts` et `scripts/check-certificate-pdf.py`. Ces outils de développement ne sont pas inclus dans les routes de production.

## TODO nécessitant ton intervention

1. **Signature PNG transparente** (500 Ko maximum), à charger dans les réglages.
2. **Nom réel du signataire**.
3. **Fonction/titre réel du signataire**.
4. **Validation juridique du pied de certificat**, éditable uniquement dans `CERTIFICATE_FR.footer`, fichier `src/lib/certificates/layout.ts`. Aucun statut de diplôme d'État n'est revendiqué.
5. Appliquer la migration et confirmer le bon domaine, les secrets et le domaine expéditeur Resend.
6. Faire le test final avec de vrais comptes de test après migration, un remboursement réel de test et une révocation d'inscription. Vérifier les téléchargements dans Safari iPhone, Chrome Android et la PWA installée : les captures Chromium et tests HTTP ne remplacent pas ces essais physiques.

L'implémentation locale est livrée ; les intégrations distantes et les essais sur téléphones physiques ne sont pas déclarés validés sans preuve.

## Modèle visuel approuvé

Le PDF et l’aperçu utilisent désormais le modèle ornemental fourni : double cadre marine/orange, coins géométriques, lauriers et toque en filigrane, séparateurs à losanges et médaillon à rubans. Le fond sans données personnelles est commun aux deux rendus. Les titres et noms utilisent Tinos avec empattements, les titres du certificat des petites capitales, et les autres textes Inter. Cette exception typographique concerne uniquement le document ; le reste de l’application conserve Poppins et Inter. Le nom, la formation, les dates, la signature, le pied juridique et le QR restent dynamiques. Référence : `reference-approved.png` dans le dossier des captures. Origine de l’actif et prompt : `public/brand/certificates/README.md`.

Validation du modèle ornemental : typage et lint réussis ; 21 contrôles PostgreSQL et 10 tests HTTP repassés ; cinq PDF en une page avec quatre polices embarquées ; cinq QR décodés ; captures 1440/390 px régénérées. Le PDF conserve le titre en petites capitales dans un objet texte continu, afin qu’il reste sélectionnable et recherchable.

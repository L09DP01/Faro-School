# Audit architecture : élèves, paiements, cours et vidéos

Audit avant modification — 31 octobre 2026. Aucune connexion au Supabase distant.

## Architecture comprise
- Auth.js identifie le compte vérifié ; le client serveur Supabase signe son JWT d’accès, et les tables restent protégées par RLS. L’admin voit toutes les données ; un professeur garde uniquement ses cours et élèves, sans finances ni contacts privés.
- `profiles` contient les comptes (y compris ceux sans achat). `orders` et `payments` portent les commandes et tentatives de paiement. Seule la validation transactionnelle d’un paiement ouvre l’inscription via `enrollments`. La progression reste dans `lesson_progress`.
- `courses` → `modules` → `lessons`, avec `lessons.video_id` pointant vers Bunny Stream. Un fichier vidéo doit partir directement du navigateur vers Bunny ; le Worker ne transporte pas les gigaoctets.
- Bunny encode la vidéo, et `/api/webhooks/bunny` synchronise statut et durée dans les tables privées existantes. `/api/video/playback` vérifie les droits puis fournit une URL Bunny signée. Les ressources PDF utilisent Bunny Storage et une route de téléchargement signée ; elles ne sont pas des vidéos Stream. Le certificat PDF est encore un autre flux, généré à la demande.

## Défauts confirmés dans le code
1. `getAdminStudentsList` demande `profiles → enrollments` sans désambiguïser les deux relations `enrollments.user_id` et `enrollments.granted_by`. Une erreur de requête est ensuite masquée en tableau vide. Le calcul de progression peut également faire disparaître toute la liste en cas d’échec.
2. Les paiements dépendent exclusivement de RPC historiques ; toute erreur est convertie en liste vide / statistiques à zéro. Impossible de distinguer absence de paiement et dysfonctionnement depuis l’interface. La cause précise dans la base distante n’est pas affirmée sans ses journaux.
3. La liste des cours dépend d’une ancienne RPC qui ne retourne pas `instructor_id`; son secours masque aussi les erreurs.
4. `handleVideoUpload` ne choisit aucun fichier et simule une progression par temporisation, puis invente une durée de 720 secondes. La route d’initialisation renvoie même un identifiant mock si les clés Bunny manquent, sans restriction de production.
5. L’URL retournée pour l’upload est un endpoint vidéo ordinaire, alors que l’autorisation calculée est celle de TUS. Aucun transfert des octets n’est réalisé.
6. Le contrôle de lecture et celui des téléchargements ne filtrent pas explicitement les inscriptions révoquées. Les garde-fous doivent être vérifiés sans ouvrir l’accès public aux vidéos privées.

Les corrections suivront ces contrats existants ; aucun faux compte/paiement/vidéo ne doit être ajouté pour remplir les écrans.

## Correctifs livrés
- Jointure élèves désambiguïsée (`enrollments!user_id`) ; tous les profils étudiants restent visibles pour l’admin, même sans achat. Un calcul de progression indisponible n’efface plus les comptes ; sa valeur est affichée comme inconnue.
- Paiements : secours de lecture des vraies tables lorsque les anciennes RPC sont indisponibles, sous RLS. Les erreurs deviennent un état de panne explicite, jamais un faux registre vide ou un chiffre mesuré à zéro. Aucune transaction n’est inventée à partir d’une commande sans paiement.
- Cours : lecture directe incluant l’auteur, brouillons et cours publiés ; aucun filtre d’auteur imposé à l’admin. Les professeurs restent limités à leurs cours et ne sélectionnent pas les données financières.
- Envoi réel : sélecteur de fichier, validation vidéo ≤2 Go, TUS direct Bunny par blocs, progression fondée sur les octets acceptés et reprise depuis l’offset confirmé. Aucun fichier lourd ne traverse le Worker, aucune clé Stream n’est envoyée au navigateur. La vidéo précédente est conservée en cas d’échec ; aucune durée de 720 s n’est inventée.
- L’initialisation exige un compte vérifié et `can(course.manage)`, avec propriété vérifiée pour un cours existant. Pas de vidéo mock en production, même si Bunny manque.
- Sauvegarde : chaque erreur modules/leçons/ressources est contrôlée. Le cours reste en brouillon jusqu’à la fin ; son identifiant est conservé pour réessayer sans créer un nouveau cours à chaque échec. Ce flux ne constitue pas une transaction SQL globale : un brouillon partiellement enregistré peut subsister et doit être repris.
- CSP : seuls les hôtes Bunny nécessaires sont ajoutés pour le transfert et le lecteur. Lecture de l’auteur autorisée, inscriptions révoquées refusées pour les vidéos et documents, signatures privées sans clé de secours fictive.

## Migrations appliquées par le propriétaire
- `20261031140500_admin_curriculum_write_access.sql` : grants minimaux d’écriture et politiques restrictives pour auteur/admin vérifié non banni. SHA-256 local : `FB74ABA3AF54C1E8976398746C00F7CDC865B850122768A5F65138210B4C0F39`.
- `20261102021604_legacy_admin_reporting_rls.sql` : les anciennes RPC de reporting deviennent SECURITY INVOKER et ne contournent plus les RLS. Accès anonyme révoqué. SHA-256 local : `A3A930BFFF450B2AB2FF1358415FF1AF0E0E620BD8127978FCB7ED545F37460B`.
Les deux applications ont été confirmées par le propriétaire ; aucune commande ni requête Supabase distante exécutée par l’agent.

## Tests
40 suites réussies, dont tests PostgreSQL locaux des droits d’auteur et de la séparation financière, erreurs de lecture, permissions d’initialisation, véritables octets TUS avec prestataire simulé, reprise après perte réseau, sauvegarde échouée puis réussie. TypeScript et lint validés, build de production OpenNext réussi.

Le navigateur local monte le véritable éditeur : sélection d’un fichier, envoi des octets, association et sauvegarde de l’identifiant, durée à zéro en attendant le prestataire, vidéo précédente conservée après échec du remplacement. Serveur reproductible : `node scripts/course-upload-visual-server.mjs`, puis `tests/course_upload_browser.py` avec le runtime Python Playwright. Le fichier et les réponses Bunny y sont simulés ; l’essai prestataire réel est documenté séparément dans `docs/BUNNY_LIVE_TEST.md`.

## Vérifications opérationnelles
Sur le site déployé : vérifier les listes avec le compte admin, choisir sa vraie vidéo dans une leçon, attendre la fin du transfert, enregistrer le cours, puis vérifier la lecture et la durée après l’événement Bunny. Les PDF restent des ressources distinctes : ce bouton vidéo ne les téléverse pas. Les vidéos sont lues en streaming protégé ; ce changement n’ajoute pas de téléchargement vidéo hors ligne dans la PWA.

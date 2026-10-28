-- Seed file for Faro School
-- 6 Published Courses with 3 modules and lessons each

DO $$
DECLARE
  c1_id UUID := gen_random_uuid();
  c2_id UUID := gen_random_uuid();
  c3_id UUID := gen_random_uuid();
  c4_id UUID := gen_random_uuid();
  c5_id UUID := gen_random_uuid();
  c6_id UUID := gen_random_uuid();

  m_id UUID;
BEGIN
  -- Course 1: Marketing Digital
  INSERT INTO public.courses (id, slug, title_fr, title_ht, description_fr, description_ht, price_htg, compare_price_htg, level, category, cover_url, status)
  VALUES (
    c1_id,
    'marketing-digital',
    'Marketing Digital pour Entreprises en Haïti',
    'Maketing Dijital pou Biznis an Ayiti',
    'Apprenez à développer votre clientèle sur Facebook, WhatsApp et Instagram avec des stratégies adaptées au marché haïtien.',
    'Aprann devlope kliyantèl ou sou Facebook, WhatsApp ak Instagram ak estrateji ki adapte pou mache ayisyen an.',
    3500,
    5000,
    'débutant',
    'marketing',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
    'published'
  );

  -- Modules & Lessons for Course 1
  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c1_id, 1, 'Fondations du Marketing en Ligne', 'Baz Maketing sou Entènèt');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Introduction au marché numérique haïtien', 'Entwodiksyon sou mache nimerik ayisyen an', 'mock_vid_101', 720, TRUE, 'Vue globale des opportunités', 'Apèsi sou opòtinite yo'),
    (m_id, 2, 'Définir sa cible et son offre', 'Defini sib ou ak òf ou', 'mock_vid_102', 900, FALSE, 'Identifier vos clients idéaux', 'Idantifye kliyan ideyal ou');

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c1_id, 2, 'Facebook & Instagram Ads', 'Piblisite Facebook ak Instagram');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Configurer le Meta Business Suite', 'Konfigire Meta Business Suite', 'mock_vid_103', 1100, FALSE, 'Guide pas à pas', 'Gid etap pa etap'),
    (m_id, 2, 'Créer des publicités qui convertissent', 'Kreye reklam ki vann', 'mock_vid_104', 1250, FALSE, 'Copywriting et visuels', 'Tèks ak vizyèl ki atire');

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c1_id, 3, 'Vente sur WhatsApp Business', 'Vann sou WhatsApp Business');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Catalogue et messages automatisés', 'Katalòg ak mesaj otomatik', 'mock_vid_105', 850, FALSE, 'Gagner du temps avec les clients', 'Ekonomize tan ak kliyan yo'),
    (m_id, 2, 'Clôturer la vente avec MonCash/NatCash', 'Fèmen vant lan ak MonCash/NatCash', 'mock_vid_106', 960, FALSE, 'Paiements directs et confirmation', 'Peman dirèk ak konfimasyon');


  -- Course 2: Excel pour Entreprise
  INSERT INTO public.courses (id, slug, title_fr, title_ht, description_fr, description_ht, price_htg, compare_price_htg, level, category, cover_url, status)
  VALUES (
    c2_id,
    'excel-pour-entreprise',
    'Excel pour Entreprise : de Zéro à Avancé',
    'Excel pou Biznis : Depi nan Kòmansman rive nan Nivo Avanse',
    'Maîtrisez les formules, tableaux croisés dynamiques et tableaux de bord financiers pour gérer efficacement votre entreprise.',
    'Mete men sou fòmil yo, tablo kwaze dinamik ak tablo jesyon finansye pou jere biznis ou pi byen.',
    4000,
    6000,
    'intermédiaire',
    'bureautique',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
    'published'
  );

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c2_id, 1, 'Prise en main et automatisation des calculs', 'Pran men ak otomatizasyon kalkil yo');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Interface et raccourcis indispensables', 'Entèfas ak rakousi esansyèl', 'mock_vid_201', 600, TRUE, 'Gagner en rapidité', 'Ale pi vit sou lojisyèl la'),
    (m_id, 2, 'Les formules mathématiques et logiques (SI, SOMME.SI)', 'Fòmil matematik ak lojik (SI, SOMME.SI)', 'mock_vid_202', 1200, FALSE, 'Automatiser les vérifications', 'Otomatize verifikasyon');

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c2_id, 2, 'Gestion de données et recherche (RECHERCHEV/XLOOKUP)', 'Jesyon done ak rechèch (RECHERCHEV/XLOOKUP)');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Nettoyer et structurer une base de données', 'Netwaye epi estriktire baz done', 'mock_vid_203', 1050, FALSE, 'Bonnes pratiques', 'Bon pratik pou done pwòp'),
    (m_id, 2, 'Formules de recherche avancées', 'Fòmil rechèch avanse', 'mock_vid_204', 1150, FALSE, 'Croiser les tables clients et ventes', 'Kwale tablo kliyan ak lavant');

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c2_id, 3, 'Tableaux de bord et rapports dynamiques', 'Tablo de bò ak rapò dinamik');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Tableaux Croisés Dynamiques (TCD)', 'Tablo Kwaze Dinamik (TCD)', 'mock_vid_205', 1300, FALSE, 'Synthèse rapide des ventes', 'Rezime lavant yo rapidman'),
    (m_id, 2, 'Créer un dashboard financier professionnel', 'Kreye yon bèl tablo de bò finansye', 'mock_vid_206', 1500, FALSE, 'Graphiques et segments interactifs', 'Grafik ak bouton entèraktif');


  -- Course 3: Comptabilité Pratique
  INSERT INTO public.courses (id, slug, title_fr, title_ht, description_fr, description_ht, price_htg, compare_price_htg, level, category, cover_url, status)
  VALUES (
    c3_id,
    'comptabilite-pratique',
    'Comptabilité Pratique pour PME et Indépendants',
    'Kontablite Pratik pou Ti Biznis ak Travayè Endepandan',
    'Tenez vos livres de comptes, suivez votre trésorerie et préparez vos déclarations fiscales en toute conformité.',
    'Kenbe liv kont ou, swiv lajan ki antre ak soti, epi prepare deklarasyon taks ou san tèt chaje.',
    4500,
    6500,
    'débutant',
    'finance',
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
    'published'
  );

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c3_id, 1, 'Principes comptables de base', 'Prensip debaz kontablite');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Actif, Passif et Capitaux Propres', 'Aktif, Pasif ak Kapital Pwòp', 'mock_vid_301', 800, TRUE, 'Comprendre le bilan', 'Konprann bilan an'),
    (m_id, 2, 'Le débit et le crédit sans stress', 'Debi ak kredi san strès', 'mock_vid_302', 950, FALSE, 'Le fonctionnement des comptes', 'Kijan kont yo mache');

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c3_id, 2, 'Gestion quotidienne de trésorerie', 'Jesyon lajan kach chak jou');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Journal des recettes et dépenses', 'Jounal kòb ki rantre ak sa k soti', 'mock_vid_303', 1000, FALSE, 'Rapprochement bancaire et caisse', 'Rapprochement labank ak kès'),
    (m_id, 2, 'Gérer les comptes MonCash et NatCash en comptabilité', 'Jere kont MonCash ak NatCash nan kontablite', 'mock_vid_304', 900, FALSE, 'Intégration mobile money', 'Entegre peman mobil');

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c3_id, 3, 'Fiscalité et obligations légales en Haïti', 'Fiskalite ak obligasyon legal an Ayiti');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'TCA et acomptes provisionnels', 'TCA ak akont previzyone', 'mock_vid_305', 1200, FALSE, 'Calculs et déclarations', 'Kalkil ak deklarasyon DGI'),
    (m_id, 2, 'Clôture annuelle et états financiers', 'Kloure ane a ak eta finansye', 'mock_vid_306', 1400, FALSE, 'Préparer les comptes de fin d exercice', 'Prepare rapò fen ane');


  -- Course 4: Créer du Contenu Vidéo
  INSERT INTO public.courses (id, slug, title_fr, title_ht, description_fr, description_ht, price_htg, compare_price_htg, level, category, cover_url, status)
  VALUES (
    c4_id,
    'creer-du-contenu-video',
    'Créer du Contenu Vidéo avec son Smartphone',
    'Kreye Kontni Videyo ak Telefòn Ou',
    'Tournez et montez des vidéos professionnelles avec votre téléphone pour TikTok, Instagram Reels et YouTube.',
    'Fime epi monte bèl videyo pwofesyonèl ak telefòn ou pou TikTok, Instagram ak YouTube.',
    3000,
    4500,
    'tous niveaux',
    'création',
    'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800',
    'published'
  );

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c4_id, 1, 'Équipement et tournage mobile', 'Ekipman ak fime ak telefòn');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Maîtriser l éclairage naturel et artificiel', 'Mete men sou ekleraj natirèl ak atifisyèl', 'mock_vid_401', 650, TRUE, 'Éclairer sans dépenser une fortune', 'Klere san depanse twòp lajan'),
    (m_id, 2, 'La prise de son claire pour smartphone', 'Pran bon son klè sou telefòn', 'mock_vid_402', 780, FALSE, 'Micros cravates et filtres anti-bruit', 'Mikwo kravat ak retire bri');

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c4_id, 2, 'Montage rapide sur CapCut', 'Montaj rapid sou CapCut');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Rythme, coupes et sous-titres animés', 'Ritm, koupe ak soutit anime', 'mock_vid_403', 950, FALSE, 'Captiver dès les 3 premières secondes', 'Kenbe moun nan depi premye 3 segonn yo'),
    (m_id, 2, 'Transitions et effets sonores percutants', 'Tranzisyon ak bwi efikas', 'mock_vid_404', 890, FALSE, 'Donner un style professionnel', 'Bay videyo a yon stil pwofesyonèl');

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c4_id, 3, 'Stratégie de publication et viralité', 'Estrateji piblikasyon ak fè videyo a mache');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Trouver des idées de contenu infinies', 'Jwenn lide kontni san rete', 'mock_vid_405', 700, FALSE, 'Méthode de recherche de sujets', 'Metòd pou jwenn sijè enteresan'),
    (m_id, 2, 'Optimiser le titre, la miniature et les hashtags', 'Byen chwazi tit, kouvèti ak hashtag yo', 'mock_vid_406', 820, FALSE, 'Maximiser la portée', 'Fè anpil moun wè videyo a');


  -- Course 5: Entrepreneuriat Haïti
  INSERT INTO public.courses (id, slug, title_fr, title_ht, description_fr, description_ht, price_htg, compare_price_htg, level, category, cover_url, status)
  VALUES (
    c5_id,
    'entrepreneuriat-haiti',
    'Lancer et Gérer son Entreprise en Haïti',
    'Lanse epi Jere Biznis Ou an Ayiti',
    'De l idée au premier client : formalisation, gestion de crise, approvisionnement et développement commercial durable.',
    'Depi nan lide rive sou premye kliyan: anrejistreman biznis, jesyon kriz, estòk ak kwasans dirab.',
    5000,
    7500,
    'tous niveaux',
    'business',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800',
    'published'
  );

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c5_id, 1, 'Idée, validation et plan d affaires', 'Lide, validasyon ak plan biznis');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Tester son produit sur le marché sans budget', 'Teste pwodui ou sou mache a san depanse', 'mock_vid_501', 900, TRUE, 'Validation rapide d idée', 'Valide lide a vit devan kliyan'),
    (m_id, 2, 'Établir un plan financier réaliste', 'Fè yon plan finansye ki reyalis', 'mock_vid_502', 1100, FALSE, 'Calculer le point mort', 'Kalkile pwen kote w pa fè pèt');

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c5_id, 2, 'Formalisation et cadre légal (MCI, DGI)', 'Enskripsyon legal (MCI, DGI)');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Choisir son statut : Nom commercial vs Société', 'Chwazi estati: Non Komèsyal vs Sosyete', 'mock_vid_503', 1050, FALSE, 'Avantages et contraintes', 'Avantaj ak limit chak fòmil'),
    (m_id, 2, 'Démarches administratives pas à pas', 'Etap administratif yo youn apre lòt', 'mock_vid_504', 1200, FALSE, 'Enregistrement complet', 'Tout etap pou biznis ou an règ');

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c5_id, 3, 'Résilience et croissance en contexte difficile', 'Kouraj ak devlopman nan moman difisil');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Gestion des stocks et chaîne logistique locale', 'Jesyon estòk ak livrezon lokal', 'mock_vid_505', 980, FALSE, 'Éviter les ruptures', 'Pa janm rete san machandiz'),
    (m_id, 2, 'Stratégies de trésorerie en période d instabilité', 'Estrateji lajan kach lè sitiyasyon an konplike', 'mock_vid_506', 1150, FALSE, 'Protéger ses marges', 'Pwoteje pwofi biznis ou');


  -- Course 6: Anglais des Affaires
  INSERT INTO public.courses (id, slug, title_fr, title_ht, description_fr, description_ht, price_htg, compare_price_htg, level, category, cover_url, status)
  VALUES (
    c6_id,
    'anglais-des-affaires',
    'Anglais des Affaires pour Professionnels',
    'Angle Biznis pou Pwofesyonèl',
    'Communiquez avec assurance lors de vos réunions, rédigez des emails professionnels et négociez en anglais.',
    'Kominike ak konfyans nan reyinyon yo, ekri imèl pwofesyonèl epi negosye an angle.',
    3800,
    5500,
    'intermédiaire',
    'langues',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800',
    'published'
  );

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c6_id, 1, 'Emails et correspondance professionnelle', 'Imèl ak korespondans pwofesyonèl');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Structures et formules de politesse clés', 'Estrikti ak fòmil politès enpòtan yo', 'mock_vid_601', 750, TRUE, 'Rédiger des emails clairs', 'Ekri imèl klè ak presi'),
    (m_id, 2, 'Répondre à des demandes et gérer les réclamations', 'Reponn demand epi jere plent kliyan', 'mock_vid_602', 880, FALSE, 'Le ton professionnel approprié', 'Bon ton pou reponn');

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c6_id, 2, 'Participer et animer des réunions', 'Patisipe epi mennen reyinyon');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Donner son avis et intervenir poliment', 'Bay opinyon ou epi pran lapawòl jantiman', 'mock_vid_603', 920, FALSE, 'Phrases types pour réunions Zoom', 'Fraz pratik pou reyinyon sou Zoom'),
    (m_id, 2, 'Présenter des données et graphiques en anglais', 'Prezante chif ak grafik an angle', 'mock_vid_604', 1050, FALSE, 'Vocabulaire financier et commercial', 'Vokabilè finansye ak komèsyal');

  m_id := gen_random_uuid();
  INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
  VALUES (m_id, c6_id, 3, 'Négociation et partenariats internationaux', 'Negosyasyon ak patenarya entènasyonal');
  INSERT INTO public.lessons (module_id, position, title_fr, title_ht, video_id, duration_sec, is_free_preview, description_fr, description_ht)
  VALUES
    (m_id, 1, 'Exprimer un accord, un désaccord ou un compromis', 'Eksprime akò, dezakò oswa konpwomi', 'mock_vid_605', 990, FALSE, 'L art de négocier avec tact', 'Teknik pou negosye byen'),
    (m_id, 2, 'Conclure un contrat et fixer les prochaines étapes', 'Fèmen yon kontra epi fikse pwochen etap yo', 'mock_vid_606', 1100, FALSE, 'Finaliser l échange commercial', 'Fini negosyasyon an avèk siksè');

  -- Sample Coupons for Testing
  INSERT INTO public.coupons (code, percent_off, max_uses, used_count)
  VALUES ('FARO20', 20, 100, 0)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO public.coupons (code, amount_off_htg, max_uses, used_count)
  VALUES ('BIENVENUE500', 500, 100, 0)
  ON CONFLICT (code) DO NOTHING;

END $$;

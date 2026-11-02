-- Repair undefined enrollment expiry column. Access is active until revoked.
-- Replaces functions only; no data changes and no new columns or grants.
BEGIN;
-- Public projection only: no email, phone, payment rows, credentials or private course summaries.
CREATE OR REPLACE FUNCTION public.course_public_facts(p_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF coalesce(array_length(p_ids,1),0)>100 THEN RAISE EXCEPTION 'too_many_courses'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'courseId',c.id,
  'studentsCount',(SELECT count(*) FROM enrollments e WHERE e.course_id=c.id AND e.revoked_at IS NULL),
  'reviewsCount',(SELECT count(*) FROM (
    SELECT DISTINCT r.user_id FROM reviews r JOIN profiles p ON p.id=r.user_id
    WHERE r.course_id=c.id AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL
    AND EXISTS(SELECT 1 FROM enrollments e WHERE e.user_id=r.user_id AND e.course_id=c.id AND e.revoked_at IS NULL)
  )v),
  'averageRating',(SELECT round(avg(v.rating),1) FROM (
    SELECT DISTINCT ON(r.user_id) r.rating FROM reviews r JOIN profiles p ON p.id=r.user_id
    WHERE r.course_id=c.id AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL
    AND EXISTS(SELECT 1 FROM enrollments e WHERE e.user_id=r.user_id AND e.course_id=c.id AND e.revoked_at IS NULL)
    ORDER BY r.user_id,r.created_at DESC,r.id
  )v),
  'reviews',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'authorName',v.full_name,'rating',v.rating,'comment',v.comment,'createdAt',v.created_at,'verified',true) ORDER BY v.created_at DESC),'[]'::jsonb) FROM (
    SELECT * FROM (SELECT DISTINCT ON(r.user_id) r.id,r.rating,r.comment,r.created_at,p.full_name FROM reviews r JOIN profiles p ON p.id=r.user_id
    WHERE r.course_id=c.id AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL
    AND EXISTS(SELECT 1 FROM enrollments e WHERE e.user_id=r.user_id AND e.course_id=c.id AND e.revoked_at IS NULL)
    ORDER BY r.user_id,r.created_at DESC,r.id)latest ORDER BY created_at DESC LIMIT 20
  )v),
  'instructor',(SELECT jsonb_build_object('fullName',p.full_name,'avatarUrl',p.avatar_url,'title',coalesce(i.title,''),'bio',coalesce(i.bio,''))
    FROM profiles p LEFT JOIN instructors i ON i.profile_id=p.id
    WHERE p.id=c.instructor_id AND p.role IN('instructor','admin') AND p.banned_at IS NULL)
 )),'[]'::jsonb) INTO result FROM courses c WHERE c.id=ANY(p_ids) AND c.status='published';
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.course_public_facts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_public_facts(uuid[]) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.save_public_author_profile(p_full_name text,p_title text,p_bio text,p_avatar_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role IN('admin','instructor') AND email_verified_at IS NOT NULL AND banned_at IS NULL) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(trim(p_full_name)) NOT BETWEEN 2 AND 60 OR length(p_title)>120 OR length(p_bio)>3000 OR length(p_avatar_url)>2048
 OR (p_avatar_url<>'' AND p_avatar_url !~ '^(/api/covers/[a-f0-9-]+\.(png|jpg|webp)$|https://[^[:space:]]+$)') THEN RAISE EXCEPTION 'invalid_profile'; END IF;
 UPDATE profiles SET full_name=trim(p_full_name),avatar_url=nullif(p_avatar_url,'') WHERE id=auth.uid();
 INSERT INTO instructors(profile_id,title,bio) VALUES(auth.uid(),trim(p_title),trim(p_bio))
 ON CONFLICT(profile_id) DO UPDATE SET title=excluded.title,bio=excluded.bio,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.save_public_author_profile(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_public_author_profile(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_course_review(p_course uuid,p_rating integer,p_comment text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE review_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles p JOIN enrollments e ON e.user_id=p.id JOIN courses c ON c.id=e.course_id
  WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND c.id=p_course AND c.status='published'
  AND e.revoked_at IS NULL) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_rating NOT BETWEEN 1 AND 5 OR p_rating IS NULL OR p_comment IS NULL OR length(trim(p_comment)) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'invalid_review'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_course::text,0));
 SELECT id INTO review_id FROM reviews WHERE user_id=auth.uid() AND course_id=p_course ORDER BY created_at DESC,id LIMIT 1;
 IF review_id IS NULL THEN
  INSERT INTO reviews(user_id,course_id,rating,comment) VALUES(auth.uid(),p_course,p_rating,trim(p_comment)) RETURNING id INTO review_id;
 ELSE UPDATE reviews SET rating=p_rating,comment=trim(p_comment) WHERE id=review_id; END IF;
 RETURN review_id;
END $$;
REVOKE ALL ON FUNCTION public.save_course_review(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_course_review(uuid,integer,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

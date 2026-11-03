BEGIN;
-- Resolution is terminal for this support thread. Existing history remains readable.
CREATE OR REPLACE FUNCTION public.set_conversation_control(p_conversation uuid,p_control text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c conversations; actor profiles;
BEGIN
 SELECT * INTO actor FROM profiles WHERE id=auth.uid();
 SELECT * INTO c FROM conversations WHERE id=p_conversation FOR UPDATE;
 IF actor.id IS NULL OR actor.email_verified_at IS NULL OR actor.banned_at IS NOT NULL
 OR actor.role NOT IN('instructor','admin') OR c.id IS NULL
 OR NOT(c.staff_id=actor.id OR(c.course_id IS NULL AND actor.role='admin'))
 OR p_control NOT IN('human','ai','closed') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF c.status='closed' THEN
  IF p_control='closed' THEN RETURN; END IF;
  RAISE EXCEPTION 'conversation_closed';
 END IF;
 IF p_control='ai' AND c.course_id IS NULL THEN RAISE EXCEPTION 'support_ticket_requires_resolution'; END IF;
 IF c.course_id IS NULL AND p_control='closed' THEN
  -- Close first: escalation and message triggers cannot return this thread to AI.
  UPDATE conversations SET status='closed',assistance_mode='AI_RESUMED',assistance_epoch=assistance_epoch+1 WHERE id=c.id;
  UPDATE escalations SET resolved_at=now() WHERE conversation_id=c.id AND resolved_at IS NULL;
  INSERT INTO messages(conversation_id,sender_type,body,meta)VALUES(c.id,'system',
   CASE WHEN actor.locale='ht' THEN 'Tikè a rezoud epi fèmen. Istorik la rete disponib pou li.' ELSE 'Ticket résolu et clôturé. L’historique reste disponible en lecture seule.' END,
   jsonb_build_object('ticketClosed',true,'closedBy',actor.id));
 ELSE
  UPDATE conversations SET staff_id=CASE WHEN c.course_id IS NULL THEN actor.id ELSE staff_id END,
   status=CASE p_control WHEN 'human' THEN 'staff_replied' WHEN 'ai' THEN 'ai_handling' ELSE 'closed' END WHERE id=c.id;
  IF c.course_id IS NOT NULL AND p_control IN('human','closed') THEN
   UPDATE escalations SET resolved_at=now() WHERE conversation_id=c.id AND resolved_at IS NULL;
  END IF;
 END IF;
 IF actor.role='admin' THEN INSERT INTO admin_audit_logs(admin_id,action,target_id,reason)
 VALUES(actor.id,'conversation_'||p_control,c.id::text,'Explicit staff control'); END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_conversation_control(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_conversation_control(uuid,text) TO authenticated;

-- Repair only earlier resolutions with no subsequent student, staff or AI message.
-- Active tickets and conversations that continued after a resolution are untouched.
WITH previous_resolution AS (
 SELECT c.id,max(m.created_at) AS resolved_notice_at
 FROM conversations c JOIN messages m ON m.conversation_id=c.id
 WHERE c.course_id IS NULL AND c.status<>'closed' AND c.assistance_mode='AI_RESUMED'
 AND m.sender_type='system' AND m.body IN(
  'Ticket résolu. L’historique est conservé. L’assistant IA est de nouveau disponible.',
  'Tikè a rezoud. Istorik la konsève. Asistan IA a disponib ankò.')
 AND EXISTS(SELECT 1 FROM escalations e WHERE e.conversation_id=c.id AND e.resolved_at IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM escalations e WHERE e.conversation_id=c.id AND e.resolved_at IS NULL)
 GROUP BY c.id
), repaired AS (
 UPDATE conversations c SET status='closed',assistance_epoch=c.assistance_epoch+1
 FROM previous_resolution r WHERE c.id=r.id
 AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND m.sender_type<>'system' AND m.created_at>r.resolved_notice_at)
 RETURNING c.id,c.student_id
)
INSERT INTO messages(conversation_id,sender_type,body,meta)
 SELECT r.id,'system',CASE WHEN p.locale='ht' THEN 'Tikè ki te rezoud la fèmen. Istorik la rete disponib pou li.' ELSE 'Le ticket précédemment résolu est clôturé. L’historique reste disponible en lecture seule.' END,
 jsonb_build_object('ticketClosed',true,'closureReason','previous_resolution')
 FROM repaired r JOIN profiles p ON p.id=r.student_id;

-- Revalidate only the untouched official seed; preserve every customized article.
INSERT INTO support_knowledge_versions(article_id,revision,snapshot)
 SELECT id,revision,to_jsonb(a) FROM support_knowledge_articles a WHERE slug='support' AND revision=1 AND system_version='support-kb-v1' AND content->>'conditions'='Pendant un ticket actif, l’IA s’arrête et l’élève peut continuer à écrire au support humain. Résoudre le ticket autorise la reprise de l’IA. Les conversations et leurs messages ne sont pas supprimés.' ON CONFLICT DO NOTHING;
UPDATE support_knowledge_articles SET content=jsonb_set(content,'{conditions}','"Pendant un ticket actif, l’IA s’arrête et l’élève peut continuer à écrire au support humain. Résoudre le ticket clôture définitivement cette discussion. Son historique reste consultable en lecture seule. Une nouvelle demande utilise une nouvelle conversation ; un ticket clôturé ne se rouvre pas."'::jsonb),source_refs='["src/app/actions/private-messaging.ts", "supabase/migrations/20261103020000_close_resolved_support_tickets.sql"]'::jsonb,revision=revision+1,reviewed_at=now(),updated_at=now() WHERE slug='support' AND revision=1 AND system_version='support-kb-v1' AND content->>'conditions'='Pendant un ticket actif, l’IA s’arrête et l’élève peut continuer à écrire au support humain. Résoudre le ticket autorise la reprise de l’IA. Les conversations et leurs messages ne sont pas supprimés.';
NOTIFY pgrst,'reload schema';
COMMIT;

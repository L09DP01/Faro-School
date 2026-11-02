BEGIN;
CREATE OR REPLACE FUNCTION public.queue_assistant_handoff(p_actor uuid,p_conversation uuid,p_message uuid,p_reason text,p_notice text,p_meta jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE c conversations; actor profiles; pending uuid; email_id uuid; escalation_id uuid:=gen_random_uuid(); ticket_number text; ticket_notice text;
BEGIN
 SELECT * INTO actor FROM profiles WHERE id=p_actor;
 IF actor.id IS NULL OR actor.email_verified_at IS NULL OR actor.banned_at IS NOT NULL OR(actor.muted_until IS NOT NULL AND actor.muted_until>now()) THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO c FROM conversations WHERE id=p_conversation FOR UPDATE;
 IF c.id IS NULL OR c.student_id<>p_actor OR c.status='closed' THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF c.status='staff_replied' AND EXISTS(SELECT 1 FROM profiles WHERE id=c.staff_id AND staff_available AND last_seen_at>now()-interval '90 seconds') THEN RETURN jsonb_build_object('created',false); END IF;
 IF NOT EXISTS(SELECT 1 FROM messages WHERE id=p_message AND conversation_id=c.id AND sender_id=p_actor AND sender_type='student') THEN RAISE EXCEPTION 'message_missing'; END IF;
 IF c.course_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM enrollments WHERE user_id=p_actor AND course_id=c.course_id AND revoked_at IS NULL) THEN RAISE EXCEPTION 'not_enrolled'; END IF;
 SELECT id INTO pending FROM escalations WHERE conversation_id=c.id AND resolved_at IS NULL LIMIT 1;
 IF pending IS NOT NULL THEN UPDATE conversations SET status='waiting_staff' WHERE id=c.id;RETURN jsonb_build_object('created',false); END IF;
 IF c.course_id IS NULL AND coalesce(p_meta->>'supportTicketRequested','false')<>'true' THEN RAISE EXCEPTION 'explicit_ticket_request_required'; END IF;
 ticket_number:='FARO-SUP-'||upper(replace(escalation_id::text,'-',''));
 ticket_notice:=CASE WHEN c.course_id IS NOT NULL THEN left(p_notice,4000) WHEN actor.locale='ht' THEN 'Tikè sipò '||ticket_number||' kreye. Yon administratè avèti. Saisie a an poz pandan w ap tann repons li.' ELSE 'Ticket support '||ticket_number||' créé. Un administrateur est averti. La saisie est suspendue en attendant sa réponse.' END;
 email_id:=queue_instructor_escalation(p_actor,c.id,p_message,escalation_id,left(CASE WHEN c.course_id IS NULL THEN ticket_number||' — ' ELSE '' END||p_reason,500),NULL);
 INSERT INTO messages(conversation_id,sender_type,sender_id,body,meta)VALUES(c.id,'system',NULL,ticket_notice,p_meta||CASE WHEN c.course_id IS NULL THEN jsonb_build_object('ticketNumber',ticket_number,'ticketCreated',true) ELSE '{}'::jsonb END);
 IF c.course_id IS NULL THEN
  INSERT INTO notifications(user_id,type,payload)VALUES(c.staff_id,'student_message',jsonb_build_object('conversationId',c.id,'ticketNumber',ticket_number,'ticketCreated',true));
  UPDATE email_outbox SET data=jsonb_set(data,'{detail}',to_jsonb(ticket_number||E'\n\n'||coalesce(data->>'detail',''))) WHERE id=email_id;
 END IF;
 UPDATE conversations SET status='waiting_staff' WHERE id=c.id;
 RETURN jsonb_build_object('created',true,'email_id',email_id);
END $$;
REVOKE ALL ON FUNCTION public.queue_assistant_handoff(uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_assistant_handoff(uuid,uuid,uuid,text,text,jsonb) TO service_role;

-- Repair only orphan waiting states; preserve real unresolved requests.
UPDATE conversations c SET status='ai_handling' WHERE c.course_id IS NULL AND c.status='waiting_staff' AND NOT EXISTS(SELECT 1 FROM escalations e WHERE e.conversation_id=c.id AND e.resolved_at IS NULL);
-- Existing real escalations also need a visible reference; no new ticket or email.
INSERT INTO messages(conversation_id,sender_type,sender_id,body,meta)
SELECT c.id,'system',NULL,CASE WHEN p.locale='ht' THEN 'Tikè sipò ' ELSE 'Ticket support ' END||'FARO-SUP-'||upper(replace(e.id::text,'-',''))||CASE WHEN p.locale='ht' THEN ' ap tann yon administratè.' ELSE ' en attente d’un administrateur.' END,jsonb_build_object('ticketCreated',true,'ticketNumber','FARO-SUP-'||upper(replace(e.id::text,'-','')))
FROM escalations e JOIN conversations c ON c.id=e.conversation_id JOIN profiles p ON p.id=c.student_id
WHERE c.course_id IS NULL AND c.status<>'closed' AND e.resolved_at IS NULL AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND m.meta->>'ticketNumber'='FARO-SUP-'||upper(replace(e.id::text,'-','')));

NOTIFY pgrst,'reload schema';
COMMIT;

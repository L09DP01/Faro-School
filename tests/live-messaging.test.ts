import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
async function main(){
const db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
CREATE TABLE profiles(id uuid PRIMARY KEY,role text,email_verified_at timestamptz,banned_at timestamptz);
CREATE TABLE admin_audit_logs(admin_id uuid,action text,target_id text,reason text);CREATE TABLE courses(id uuid PRIMARY KEY,instructor_id uuid);CREATE TABLE enrollments(user_id uuid,course_id uuid,revoked_at timestamptz);
CREATE TABLE conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid,staff_id uuid,course_id uuid,subject text,status text,created_at timestamptz DEFAULT now(),last_message_at timestamptz DEFAULT now());
CREATE TABLE messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid REFERENCES conversations(id),sender_id uuid,sender_type text,body text,read_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE notifications(id uuid DEFAULT gen_random_uuid(),user_id uuid,type text,payload jsonb,read_at timestamptz);
CREATE TABLE private_conversation_access_logs(admin_id uuid,conversation_id text,accessed_at timestamptz DEFAULT now());
CREATE TABLE escalations(id uuid DEFAULT gen_random_uuid(),followup_sent_at timestamptz,created_at timestamptz DEFAULT now());CREATE TABLE instructor_ai_versions(id uuid DEFAULT gen_random_uuid(),instructor_id uuid,settings jsonb,version_number integer,created_at timestamptz DEFAULT now());CREATE TABLE ai_usage(input_tokens int,output_tokens int,cost_usd numeric,created_at timestamptz DEFAULT now());
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;CREATE POLICY base_read ON messages FOR SELECT TO authenticated USING(true);CREATE POLICY base_insert ON messages FOR INSERT TO authenticated WITH CHECK(true);GRANT SELECT,INSERT,UPDATE,DELETE ON messages TO authenticated;GRANT SELECT,INSERT,UPDATE ON conversations TO authenticated;GRANT SELECT ON profiles,courses,enrollments,private_conversation_access_logs TO authenticated;`);
await db.exec(await readFile('supabase/migrations/20261031044646_admin_real_data_messaging.sql','utf8'));

await db.exec(`CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public,auth TO service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO service_role;
ALTER TABLE profiles ADD COLUMN muted_until timestamptz,ADD COLUMN last_seen_at timestamptz;
ALTER TABLE messages ADD COLUMN meta jsonb DEFAULT '{}';
ALTER TABLE escalations ADD COLUMN conversation_id uuid,ADD COLUMN resolved_at timestamptz;
CREATE TABLE community_messages(id uuid DEFAULT gen_random_uuid(),body text);ALTER TABLE community_messages ENABLE ROW LEVEL SECURITY;CREATE POLICY community_base ON community_messages FOR ALL TO authenticated USING(true)WITH CHECK(true);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;CREATE POLICY conv_base ON conversations FOR ALL TO authenticated USING(student_id=auth.uid() OR staff_id=auth.uid() OR(course_id IS NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin'))) WITH CHECK(student_id=auth.uid() OR staff_id=auth.uid() OR(course_id IS NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin')));
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;GRANT SELECT,INSERT ON community_messages TO authenticated;`);
const migration=await readFile('supabase/migrations/20261102200000_assistant_lifecycle_and_chat_suspensions.sql','utf8');await db.exec(migration);await db.exec(migration);
await db.exec(`ALTER TABLE profiles ADD COLUMN locale text DEFAULT 'fr';CREATE TABLE user_credentials(user_id uuid,token_version int);CREATE SCHEMA realtime;CREATE TABLE realtime.messages(extension text);CREATE FUNCTION realtime.topic()RETURNS text LANGUAGE sql AS $$SELECT current_setting('test.topic',true)$$;CREATE TABLE email_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),data jsonb);ALTER TABLE escalations ADD COLUMN reason text;
CREATE FUNCTION queue_instructor_escalation(a uuid,c uuid,m uuid,e uuid,r text,f text)RETURNS uuid LANGUAGE plpgsql AS $$DECLARE mail uuid:=gen_random_uuid();BEGIN INSERT INTO escalations(id,conversation_id,reason)VALUES(e,c,r);INSERT INTO email_outbox(id,data)VALUES(mail,'{}');RETURN mail;END$$;GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;`);
const upgrade=await readFile('supabase/migrations/20261102230000_live_messaging_sessions.sql','utf8');await db.exec(upgrade);await db.exec(upgrade);
const student=crypto.randomUUID(),admin=crypto.randomUUID(),other=crypto.randomUUID(),conv=crypto.randomUUID(),message=crypto.randomUUID();
for(const[id,role]of[[student,'student'],[other,'student'],[admin,'admin']]){await db.query("INSERT INTO profiles(id,role,email_verified_at,locale,staff_available)VALUES($1,$2,now(),'fr',true)",[id,role]);await db.query('INSERT INTO user_credentials VALUES($1,0)',[id]);}
await db.query("INSERT INTO conversations(id,student_id,staff_id,subject,status)VALUES($1,$2,$3,'Support','open')",[conv,student,admin]);
async function as(id:string,sql:string,args:any[]=[]){await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated');try{return await db.query<any>(sql,args);}finally{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub','',false)");}}
async function service(sql:string,args:any[]=[]){await db.exec('SET ROLE service_role');try{return await db.query<any>(sql,args);}finally{await db.exec('RESET ROLE');}}
const online=async()=>(await service('SELECT staff_is_online($1) ok',[admin])).rows[0].ok;
assert.equal(await online(),false);const first=crypto.randomUUID(),second=crypto.randomUUID();
await db.query("INSERT INTO staff_presence_sessions VALUES($1,$2,0,now()+interval '45 seconds'),($1,$3,0,now()+interval '45 seconds')",[admin,first,second]);assert.equal(await online(),true);
await db.query('UPDATE staff_presence_sessions SET expires_at=now() WHERE session_id=$1',[first]);assert.equal(await online(),true,'Other session remains online');await db.query('UPDATE staff_presence_sessions SET expires_at=now() WHERE session_id=$1',[second]);assert.equal(await online(),false);
await db.query("UPDATE staff_presence_sessions SET expires_at=now()+interval '45 seconds'");await db.query('UPDATE user_credentials SET token_version=1 WHERE user_id=$1',[admin]);assert.equal(await online(),false,'Revoked sessions cannot advertise backend presence');await db.query('UPDATE user_credentials SET token_version=0 WHERE user_id=$1',[admin]);
await as(student,"INSERT INTO messages(id,conversation_id,sender_id,sender_type,body)VALUES($1,$2,$3,'student','Question')",[message,conv,student]);
await as(admin,'SELECT acknowledge_private_messages($1,false)',[conv]);let receipt=(await db.query<any>('SELECT delivered_at,read_at FROM messages WHERE id=$1',[message])).rows[0];assert(receipt.delivered_at);assert.equal(receipt.read_at,null);await as(admin,'SELECT mark_private_conversation_read($1)',[conv]);assert((await db.query<any>('SELECT read_at FROM messages WHERE id=$1',[message])).rows[0].read_at);
await assert.rejects(()=>as(other,'SELECT acknowledge_private_messages($1,true)',[conv]),/forbidden/);
const answer=async(epoch:number)=>(await service("SELECT commit_assistant_reply($1,$2,$3,'Answer',jsonb_build_object('assistanceEpoch',$4::int)) ok",[student,conv,message,epoch])).rows[0].ok;
await service("SELECT queue_assistant_handoff($1,$2,$3,'explicit','notice',jsonb_build_object('supportTicketRequested',true))",[student,conv,message]);assert.equal(await answer(0),false,'Ticket blocks in-flight AI');
await as(student,"INSERT INTO messages(conversation_id,sender_id,sender_type,body)VALUES($1,$2,'student','More details while human support works')",[conv,student]);
assert.equal((await db.query<any>('SELECT assistance_mode FROM conversations WHERE id=$1',[conv])).rows[0].assistance_mode,'HUMAN_SUPPORT');
await as(admin,"SELECT set_conversation_control($1,'human')",[conv]);assert.equal((await db.query<any>('SELECT count(*) n FROM escalations WHERE resolved_at IS NULL')).rows[0].n,1,'Staff reply does not resolve ticket');
await as(admin,"SELECT set_conversation_control($1,'closed')",[conv]);let state=(await db.query<any>('SELECT assistance_mode,assistance_epoch FROM conversations WHERE id=$1',[conv])).rows[0];assert.equal(state.assistance_mode,'AI_RESUMED');assert.equal(await answer(0),false,'Old AI remains invalid even after ticket resolves');assert.equal(await answer(Number(state.assistance_epoch)),true);
await db.query("UPDATE conversations SET status='closed' WHERE id=$1",[conv]);assert.equal((await as(student,'SELECT id FROM conversations WHERE id=$1',[conv])).rows.length,1);assert((await as(student,'SELECT id FROM messages WHERE conversation_id=$1',[conv])).rows.length>=3,'Historical messages remain readable');
await assert.rejects(()=>as(student,"UPDATE messages SET body='forged' WHERE id=$1",[message]),/permission denied/);
await db.close();console.log('PASS live messaging SQL: multi-session presence/expiry/revocation; delivered vs read; participant authorization; ticket priority and continued writing; late AI fenced after resolution; AI resumed; all closed history preserved; browser edits denied.');
}
main().catch(e=>{console.error(e);process.exitCode=1});

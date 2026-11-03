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

await db.exec('ALTER TABLE admin_audit_logs ADD COLUMN details jsonb');
const knowledge=await readFile('supabase/migrations/20261103010000_support_knowledge_and_runs.sql','utf8');await db.exec(knowledge);await db.exec(knowledge);
assert.equal((await db.query<any>('SELECT count(*) n FROM support_knowledge_articles')).rows[0].n,9);
const student=crypto.randomUUID(),other=crypto.randomUUID(),admin=crypto.randomUUID(),conv=crypto.randomUUID(),message=crypto.randomUUID(),claim=crypto.randomUUID();
for(const[id,role]of[[student,'student'],[other,'student'],[admin,'admin']])await db.query("INSERT INTO profiles(id,role,email_verified_at)VALUES($1,$2,now())",[id,role]);
await db.query("INSERT INTO conversations(id,student_id,staff_id,subject,status)VALUES($1,$2,$3,'Support','open')",[conv,student,admin]);
await db.query("INSERT INTO messages(id,conversation_id,sender_id,sender_type,body)VALUES($1,$2,$3,'student','Help')",[message,conv,student]);
async function service(sql:string,args:any[]=[]){await db.exec('SET ROLE service_role');try{return await db.query<any>(sql,args);}finally{await db.exec('RESET ROLE');}}
const reserve=async(actor:string,key:string)=>(await service('SELECT claim_support_run($1,$2,$3,0,$4) ok',[actor,conv,message,key])).rows[0].ok;
assert.equal(await reserve(other,claim),false);assert.equal(await reserve(student,claim),true);assert.equal(await reserve(student,crypto.randomUUID()),false);
assert((await service("SELECT search_support_articles('paiement',NULL) articles")).rows[0].articles.length>0);
await db.exec('SET ROLE authenticated');await assert.rejects(()=>db.query('SELECT * FROM support_knowledge_sources'),/permission denied/);await assert.rejects(()=>db.query('SELECT * FROM support_ai_runs'),/permission denied/);await db.exec('RESET ROLE');
await service("SELECT queue_assistant_handoff($1,$2,$3,'explicit','notice',jsonb_build_object('supportTicketRequested',true))",[student,conv,message]);
assert.equal((await service("SELECT finish_support_run($1,$2,$3,$4,'obsolete','{}','{}') ok",[student,conv,message,claim])).rows[0].ok,false);
assert.equal((await db.query<any>("SELECT count(*) n FROM messages WHERE sender_type='ai'")).rows[0].n,0);
assert.equal((await db.query<any>('SELECT count(*) n FROM messages WHERE id=$1',[message])).rows[0].n,1);
await db.query("UPDATE support_knowledge_articles SET visibility='admin' WHERE category='payments'");
assert.equal((await service("SELECT search_support_articles('paiement','payments') articles")).rows[0].articles.length,0);
const article=(await db.query<any>("SELECT * FROM support_knowledge_articles WHERE slug='access'")).rows[0];const update={...article,verified:true,source_version:'local-check',title:'Accès actualisé'};
await assert.rejects(()=>service('SELECT save_support_article($1,$2,$3,$4::jsonb)',[student,article.id,article.revision,JSON.stringify(update)]),/forbidden/);
await assert.rejects(()=>service('SELECT save_support_article($1,$2,$3,$4::jsonb)',[admin,article.id,article.revision,JSON.stringify({...update,verified:false})]),/review_required/);
const revised=(await service('SELECT save_support_article($1,$2,$3,$4::jsonb) article',[admin,article.id,article.revision,JSON.stringify(update)])).rows[0].article;assert.equal(revised.revision,2);
assert.equal((await db.query<any>('SELECT count(*) n FROM support_knowledge_versions WHERE article_id=$1',[article.id])).rows[0].n,1);
await assert.rejects(()=>service('SELECT save_support_article($1,$2,$3,$4::jsonb)',[admin,article.id,article.revision,JSON.stringify(update)]),/revision_conflict/);
assert.equal((await service("SELECT search_support_articles('actualisé','access') articles")).rows[0].articles[0].revision,2);
await db.close();console.log('PASS knowledge SQL: repeatable migration; real articles; private tables denied; own-conversation claims; idempotent generation; ticket fences late answer; original messages preserved; internal articles excluded.');
}
main().catch(e=>{console.error(e);process.exitCode=1});

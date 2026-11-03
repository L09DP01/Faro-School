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

await db.exec(await readFile('supabase/migrations/20261103020000_close_resolved_support_tickets.sql','utf8'));
await db.exec(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT jsonb_build_object('token_version',coalesce(nullif(current_setting('test.token_version',true),''),'0')::integer)$$;CREATE TABLE captured_live_events(payload jsonb,event text,topic text,private boolean);CREATE FUNCTION realtime.send(payload jsonb,event text,topic text,private boolean)RETURNS void LANGUAGE sql AS $$INSERT INTO captured_live_events VALUES(payload,event,topic,private)$$;ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA realtime TO authenticated;GRANT SELECT,INSERT ON realtime.messages TO authenticated;`);
const pushMigration=await readFile('supabase/migrations/20261103030000_live_message_delivery_and_push.sql','utf8');await db.exec(pushMigration);await db.exec(pushMigration);
const student=crypto.randomUUID(),other=crypto.randomUUID(),admin=crypto.randomUUID(),conv=crypto.randomUUID();
for(const[id,role]of[[student,'student'],[other,'student'],[admin,'admin']]){await db.query("INSERT INTO profiles(id,role,email_verified_at,locale)VALUES($1,$2,now(),'fr')",[id,role]);await db.query('INSERT INTO user_credentials VALUES($1,0)',[id]);}
async function as(id:string,sql:string,args:any[]=[]){await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated');try{return await db.query<any>(sql,args);}finally{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub','',false)");}}
async function service(sql:string,args:any[]=[]){await db.exec('SET ROLE service_role');try{return await db.query<any>(sql,args);}finally{await db.exec('RESET ROLE');}}
await db.query("INSERT INTO conversations(id,student_id,staff_id,subject,status)VALUES($1,$2,$3,'Support','open')",[conv,student,admin]);
for(const table of ['message_push_subscriptions','message_push_jobs'])await assert.rejects(()=>as(student,'SELECT * FROM '+table),/permission denied/);
await assert.rejects(()=>as(student,"SELECT save_message_push_subscription($1,0,'endpoint','pub','auth')",[student]),/permission denied/);
async function sub(endpoint:string){return(await service('SELECT save_message_push_subscription($1,0,$2,$3,$4) id',[student,endpoint,'pub','auth'])).rows[0].id;}
const one=await sub('https://fcm.googleapis.com/local-one'),two=await sub('https://web.push.apple.com/local-two');assert.equal(await sub('https://fcm.googleapis.com/local-one'),one);
const incoming=crypto.randomUUID();await as(admin,"INSERT INTO messages(id,conversation_id,sender_id,sender_type,body)VALUES($1,$2,$3,'staff','PRIVATE CONTENT')",[incoming,conv,admin]);
assert.equal((await db.query<any>('SELECT count(*) n FROM message_push_jobs WHERE message_id=$1',[incoming])).rows[0].n,2);
const events=(await db.query<any>('SELECT * FROM captured_live_events')).rows;assert(events.length>=3);assert(events.every(e=>e.private===true&&!JSON.stringify(e.payload).includes('PRIVATE CONTENT')));assert(events.some(e=>e.topic==='private-conv-'+conv));
await db.query("INSERT INTO realtime.messages(extension)VALUES('broadcast')");
async function topic(id:string,value:string){await db.query("SELECT set_config('test.topic',$1,false)",[value]);return(await as(id,'SELECT extension FROM realtime.messages')).rows.length;}
assert.equal(await topic(student,'private-conv-'+conv),1);assert.equal(await topic(other,'private-conv-'+conv),0);assert.equal(await topic(student,'user-inbox:'+other),0);assert.equal(await topic(admin,'support-inbox'),1);assert.equal(await topic(student,'support-inbox'),0);assert.equal(await topic(student,'private-conv-'+('-'.repeat(36))),0);
await db.query("SELECT set_config('test.topic',$1,false)",['private-conv-'+conv]);await assert.rejects(()=>as(student,"INSERT INTO realtime.messages(extension)VALUES('broadcast')"),/row-level security/);
let jobs=(await service('SELECT claim_message_push_jobs($1,20) jobs',[conv])).rows[0].jobs;assert.equal(jobs.length,2);assert.equal(jobs[0].read,false);assert.equal((await service('SELECT claim_message_push_jobs($1,20) jobs',[conv])).rows[0].jobs.length,0);
assert.equal((await service("SELECT finish_message_push_job($1,$2,'sent',NULL) ok",[jobs[0].id,crypto.randomUUID()])).rows[0].ok,false);assert.equal((await service("SELECT finish_message_push_job($1,$2,'sent',NULL) ok",[jobs[0].id,jobs[0].claimId])).rows[0].ok,true);
await as(student,'SELECT acknowledge_private_messages($1,true)',[conv]);assert.equal((await db.query<any>('SELECT count(*) n FROM message_push_jobs WHERE message_id=$1',[incoming])).rows[0].n,2,'Receipt updates do not enqueue more pushes');
const second=crypto.randomUUID();await as(admin,"INSERT INTO messages(id,conversation_id,sender_id,sender_type,body)VALUES($1,$2,$3,'staff','Next')",[second,conv,admin]);await as(student,'SELECT acknowledge_private_messages($1,true)',[conv]);jobs=(await service('SELECT claim_message_push_jobs($1,20) jobs',[conv])).rows[0].jobs;assert(jobs.every((j:any)=>j.read===true));
await service('SELECT save_message_push_subscription($1,0,$2,$3,$4)',[other,'https://fcm.googleapis.com/local-one','pub','auth']);
await db.query("UPDATE message_push_jobs SET state='pending',next_attempt_at=now(),locked_until=NULL WHERE subscription_id=$1",[one]);jobs=(await service('SELECT claim_message_push_jobs($1,20) jobs',[conv])).rows[0].jobs;assert(jobs.filter((j:any)=>j.subscriptionId===one).every((j:any)=>j.eligible===false),'A device moved to another account cannot receive the previous account notifications');
await db.query('UPDATE user_credentials SET token_version=1 WHERE user_id=$1',[student]);await assert.rejects(()=>service("SELECT save_message_push_subscription($1,0,'new','pub','auth')",[student]),/forbidden/);
assert.equal((await as(student,'SELECT id FROM messages WHERE conversation_id=$1',[conv])).rows.length,0,'Revoked JWT cannot read a message via PostgREST/Realtime');await db.query("SELECT set_config('test.token_version','1',false)");assert((await as(student,'SELECT id FROM messages WHERE conversation_id=$1',[conv])).rows.length>0);
await db.query("SELECT set_config('test.token_version','0',false)");await db.exec("CREATE OR REPLACE FUNCTION realtime.send(payload jsonb,event text,topic text,private boolean)RETURNS void LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'simulated realtime outage';END$$");const saved=crypto.randomUUID();await as(admin,"INSERT INTO messages(id,conversation_id,sender_id,sender_type,body)VALUES($1,$2,$3,'staff','Persist during socket outage')",[saved,conv,admin]);assert.equal((await db.query<any>('SELECT count(*) n FROM messages WHERE id=$1',[saved])).rows[0].n,1);
await db.close();console.log('PASS live delivery SQL: repeatable migration; no message body broadcast; participant/private channel authorization; forged broadcasts denied; private push keys inaccessible; device idempotency; per-device jobs; leased claims; read suppression; token revocation.');
}
main().catch(e=>{console.error(e);process.exitCode=1});

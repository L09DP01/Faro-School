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
const student='11111111-1111-4111-8111-111111111111',other='11111111-1111-4111-8111-111111111112',teacher='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333',course='44444444-4444-4444-8444-444444444444';
for(const[id,role]of[[student,'student'],[other,'student'],[teacher,'instructor'],[admin,'admin']])await db.query('INSERT INTO profiles(id,role,email_verified_at,staff_available,last_seen_at) VALUES($1,$2,now(),true,now())',[id,role]);
await db.query('INSERT INTO courses VALUES($1,$2)',[course,teacher]);await db.query('INSERT INTO enrollments VALUES($1,$2,NULL)',[student,course]);
async function as(id:string,sql:string,args:unknown[]=[]){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated');try{return await db.query<any>(sql,args);}finally{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub','',false)");}}
async function service(sql:string,args:unknown[]=[]){await db.exec('SET ROLE service_role');try{return await db.query<any>(sql,args);}finally{await db.exec('RESET ROLE');}}
const c=(await as(student,"INSERT INTO conversations(student_id,staff_id,course_id,subject,status)VALUES($1,$2,$3,'Course question','open')RETURNING id",[student,teacher,course])).rows[0].id;
const ticket=(await as(student,"INSERT INTO conversations(student_id,staff_id,subject,status)VALUES($1,$2,'Technical issue','open')RETURNING id",[student,admin])).rows[0].id;
const send=async(id:string)=> (await as(student,"INSERT INTO messages(conversation_id,sender_id,sender_type,body)VALUES($1,$2,'student','A question') RETURNING id",[id,student])).rows[0].id;
const answer=async(id:string,msg:string)=>(await service("SELECT commit_assistant_reply($1,$2,$3,'Real answer','{}') ok",[student,id,msg])).rows[0].ok;
for(let i=0;i<3;i++){const msg=await send(c);assert.equal(await answer(c,msg),true);assert.equal(await answer(c,msg),false,'No duplicate AI response for the same message');}
await db.query("INSERT INTO escalations(conversation_id)VALUES($1)",[c]);await db.query("UPDATE conversations SET status='waiting_staff' WHERE id=$1",[c]);assert.equal(await answer(c,await send(c)),true,'Course AI can help while a question awaits the professor');
await assert.rejects(()=>as(other,"SELECT set_conversation_control($1,'human')",[c]),/forbidden/);await assert.rejects(()=>as(admin,"SELECT set_conversation_control($1,'human')",[c]),/forbidden/);
await as(teacher,"SELECT set_conversation_control($1,'human')",[c]);const queued=await send(c);assert.equal(await answer(c,queued),false,'Takeover blocks an AI reply that returns late');
assert.equal((await db.query<any>('SELECT status FROM conversations WHERE id=$1',[c])).rows[0].status,'staff_replied','A student message must not reset human control');
await db.query("UPDATE profiles SET last_seen_at=now()-interval '2 minutes' WHERE id=$1",[teacher]);assert.equal(await answer(c,queued),true,'AI resumes while the professor is offline');
await as(teacher,"SELECT set_conversation_control($1,'closed')",[c]);assert.equal((await as(student,'SELECT id FROM conversations WHERE id=$1',[c])).rows.length,0);assert.equal((await as(student,'SELECT * FROM messages WHERE conversation_id=$1',[c])).rows.length,0);
await assert.rejects(()=>as(teacher,"UPDATE conversations SET status='open' WHERE id=$1",[c]),/conversation_closed/);
await db.query("UPDATE conversations SET status='waiting_staff' WHERE id=$1",[ticket]);await assert.rejects(()=>send(ticket),/support_ticket_waiting/);
await as(admin,"SELECT set_conversation_control($1,'human')",[ticket]);await send(ticket);await as(admin,"SELECT set_conversation_control($1,'closed')",[ticket]);
const newTicket=(await as(student,"INSERT INTO conversations(student_id,staff_id,subject,status)VALUES($1,$2,'Another issue','open')RETURNING id",[student,admin])).rows[0].id;assert.notEqual(newTicket,ticket);
await assert.rejects(()=>as(student,"INSERT INTO conversations(student_id,staff_id,subject,status)VALUES($1,$2,'Duplicate','open')",[student,admin]),/active_conversation_exists/);
await db.query("UPDATE profiles SET muted_until=now()+interval '5 minutes' WHERE id=$1",[student]);await assert.rejects(()=>send(newTicket));assert.equal((await as(student,'SELECT * FROM conversations')).rows.length,0);assert.equal((await as(student,'SELECT * FROM community_messages')).rows.length,0);assert.equal((await as(student,'SELECT * FROM courses')).rows.length,1,'Chat suspension leaves learning available');
await db.query("UPDATE profiles SET muted_until=now()-interval '1 second' WHERE id=$1",[student]);await send(newTicket);
await assert.rejects(()=>as(student,"SELECT commit_assistant_reply($1,$2,$3,'Forged','{}')",[student,newTicket,queued]),/permission denied/);
await db.close();console.log('PASS lifecycle PostgreSQL: multi-turn AI, pending-course assistance, explicit takeover and stale AI rejection, offline resumption, no closed reopening, archived student view, new independent support ticket, no duplicate active ticket, timed chat-only sanctions and service-only AI commit.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

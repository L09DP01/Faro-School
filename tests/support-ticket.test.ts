import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
async function main(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE profiles(id uuid PRIMARY KEY,role text,email_verified_at timestamptz,banned_at timestamptz,muted_until timestamptz,staff_available boolean,last_seen_at timestamptz,locale text);CREATE TABLE conversations(id uuid PRIMARY KEY,student_id uuid,staff_id uuid,course_id uuid,status text);CREATE TABLE messages(id uuid DEFAULT gen_random_uuid(),conversation_id uuid,sender_type text,sender_id uuid,body text,meta jsonb DEFAULT '{}');CREATE TABLE enrollments(user_id uuid,course_id uuid,revoked_at timestamptz);CREATE TABLE escalations(id uuid PRIMARY KEY,conversation_id uuid,resolved_at timestamptz);CREATE TABLE notifications(user_id uuid,type text,payload jsonb);CREATE TABLE email_outbox(id uuid PRIMARY KEY,data jsonb);GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
 CREATE FUNCTION queue_instructor_escalation(a uuid,c uuid,m uuid,e uuid,r text,f text) RETURNS uuid LANGUAGE plpgsql AS $$DECLARE mail uuid:=gen_random_uuid();BEGIN INSERT INTO escalations VALUES(e,c,NULL);INSERT INTO email_outbox VALUES(mail,jsonb_build_object('detail','Real request'));RETURN mail;END$$;`);
 const migration=await readFile('supabase/migrations/20261102220000_explicit_numbered_support_tickets.sql','utf8');await db.exec(migration);await db.exec(migration);
 const student=crypto.randomUUID(),admin=crypto.randomUUID(),conv=crypto.randomUUID(),msg=crypto.randomUUID();
 await db.query("INSERT INTO profiles(id,role,email_verified_at,locale) VALUES($1,'student',now(),'fr'),($2,'admin',now(),'fr')",[student,admin]);
 await db.query("INSERT INTO conversations VALUES($1,$2,$3,NULL,'ai_handling')",[conv,student,admin]);
 await db.query("INSERT INTO messages(id,conversation_id,sender_type,sender_id,body)VALUES($1,$2,'student',$3,'Bonjour')",[msg,conv,student]);
 const call=async(meta:object)=>{await db.exec('SET ROLE service_role');try{return(await db.query<any>("SELECT queue_assistant_handoff($1,$2,$3,'human','Notice',$4::jsonb) result",[student,conv,msg,JSON.stringify(meta)])).rows[0].result;}finally{await db.exec('RESET ROLE');}};
 await assert.rejects(()=>call({}),/explicit_ticket_request_required/);assert.equal((await db.query<any>('SELECT count(*) n FROM escalations')).rows[0].n,0);
 await call({supportTicketRequested:true});
 const notice=(await db.query<any>("SELECT body,meta FROM messages WHERE sender_type='system'")).rows[0];
 assert.match(notice.meta.ticketNumber,/^FARO-SUP-[A-F0-9]{32}$/);assert(notice.body.includes(notice.meta.ticketNumber));assert.match(notice.body,/administrateur/);
 assert.equal((await db.query<any>("SELECT payload FROM notifications WHERE user_id=$1",[admin])).rows[0].payload.ticketNumber,notice.meta.ticketNumber);
 assert((await db.query<any>('SELECT data FROM email_outbox')).rows[0].data.detail.includes(notice.meta.ticketNumber));
 await call({supportTicketRequested:true});assert.equal((await db.query<any>('SELECT count(*) n FROM escalations')).rows[0].n,1);assert.equal((await db.query<any>('SELECT count(*) n FROM email_outbox')).rows[0].n,1);
 await db.exec(migration);assert.equal((await db.query<any>("SELECT count(*) n FROM messages WHERE meta->>'ticketCreated'='true'")).rows[0].n,1);
 await db.exec('SET ROLE authenticated');await assert.rejects(()=>db.query("SELECT queue_assistant_handoff($1,$2,$3,'forged','notice','{}')",[student,conv,msg]),/permission denied/);await db.exec('RESET ROLE');
 await db.close();console.log('PASS isolated PostgreSQL tickets: explicit request, visible unique reference, admin alert, numbered email, idempotency, repeated migration and browser denial; no remote data');
}
main().catch(e=>{console.error(e);process.exitCode=1});

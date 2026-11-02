import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
async function main(){
 const db=new PGlite();await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('app.user',true),'')::uuid$$; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
 CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text,email text,phone text,role text,email_verified_at timestamptz,banned_at timestamptz,avatar_url text);
 CREATE TABLE instructors(profile_id uuid PRIMARY KEY REFERENCES profiles(id),title text DEFAULT '',bio text DEFAULT '',updated_at timestamptz DEFAULT now());
 CREATE TABLE courses(id uuid PRIMARY KEY,instructor_id uuid,status text);
 CREATE TABLE enrollments(id uuid DEFAULT gen_random_uuid(),user_id uuid,course_id uuid,revoked_at timestamptz);
 CREATE TABLE reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,course_id uuid,rating int,comment text,created_at timestamptz DEFAULT now());
 ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;ALTER TABLE courses ENABLE ROW LEVEL SECURITY;ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;`);
 await db.exec(await readFile('supabase/migrations/20261102160000_public_course_facts_and_author_profile.sql','utf8'));
 // Reproduce the production failure against the actual schema, then apply the additive repair.
 await assert.rejects(()=>db.query('SELECT course_public_facts(ARRAY[]::uuid[])'),/expires_at/);
 await db.exec(await readFile('supabase/migrations/20261102180000_repair_course_facts_enrollment_schema.sql','utf8'));
 // The repair is safe to run twice and never adds a speculative expiry column.
 await db.exec(await readFile('supabase/migrations/20261102180000_repair_course_facts_enrollment_schema.sql','utf8'));
 const columns:any=await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='enrollments'");assert(!columns.rows.some((c:any)=>c.column_name==='expires_at'));
 const teacher='11111111-1111-4111-8111-111111111111',student='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',course='44444444-4444-4444-8444-444444444444',draft='55555555-5555-4555-8555-555555555555';
 await db.query(`INSERT INTO profiles VALUES($1,'Professeur Réel','private@teacher.test','private-phone','instructor',now(),null,null),($2,'Élève Réel','private@student.test',null,'student',now(),null,null),($3,'Sans achat','private@other.test',null,'student',now(),null,null)`,[teacher,student,other]);
 await db.query(`INSERT INTO courses VALUES($1,$2,'published'),($3,$2,'draft')`,[course,teacher,draft]);await db.query('INSERT INTO enrollments(user_id,course_id)VALUES($1,$2)',[student,course]);
 const asUser=async(id:string)=>{await db.exec('RESET ROLE');await db.query(`SELECT set_config('app.user',$1,false)`,[id]);await db.exec('SET ROLE authenticated');};
 await asUser(student);await db.query('SELECT save_course_review($1,4,$2)',[course,'Un avis réel sur cette formation.']);await db.query('SELECT save_course_review($1,3,$2)',[course,'Mon avis mis à jour.']);
 await assert.rejects(()=>db.query('SELECT save_public_author_profile($1,$2,$3,$4)',['Faux prof','Titre','Bio','']));
 await asUser(other);await assert.rejects(()=>db.query('SELECT save_course_review($1,5,$2)',[course,'Avis sans achat interdit.']));
 await asUser(teacher);await db.query('SELECT save_public_author_profile($1,$2,$3,$4)',['Nom Complet Réel','Professeur','Biographie réelle','/api/covers/11111111-1111-4111-8111-111111111111.png']);
 await db.exec('RESET ROLE; SET ROLE anon');const result:any=(await db.query('SELECT course_public_facts($1::uuid[]) AS facts',[[course,draft]])).rows[0];assert.equal(result.facts.length,1);const facts=result.facts[0];assert.equal(facts.studentsCount,1);assert.equal(facts.reviewsCount,1);assert.equal(facts.averageRating,3);assert.equal(facts.instructor.fullName,'Nom Complet Réel');assert.equal(facts.reviews[0].authorName,'Élève Réel');assert(!JSON.stringify(facts).includes('private@'));assert(!JSON.stringify(facts).includes('private-phone'));
 await assert.rejects(()=>db.query('SELECT email FROM profiles'));await assert.rejects(()=>db.query('SELECT save_course_review($1,5,$2)',[course,'Anonyme interdit.']));
 await db.exec('RESET ROLE');await db.query('UPDATE enrollments SET revoked_at=now() WHERE user_id=$1',[student]);await asUser(student);await assert.rejects(()=>db.query('SELECT save_course_review($1,5,$2)',[course,'Accès révoqué interdit.']));const empty:any=(await db.query('SELECT course_public_facts($1::uuid[]) AS facts',[[course]])).rows[0];assert.equal(empty.facts[0].studentsCount,0);assert.equal(empty.facts[0].reviewsCount,0);assert.equal(empty.facts[0].averageRating,null);
 await db.close();console.log('PASS public facts PostgreSQL: real counts/rating, review update idempotent, no purchase/revoked/anon denied, own staff profile, private fields hidden, drafts hidden, real zero and no invented rating.');
}
main().catch(e=>{console.error(e);process.exitCode=1});

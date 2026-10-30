import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
async function main(){
 const db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text UNIQUE,email_verified_at timestamptz);
 CREATE TABLE user_credentials(user_id uuid PRIMARY KEY,password_hash text,token_version int DEFAULT 0);
 CREATE TABLE auth_attempts(id uuid);
 CREATE TABLE email_verification_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text,code_hash text,token_hash text,attempts int DEFAULT 0,expires_at timestamptz,used_at timestamptz,created_at timestamptz DEFAULT now());
 CREATE TABLE password_reset_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,token_hash text,expires_at timestamptz,used_at timestamptz,created_at timestamptz DEFAULT now());`);
 const file=(await readdir('supabase/migrations')).find(f=>f.endsWith('_email_activation_safety.sql'))!;
 await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 const hash='a'.repeat(64),wrong='b'.repeat(64),email='fixture@example.test';
 await db.query('INSERT INTO profiles(email)VALUES($1)',[email]);
 await db.query("SELECT create_verification_token($1,$2,$3,now()+interval '10 minutes')",[email,hash,hash]);
 const answers=await Promise.all(Array.from({length:8},()=>db.query<{r:any}>('SELECT consume_verification_token($1,$2,NULL) r',[email,wrong])));
 assert.equal((await db.query<{attempts:number}>('SELECT attempts FROM email_verification_tokens')).rows[0].attempts,5);
 assert(answers.every(r=>!r.rows[0].r.success));
 assert.equal((await db.query<{r:any}>('SELECT consume_verification_token($1,$2,NULL) r',[email,hash])).rows[0].r.reason,'max_attempts');
 await db.query("SELECT create_verification_token($1,$2,$3,now()+interval '10 minutes')",[email,hash,wrong]);
 const use=await Promise.all([db.query<{r:any}>('SELECT consume_verification_token(NULL,NULL,$1) r',[wrong]),db.query<{r:any}>('SELECT consume_verification_token(NULL,NULL,$1) r',[wrong])]);
 assert.equal(use.filter(r=>r.rows[0].r.success).length,1);
 const budgets=await Promise.all(Array.from({length:8},()=>db.query<{r:any}>("SELECT reserve_email_budget($1,'fixture-ip','verification_email') r",[email])));
 assert.equal(budgets.filter(r=>r.rows[0].r.allowed).length,1);
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);await assert.rejects(()=>db.query('SELECT * FROM email_send_attempts'),/permission denied/);await assert.rejects(()=>db.query("SELECT reserve_email_budget('a','b','c')"),/permission denied/);await db.exec('RESET ROLE');}
 await db.close();console.log('PASS atomic five-attempt budget, single consumption, concurrent resend reservation and private SQL grants (local PostgreSQL only)');
}
main().catch(()=>{console.error('FAIL email activation regression');process.exitCode=1;});

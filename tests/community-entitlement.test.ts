import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
async function main(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
 CREATE TABLE profiles(id uuid PRIMARY KEY,role text,email_verified_at timestamptz,banned_at timestamptz);
 CREATE TABLE enrollments(id uuid DEFAULT gen_random_uuid(),user_id uuid,revoked_at timestamptz);
 CREATE SCHEMA realtime;CREATE TABLE realtime.messages(id uuid DEFAULT gen_random_uuid(),extension text);
 CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('realtime.topic',true)$$;
 GRANT USAGE ON SCHEMA realtime TO authenticated;GRANT EXECUTE ON FUNCTION realtime.topic() TO authenticated;
 ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;GRANT SELECT,INSERT ON realtime.messages TO authenticated;`);
 const tables=['community_messages','community_reactions','community_reports','community_reads','community_rules_accepted'];
 for(const table of tables)await db.exec(`CREATE TABLE ${table}(id uuid DEFAULT gen_random_uuid());ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;GRANT SELECT,INSERT ON ${table} TO authenticated;CREATE POLICY baseline ON ${table} FOR ALL TO authenticated USING(true) WITH CHECK(true);INSERT INTO ${table} DEFAULT VALUES;`);
 await db.exec(await readFile('supabase/migrations/20261030200000_community_entitlement.sql','utf8'));
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
 for(let i=0;i<ids.length;i++)await db.query('INSERT INTO profiles VALUES($1,$2,now(),NULL)',[ids[i],i===2?'instructor':i===3?'admin':'student']);
 await db.query('INSERT INTO enrollments(user_id) VALUES($1)',[ids[1]]);
 async function actor(id:string){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated');}
 for(const [index,allowed] of [[0,false],[1,true],[2,true],[3,true]] as const){
  await actor(ids[index]);
  assert.equal((await db.query<any>('SELECT community_access_allowed() allowed')).rows[0].allowed,allowed);
  for(const table of tables){assert.equal((await db.query(`SELECT * FROM ${table}`)).rows.length,allowed?1:0);if(!allowed)await assert.rejects(()=>db.exec(`INSERT INTO ${table} DEFAULT VALUES`),/row-level security/);}
  await db.query("SELECT set_config('realtime.topic','community-enrolled-room',false)");
  if(allowed)await db.exec("INSERT INTO realtime.messages(extension)VALUES('presence')");else await assert.rejects(()=>db.exec("INSERT INTO realtime.messages(extension)VALUES('presence')"),/row-level security/);
 }
 await db.exec('RESET ROLE');await db.query('UPDATE enrollments SET revoked_at=now() WHERE user_id=$1',[ids[1]]);await actor(ids[1]);assert.equal((await db.query('SELECT * FROM community_messages')).rows.length,0);
 await db.exec('RESET ROLE');await db.query('UPDATE profiles SET email_verified_at=NULL WHERE id=$1',[ids[3]]);await actor(ids[3]);assert.equal((await db.query('SELECT * FROM community_messages')).rows.length,0);
 await db.exec('RESET ROLE');await db.query('UPDATE profiles SET banned_at=now() WHERE id=$1',[ids[2]]);await actor(ids[2]);assert.equal((await db.query('SELECT * FROM community_messages')).rows.length,0);
 await db.exec('RESET ROLE');await db.close();console.log('PASS community RLS: unpaid denied despite permissive policies, enrolled/staff allowed, revoked/unverified/banned denied, private presence protected; local PostgreSQL only');
}
main().catch(e=>{console.error('FAIL community entitlement',e instanceof Error?e.message:'unknown');process.exitCode=1});

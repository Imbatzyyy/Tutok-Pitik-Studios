// Isolated PostgreSQL (WASM) recovery rehearsal. Never connects to production.
// Only counts and file hashes are reported; plaintext remains in process memory.
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {decryptBackup,sha256} from '../netlify/lib/backup-crypto.mjs';
const [snapshotPath,keyPath,objectRoot]=process.argv.slice(2);if(!snapshotPath||!keyPath||!objectRoot)throw new Error('Usage: node scripts/verify-studio-restore.mjs snapshot.tpsbackup recovery-private.pem object-directory');
const privateKey=await fs.readFile(keyPath,'utf8');const snapshot=JSON.parse(decryptBackup(await fs.readFile(snapshotPath),privateKey));
const quote=s=>'"'+s.replaceAll('"','""')+'"';const qualified=s=>s.split('.').map(quote).join('.');const db=new PGlite();
let rows=0,constraints=0,files=0;try{
 for(const schema of new Set(Object.keys(snapshot.tables).map(t=>t.split('.')[0])))await db.exec(`create schema if not exists ${quote(schema)}`);
 for(const [table,definition] of Object.entries(snapshot.schema)){
  const columns=definition.columns.map(c=>`${quote(c.name)} ${c.type}${c.nullable?'':' not null'}`).join(',');await db.exec(`create table ${qualified(table)} (${columns})`);
  const values=snapshot.tables[table];if(values.length)await db.query(`insert into ${qualified(table)} select * from jsonb_populate_recordset(null::${qualified(table)},$1::jsonb)`,[JSON.stringify(values)]);
  const result=await db.query(`select count(*)::integer as n from ${qualified(table)}`);assert.equal(result.rows[0].n,values.length);rows+=values.length;
 }
 // Add keys and checks before cross-table relationships, validating existing rows.
 for(const type of ['p','u','c','f'])for(const [table,definition] of Object.entries(snapshot.schema))for(const c of definition.constraints.filter(c=>c.type===type)){
  if(type==='f'&&!Object.keys(snapshot.tables).some(t=>c.definition.includes(`REFERENCES ${t}`)||c.definition.includes(`REFERENCES ${qualified(t)}`)))continue;
  await db.exec(`alter table ${qualified(table)} add constraint ${quote(c.name)} ${c.definition.replace(/::(?:auth|storage)\.[a-z_]+/g,'::text')}`);constraints++;
 }
 for(const f of snapshot.files||[]){const decrypted=decryptBackup(await fs.readFile(path.join(objectRoot,f.key)),privateKey);assert.equal(sha256(decrypted),f.sha256);assert.equal(decrypted.length,f.size);files++;}
 console.log(JSON.stringify({passed:true,scope:'Isolated application table restore with keys/checks/available foreign keys and uploaded-file integrity. Provider configuration and sessions excluded.',tables:Object.keys(snapshot.tables).length,rows,constraints,files}));
}catch(e){console.error(JSON.stringify({passed:false,error:e.message,table:e.table,constraint:e.constraint}));process.exitCode=1;}finally{await db.close();}

import {encryptBackup,sha256} from './backup-crypto.mjs';
const ORIGIN='https://dhqxzrzjvgcmjjkmxlfs.supabase.co';
/** Stores only encrypted content off-site. Decryption private key is never deployed. */
export async function runBackup({store,serviceKey,publicKey,fetcher=fetch,now=new Date()}){
 const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'};
 const rpc=async(name,body={})=>{const r=await fetcher(`${ORIGIN}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error('Backup database operation failed');return r.status===204?null:r.json();};
 if(!await rpc('studio_backup_start'))return {skipped:true};
 try{
 const snapshot=await rpc('studio_backup_snapshot');const files=[];let bytes=0;
 for(const object of snapshot.tables['storage.objects']||[]){
 const path=object.bucket_id+'/'+object.name.split('/').map(encodeURIComponent).join('/');
 const response=await fetcher(`${ORIGIN}/storage/v1/object/${path}`,{headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error('Backup upload copy failed');const content=Buffer.from(await response.arrayBuffer());const hash=sha256(content),key=`objects/${hash}`;
 if(!await store.getMetadata(key))await store.set(key,encryptBackup(content,publicKey),{metadata:{sha256:hash},onlyIfNew:true});
 files.push({bucket:object.bucket_id,path:object.name,sha256:hash,size:content.length,key});bytes+=content.length;
 }
 snapshot.files=files;snapshot.recovery_key_id=sha256(publicKey).slice(0,16);
 const key=`snapshots/${now.toISOString().replace(/[:.]/g,'-')}.tpsbackup`;const payload=encryptBackup(Buffer.from(JSON.stringify(snapshot)),publicKey);
 await store.set(key,payload,{metadata:{captured_at:snapshot.captured_at,format:snapshot.format}});
 // Hash-only indices support retention without exposing names or decrypting snapshots.
 await store.setJSON(`indices/${key.slice(10)}`,{objects:files.map(f=>f.key),created_at:now.toISOString()});
 const listing=await store.list({prefix:'snapshots/'});const all=listing.blobs.sort((a,b)=>b.key.localeCompare(a.key));
 for(const old of all.slice(14)){await store.delete(old.key);await store.delete(`indices/${old.key.slice(10)}`);}
 // Delete encrypted orphan objects only after all retained snapshot indices are present.
 const retained=all.slice(0,14);const used=new Set(files.map(f=>f.key));let complete=true;
 for(const kept of retained){const index=await store.get(`indices/${kept.key.slice(10)}`,{type:'json'});if(!index){complete=false;break;}for(const object of index.objects)used.add(object);}
 if(complete){const objects=await store.list({prefix:'objects/'});for(const object of objects.blobs)if(!used.has(object.key))await store.delete(object.key);}
 const counts={tables:Object.keys(snapshot.tables).length,rows:Object.values(snapshot.tables).reduce((n,rows)=>n+rows.length,0),files:files.length,bytes,backup_key:key};
 await rpc('studio_backup_finish',{p_ok:true,p_counts:counts});return counts;
 }catch{await rpc('studio_backup_finish',{p_ok:false,p_counts:{}}).catch(()=>{});throw new Error('Encrypted studio backup failed; review service health.');}
}

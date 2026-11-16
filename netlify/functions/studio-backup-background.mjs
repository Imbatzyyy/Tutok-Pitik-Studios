import {getStore} from '@netlify/blobs';
import {createHash,timingSafeEqual} from 'node:crypto';
import {runBackup} from '../lib/studio-backup.mjs';
export default async function handler(req){
 const secret=process.env.STUDIO_BACKUP_TRIGGER;
 const supplied=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(req.method!=='POST'||!secret||!timingSafeEqual(createHash('sha256').update(secret).digest(),createHash('sha256').update(supplied).digest()))return new Response('Forbidden',{status:403});
 const publicKey=Buffer.from(process.env.STUDIO_BACKUP_PUBLIC_KEY||'','base64').toString();const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!publicKey||!serviceKey)throw new Error('Backup configuration unavailable');
 await runBackup({store:getStore({name:'studio-encrypted-backups',consistency:'strong'}),serviceKey,publicKey});
}
export const config={background:true};

export default async function handler(){
 if(!process.env.STUDIO_BACKUP_TRIGGER)throw new Error('Backup scheduler configuration unavailable');
 const r=await fetch('https://tutokpitikstudios.com/.netlify/functions/studio-backup-background',{method:'POST',headers:{Authorization:`Bearer ${process.env.STUDIO_BACKUP_TRIGGER}`},signal:AbortSignal.timeout(15000)});
 if(r.status!==202)throw new Error('Backup worker could not be started');
 return new Response('Backup queued');
}
export const config={schedule:'23 19 * * *'};

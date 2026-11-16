import {randomBytes,createCipheriv,createDecipheriv,publicEncrypt,privateDecrypt,constants,createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const MAGIC=Buffer.from('TPSBACK1');
export function encryptBackup(input,publicKey){
 const key=randomBytes(32),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(MAGIC);
 const ciphertext=Buffer.concat([cipher.update(gzipSync(input)),cipher.final()]);
 const wrapped=publicEncrypt({key:publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key);key.fill(0);
 const length=Buffer.alloc(2);length.writeUInt16BE(wrapped.length);
 return Buffer.concat([MAGIC,length,wrapped,nonce,cipher.getAuthTag(),ciphertext]);
}
export function decryptBackup(input,privateKey){
 const bytes=Buffer.from(input);if(!bytes.subarray(0,8).equals(MAGIC))throw new Error('Invalid backup format');
 const size=bytes.readUInt16BE(8),offset=10+size;const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},bytes.subarray(10,offset));
 const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(offset,offset+12));decipher.setAAD(MAGIC);decipher.setAuthTag(bytes.subarray(offset+12,offset+28));
 const plain=Buffer.concat([decipher.update(bytes.subarray(offset+28)),decipher.final()]);key.fill(0);return gunzipSync(plain);
}
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

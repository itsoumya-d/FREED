import {getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {getRemoteConfig} from 'firebase-admin/remote-config';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {ClaraCloudInputError,createClaraCloudService} from './clara-cloud.js';
import {createGoogleClaraProvider} from './clara-google.js';
import {reserveClaraRequest,hasClaraReviewAccess} from './clara-quota.js';
import {COLLECTIONS,validateServerDocument} from './contracts.js';

if(!getApps().length)initializeApp();
const db=getFirestore();
let gate:{expiresAt:number;enabled:boolean}|null=null;
const service=createClaraCloudService({
 enabled:async()=>{
  if(gate&&gate.expiresAt>Date.now())return gate.enabled;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const template=await Promise.race([getRemoteConfig().getTemplate(),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('Feature gate unavailable.')),2000);})]).finally(()=>{if(timer)clearTimeout(timer);});
  const enabled=template.parameters.ai_clara_enabled?.defaultValue;
  const result=!!enabled && 'value' in enabled && enabled.value==='true';
  gate={enabled:result,expiresAt:Date.now()+60000};return result;
 },
 reserve:reserveClaraOwnerQuota,
 reply:createGoogleClaraProvider({projectId:'freed-7d5ee'}),
});

export function reserveClaraOwnerQuota(uid:string,eventId:string,now=Date.now()){
 return db.runTransaction(async transaction=>{
  const review=await transaction.get(db.doc(`${COLLECTIONS.backendJobs}/${uid}_review-access-v1`));
  const reviewAccess=hasClaraReviewAccess(review.data(),uid,now);
  return reserveClaraRequest({
   get:async<T extends object>(path:string)=>{const doc=await transaction.get(db.doc(path));const value=doc.exists?{...doc.data()}:undefined;if(value?.expiresAt instanceof Timestamp)value.expiresAt=value.expiresAt.toMillis();return{value:value as T|undefined};},
   set:async(path,value)=>{const collection=path.split('/')[0];const document={...value} as Record<string,unknown>;if(typeof document.expiresAt==='number')document.expiresAt=Timestamp.fromMillis(document.expiresAt);transaction.set(db.doc(path),collection==='ai_budget_controls'?document:validateServerDocument(collection!,document));},
  },{uid,eventId,now,reviewAccess,readClaims:async()=>{const claims=await transaction.get(db.collection(COLLECTIONS.purchaseClaims).where('uid','==',uid));return claims.docs.map(claim=>claim.data());}});
 });
}

export const generateGoogleClaraReply=onCall({region:'asia-south1',serviceAccount:'freed-clara-runtime@freed-7d5ee.iam.gserviceaccount.com',maxInstances:3,concurrency:20,timeoutSeconds:30,enforceAppCheck:true,consumeAppCheckToken:true},async request=>{
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','Sign in to use cloud chat.');
 if(!['password','apple.com','google.com'].includes(String(request.auth.token.firebase?.sign_in_provider)))throw new HttpsError('failed-precondition','Connect an account to use cloud chat.');
 if(request.app?.alreadyConsumed)throw new HttpsError('permission-denied','A fresh App Check token is required.');
 try{return await service.reply(request.auth.uid,request.data);}
 catch(error){if(error instanceof ClaraCloudInputError)throw new HttpsError('invalid-argument','This chat request is not supported.');throw new HttpsError('unavailable','Cloud chat is temporarily unavailable.');}
});

import {authorizeAiUsage,claraDailyLimit} from './ai-quota.js';
import {reserveClaraBudget,type ClaraReservation} from './clara-cloud.js';
import type {TransactionalStore} from './transactional.js';
import {Timestamp} from 'firebase-admin/firestore';

export function hasClaraReviewAccess(value:unknown,uid:string,now:number):boolean {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const marker=value as Record<string,unknown>;
 if(Object.keys(marker).sort().join(',')!=='createdAt,expiresAt,kind,status,uid'||marker.uid!==uid||marker.kind!=='review-access-v1'||marker.status!=='active'||
   !(marker.createdAt instanceof Timestamp)||!(marker.expiresAt instanceof Timestamp))return false;
 const createdAt=marker.createdAt.toMillis(),expiresAt=marker.expiresAt.toMillis();
 return Number.isSafeInteger(createdAt)&&createdAt>=0&&createdAt<=now&&Number.isSafeInteger(expiresAt)&&expiresAt>now&&expiresAt>createdAt&&expiresAt-createdAt<=14*86400000;
}

/** One atomic transaction: every budget, ownership and quota read precedes writes. */
export async function reserveClaraRequest(store:TransactionalStore,options:{uid:string;eventId:string;now:number;readClaims:()=>Promise<readonly unknown[]>;reviewAccess?:boolean}):Promise<ClaraReservation> {
 const {uid,eventId,now}=options;
 const dailyPath=`rate_limits/${uid}_ai-clara-daily`;
 const [budget,daily,claims]=await Promise.all([store.get('ai_budget_controls/clara-internal-v1'),store.get<{count:number;windowStartedAt:number;expiresAt:number}>(dailyPath),options.readClaims()]);
 const allowance=claraDailyLimit(uid,claims,now,options.reviewAccess);
 const dayStart=Math.floor(now/86400000)*86400000;
 const prior=daily.value?.windowStartedAt===dayStart&&Number.isSafeInteger(daily.value.count)?daily.value.count:0;
 const quota={remaining:Math.max(0,allowance-prior),limit:allowance,resetsAt:new Date(dayStart+86400000).toISOString()};
 const reservation=reserveClaraBudget(budget.value,now);
 if(!reservation.allowed)return{status:'budget-exhausted',...quota};
 const status=await authorizeAiUsage(store,{uid,route:'clara',rateLimitPath:`rate_limits/${uid}_ai-clara`,idempotencyPath:`idempotency/${uid}_ai-clara_${eventId}`,
  accountTombstonePath:`deletion_tombstones/${uid}`,dailyUsagePath:dailyPath,now,windowMs:60000,limit:20,idempotencyTtlMs:7*86400000,verifiedReviewAccess:options.reviewAccess},async()=>claims);
 if(status==='allowed')await store.set('ai_budget_controls/clara-internal-v1',reservation.next!);
 return{status,...quota,remaining:status==='allowed'?Math.max(0,quota.remaining-1):quota.remaining};
}

import { LOCAL_PHOTO_TARGETS, type LocalPhotoTargetId } from './challenge-rules';
export const PHOTO_RULE_REVISION = 'freed-photo-targets-v1';
export type PhotoIdentity = { provider: 'apple-vision' | 'bundled-mlkit'; classifierRevision: string; runtimeRevision: string; ruleRevision: typeof PHOTO_RULE_REVISION; modelWeightsRevision: null };
export type PhotoCapabilities = { cameraAvailable: boolean; classifierAvailable: boolean; identity: PhotoIdentity | null; supportedTargetIds: LocalPhotoTargetId[]; validatedPhotoTargets: LocalPhotoTargetId[] };
export type PhotoClassification = { available: boolean; matched: boolean; labels: string[]; matchedLabels: string[]; confidence?: number; message: string; outcome: 'matched' | 'uncertain' | 'unavailable' | 'cancelled'; identity: PhotoIdentity | null };
export function readPhotoIdentity(value: unknown): PhotoIdentity | null {
 if (!value || typeof value !== 'object') return null; const v = value as PhotoIdentity;
 if (v.ruleRevision !== PHOTO_RULE_REVISION || v.modelWeightsRevision !== null || typeof v.runtimeRevision !== 'string' || !v.runtimeRevision.trim()) return null;
 if (v.provider === 'bundled-mlkit' && v.classifierRevision === 'com.google.mlkit:image-labeling:17.0.9' && /^android-\d+$/.test(v.runtimeRevision)) return v;
 if (v.provider === 'apple-vision' && /^VNClassifyImageRequest:revision-[1-9]\d*$/.test(v.classifierRevision) && /^ios-\d+\.\d+\.\d+$/.test(v.runtimeRevision)) return v;
 return null;
}
export function samePhotoIdentity(a: unknown, b: unknown) {
 const left = readPhotoIdentity(a), right = readPhotoIdentity(b);
 return !!left && !!right && left.provider === right.provider && left.classifierRevision === right.classifierRevision && left.runtimeRevision === right.runtimeRevision && left.ruleRevision === right.ruleRevision;
}
export function readPhotoCapabilities(value: unknown): PhotoCapabilities {
 const v = (value ?? {}) as Partial<PhotoCapabilities>, identity = readPhotoIdentity(v.identity);
 return {cameraAvailable: v.cameraAvailable === true, classifierAvailable: !!identity && v.classifierAvailable === true, identity,
 supportedTargetIds: identity && Array.isArray(v.supportedTargetIds) ? v.supportedTargetIds.filter(id => Object.hasOwn(LOCAL_PHOTO_TARGETS,id)) : [],
 // No provider/model-bound held-out receipt exists. SDK label support cannot open this gate.
 validatedPhotoTargets: []};
}
export function unavailablePhoto(outcome: 'unavailable' | 'cancelled' = 'unavailable'): PhotoClassification {
 return {available:false,matched:false,labels:[],matchedLabels:[],message: outcome === 'cancelled' ? 'Photo capture cancelled.' : 'On-device image classification is unavailable in this build.',outcome,identity:null};
}
export function readPhotoClassification(value: unknown): PhotoClassification {
 const v = (value ?? {}) as PhotoClassification, identity = readPhotoIdentity(v.identity);
 if (!identity || !['matched','uncertain','unavailable','cancelled'].includes(v.outcome) || !Array.isArray(v.labels) || !Array.isArray(v.matchedLabels)) return unavailablePhoto();
 const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
 const observed=new Set(v.labels.filter(x=>typeof x==='string').slice(0,12).flatMap(label=>label.split(',').map(normalize)));
 const matchedLabels=v.matchedLabels.filter(x=>typeof x==='string'&&observed.has(normalize(x))).slice(0,12);
 return {...v, identity, available: v.available === true && (v.outcome === 'matched' || v.outcome === 'uncertain'), matched: v.available === true && v.matched === true && v.outcome === 'matched' && matchedLabels.length > 0,
 labels: v.labels.filter(x=>typeof x==='string').slice(0,12), matchedLabels, message:typeof v.message === 'string' ? v.message : unavailablePhoto().message};
}

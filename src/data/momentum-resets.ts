import type { RecoveryChallenge } from '@/lib/recovery-engine';
import { LOCAL_PHOTO_TARGETS, type LocalPhotoTargetId } from '@/lib/challenge-rules';

const timed = (id: string, choiceGroup: 'breathe'|'find'|'move', title: string, steps: string[]): RecoveryChallenge => ({
  id, choiceGroup, title, steps, category: choiceGroup === 'breathe' ? 'breathing' : choiceGroup === 'move' ? 'physical' : 'reset',
  durationSec: 60, intensity: 'calm', premium: false,
  icon: choiceGroup === 'breathe' ? 'Waves' : choiceGroup === 'move' ? 'Activity' : 'Search',
  environment: 'indoors', seatedAlternative: true, verification: { version: 1, kind: 'timer' },
  why: 'Take one comfortable action, then choose what you want to do next.',
});

export const MOMENTUM_RESET_TEMPLATES: RecoveryChallenge[] = [
  timed('momentum-breathe-soft','breathe','A comfortable breathing pause',['Sit comfortably and let your shoulders relax.','Breathe gently at your own pace.','Stop whenever you need.']),
  timed('momentum-breathe-exhale','breathe','A gentle exhale pause',['Rest your feet on the floor.','Take a comfortable breath in and let it out slowly.','Keep the breath easy; there is no need to hold it.']),
  timed('momentum-find-five','find','Notice five nearby objects',['Look around from where you are.','Notice five ordinary objects, one at a time.','Choose one detail that you had not noticed before.']),
  timed('momentum-find-shape','find','Find a familiar shape',['Choose a circle, square or triangle.','Look for that shape in objects around you.','Notice one object for a few quiet moments.']),
  timed('momentum-move-seated','move','Seated movement break',['Stay seated in a comfortable position.','Gently move your shoulders or hands within a comfortable range.','Pause or stop if you feel discomfort.']),
  timed('momentum-move-stretch','move','A comfortable movement pause',['Choose a seated or standing position.','Make a few gentle movements that feel comfortable.','Take a moment to rest before deciding what comes next.']),
  { ...timed('momentum-move-steps','move','Take a few nearby steps',['Choose a clear, safe place to walk.','Carry your phone while you take a few steps.','Return when you feel ready.']),
    verification: { version:1,kind:'steps',minSteps:12 }, environment:'either', seatedAlternative:false, durationSec:60 },
  ...Object.keys(LOCAL_PHOTO_TARGETS).map(value => {
    const targetId = value as LocalPhotoTargetId;
    return { ...timed(`momentum-find-${targetId}`,'find',`Find a ${targetId}`,[`Find a ${targetId} nearby.`, 'Center the object in a fresh camera photo.', 'The photo is checked on this device, then deleted.']),
      environment: targetId === 'branch' ? 'outdoors' as const : 'either' as const,
      verification: { version:1 as const,kind:'photo' as const,targetId }, icon:'Camera' };
  }),
];

/** Cadence is elapsed active time, not the number of delayed interval callbacks. */
export function getBreathingPhase(durationsSeconds: readonly number[], activeElapsedMs: number) {
  if (!durationsSeconds.length || durationsSeconds.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Breathing phases need positive durations.');
  }
  const cycleMs = durationsSeconds.reduce((sum, value) => sum + value * 1000, 0);
  let remaining = Math.max(0, Number.isFinite(activeElapsedMs) ? activeElapsedMs : 0) % cycleMs;
  for (let index = 0; index < durationsSeconds.length; index++) {
    const durationMs = durationsSeconds[index] * 1000;
    if (remaining < durationMs) return { phaseIndex: index, secondsRemaining: Math.ceil((durationMs - remaining) / 1000) };
    remaining -= durationMs;
  }
  return { phaseIndex: 0, secondsRemaining: durationsSeconds[0] };
}

export type BreathingCueKind='inhale'|'hold'|'exhale';
export function createBreathingCueController(options:{play:(kind:BreathingCueKind,isCurrent:()=>boolean)=>Promise<void>;stop:()=>void}) {
  let key:string|null=null, generation=0, disposed=false;
  return {
    async update(frame:{enabled:boolean;active:boolean;running:boolean;key:string;kind:BreathingCueKind}) {
      if(disposed)return 'paused' as const;
      if(!frame.enabled || !frame.active || !frame.running){
        if(key!==null){key=null;generation++;options.stop();}
        return 'paused' as const;
      }
      if(key===frame.key)return 'unchanged' as const;
      key=frame.key;const request=++generation;options.stop();
      const current=()=>!disposed && request===generation && key===frame.key;
      try {await options.play(frame.kind,current);return current()?'played' as const:'paused' as const;}
      catch {return current()?'unavailable' as const:'paused' as const;}
    },
    dispose(){disposed=true;generation++;key=null;options.stop();},
  };
}

import React from 'react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { createBreathingCueController, type BreathingCueKind } from '@/lib/breathing-cadence';

const sources={inhale:require('../../assets/audio/breathing/inhale.wav'),hold:require('../../assets/audio/breathing/hold.wav'),exhale:require('../../assets/audio/breathing/exhale.wav')};
/** Bundled nonverbal cues: no recording permission, network request or exercise authority. */
export function useBreathingAudio(frame:{enabled:boolean;active:boolean;running:boolean;key:string;kind:BreathingCueKind}) {
  const inhale=useAudioPlayer(sources.inhale),hold=useAudioPlayer(sources.hold),exhale=useAudioPlayer(sources.exhale);
  const controller=React.useRef<ReturnType<typeof createBreathingCueController>|null>(null);
  const [unavailable,setUnavailable]=React.useState(false);
  React.useEffect(()=>{
    const players={inhale,hold,exhale};
    const cue=createBreathingCueController({
      stop:()=>{for(const player of [inhale,hold,exhale]){try{player.pause();}catch{/* Expo may already have released a player during unmount. */}}},
      play:async(kind,current)=>{
        await setAudioModeAsync({allowsRecording:false,playsInSilentMode:false,shouldPlayInBackground:false,interruptionMode:'mixWithOthers'});
        const player=players[kind];
        for(let tries=0;current() && !player.isLoaded && tries<50;tries++)await new Promise<void>(done=>setTimeout(done,20));
        if(!current())return;
        if(!player.isLoaded)throw Error('audio-not-ready');
        await player.seekTo(0);
        if(current()){player.volume=.4;player.play();}
      },
    });
    controller.current=cue;
    return()=>{cue.dispose();if(controller.current===cue)controller.current=null;};
  },[inhale,hold,exhale]);
  React.useEffect(()=>{
    let current=true;
    void controller.current?.update(frame).then(result=>{if(current)setUnavailable(result==='unavailable');});
    return()=>{current=false;};
  },[frame.enabled,frame.active,frame.running,frame.key,frame.kind,inhale,hold,exhale]);
  return {unavailable};
}

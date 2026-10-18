import React from 'react';
import { Image } from 'expo-image';
import type { CompanionPose, CompanionCategory } from '@/lib/companion-policy';

const art = {
  path: require('../../assets/artwork/companion/scene-cloud-path.png'),
  calm: require('../../assets/artwork/companion/scene-calm-circle.png'),
  movement: require('../../assets/artwork/companion/scene-movement-ground.png'),
  reflection: require('../../assets/artwork/companion/scene-reflection-desk.png'),
  protection: require('../../assets/artwork/companion/scene-protection-privacy.png'),
};
export function CompanionBackdrop({ pose = 'guide', category }: { pose?: CompanionPose; category?: CompanionCategory }) {
  const family = ['shield', 'secure', 'repair'].includes(pose) ? 'protection'
    : ['breathe', 'rest', 'reassure'].includes(pose) || category === 'calm' ? 'calm'
    : pose === 'move' || category === 'movement' ? 'movement'
    : ['read', 'write', 'plan', 'focus'].includes(pose) ? 'reflection' : 'path';
  return <Image source={art[family]} contentFit="contain" accessible={false} style={{ width: '100%', height: '100%', opacity: .7 }} />;
}

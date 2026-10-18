/** Presentation only: cues acknowledge caller-owned state; they never award progress. */
export const COMPANION_POSES = ['welcome', 'guide', 'listen', 'plan', 'shield', 'focus', 'breathe', 'move', 'write', 'read', 'connect', 'rest', 'reassure', 'celebrate', 'waiting', 'repair', 'secure', 'saved'] as const;
export type CompanionPose = typeof COMPANION_POSES[number];
export type CompanionVariant = 'welcome' | 'progress' | 'calm' | 'celebrate';
export type CompanionCategory = 'recovery' | 'protection' | 'practice' | 'learning' | 'planning' | 'account' | 'commitment' | 'movement' | 'reflection' | 'calm';
export type CompanionCue = {
    id: string;
    pose: CompanionPose;
    earned?: boolean;
};
export type CompanionHelp = {
    title: string;
    body: string;
    actions?: {
        label: string;
        onPress: () => void;
    }[];
};
export function resolveCompanionPose(pose: CompanionPose | undefined, variant: CompanionVariant): CompanionPose { return pose ?? ({ welcome: 'welcome', progress: 'guide', calm: 'breathe', celebrate: 'celebrate' } as const)[variant]; }
export function companionMayAnimate(gates: {
    visible: boolean;
    focused: boolean;
    foreground: boolean;
    reduceMotion: boolean;
    motionEnabled: boolean;
}) { return gates.visible && gates.focused && gates.foreground && !gates.reduceMotion && gates.motionEnabled; }
export function companionSceneFamily(pose: CompanionPose, category?: CompanionCategory): CompanionCategory {
    if (category)
        return category;
    if (['shield', 'secure', 'repair'].includes(pose))
        return 'protection';
    if (['breathe', 'rest', 'reassure', 'listen'].includes(pose))
        return 'calm';
    if (['read', 'write'].includes(pose))
        return 'reflection';
    if (pose === 'move')
        return 'movement';
    if (['plan', 'focus', 'waiting'].includes(pose))
        return 'planning';
    return 'recovery';
}
const CUE_STORAGE_KEY = 'freed.companion.seen-earned.v1';
type CueStorage = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem?(key: string): void;
};
/** Bounded process registry survives React remounts; earned receipts also survive app restarts. */
export function createCompanionCueRegistry(storage?: CueStorage, limit = 256) {
    const capacity = Math.max(1, Math.min(512, Math.floor(limit) || 256));
    const seen = new Set<string>();
    let earned: string[] = [];
    try {
        const raw = JSON.parse(storage?.getItem(CUE_STORAGE_KEY) ?? '[]');
        if (Array.isArray(raw))
            earned = raw.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 240).slice(-capacity);
    }
    catch { /* Malformed optional presentation history must never break recovery. */ }
    return {
        consume(cue: CompanionCue, active: boolean) {
            if (!active || !cue.id.trim() || cue.id.length > 240 || seen.has(cue.id) || earned.includes(cue.id))
                return false;
            seen.add(cue.id);
            while (seen.size > capacity)
                seen.delete(seen.values().next().value!);
            if (cue.earned ?? (cue.pose === 'saved' || cue.pose === 'celebrate')) {
                earned = [...earned, cue.id].slice(-capacity);
                try {
                    storage?.setItem(CUE_STORAGE_KEY, JSON.stringify(earned));
                }
                catch { /* Still deduplicated in this process. */ }
            }
            return true;
        },
        clear() {
            // Erase first. A failed explicit deletion must report failure and retain
            // the process ledger, rather than claim local data was removed.
            if (storage?.removeItem) storage.removeItem(CUE_STORAGE_KEY);
            else storage?.setItem(CUE_STORAGE_KEY, '[]');
            seen.clear();
            earned = [];
        },
        size: () => seen.size,
    };
}

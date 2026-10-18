import React from 'react';
import { Platform } from 'react-native';
import { rotationAround, scaleAround } from '@/lib/svg-companion-transform';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { companionSceneFamily, type CompanionCategory, type CompanionPose } from '@/lib/companion-policy';
const web = Platform.OS === 'web';
const AnimatedG = Animated.createAnimatedComponent(G);
const INK = '#182128', WHITE = '#FFFDF4', BLUE = '#69C9FA', YELLOW = '#FFD75B', LIME = '#D5EB74', LILAC = '#CBB6EE', CORAL = '#FF9E86';
type Point = [
    number,
    number
];
type PoseGeometry = {
    left: string;
    right: string;
    lh: Point;
    rh: Point;
    la: number;
    ra: number;
    lean: number;
    seated?: boolean;
    closed?: boolean;
    prop?: 'clipboard' | 'shield' | 'timer' | 'pencil' | 'book' | 'heart' | 'moon' | 'flag' | 'clock' | 'tool' | 'lock' | 'receipt';
    hand?: 'point' | 'open' | 'hold';
};
/** Distinct silhouettes remain legible without any animation. Coordinates share the approved 18-pose art family. */
const POSES: Record<CompanionPose, PoseGeometry> = {
    welcome: { left: 'M73 130 Q38 152 36 86', right: 'M171 128 Q202 143 202 174', lh: [35, 77], rh: [204, 181], la: -18, ra: 18, lean: 0, closed: true, hand: 'open' },
    guide: { left: 'M72 130 Q45 138 55 161', right: 'M170 120 Q199 119 203 96', lh: [56, 166], rh: [208, 91], la: 10, ra: -65, lean: -3, hand: 'point' },
    listen: { left: 'M71 131 Q58 166 92 163', right: 'M170 129 Q192 142 166 113', lh: [93, 166], rh: [166, 112], la: 8, ra: -15, lean: 5, closed: true, hand: 'hold' },
    plan: { left: 'M70 133 Q53 158 100 162', right: 'M171 133 Q196 158 175 174', lh: [101, 161], rh: [176, 173], la: -15, ra: 15, lean: 0, prop: 'clipboard', hand: 'hold' },
    shield: { left: 'M73 130 Q50 146 57 169', right: 'M170 123 Q204 143 185 173', lh: [57, 171], rh: [189, 175], la: 0, ra: 15, lean: -4, prop: 'shield', hand: 'hold' },
    focus: { left: 'M74 139 Q56 167 71 187', right: 'M168 137 Q193 134 171 105', lh: [73, 188], rh: [174, 109], la: -15, ra: -20, lean: 0, seated: true, closed: true, prop: 'timer', hand: 'hold' },
    breathe: { left: 'M72 139 Q44 174 37 176', right: 'M167 139 Q195 174 202 176', lh: [37, 176], rh: [203, 176], la: -38, ra: 38, lean: 0, seated: true, closed: true, hand: 'open' },
    move: { left: 'M73 130 Q47 147 53 174', right: 'M169 127 Q200 145 199 83', lh: [53, 178], rh: [199, 78], la: 0, ra: -12, lean: -9, hand: 'hold' },
    write: { left: 'M72 134 Q60 159 106 161', right: 'M170 136 Q187 160 163 179', lh: [106, 161], rh: [166, 179], la: -25, ra: 12, lean: 3, prop: 'pencil', hand: 'hold' },
    read: { left: 'M71 136 Q54 157 83 169', right: 'M171 136 Q187 157 163 169', lh: [82, 171], rh: [163, 171], la: -5, ra: 5, lean: 0, closed: true, prop: 'book', hand: 'hold' },
    connect: { left: 'M72 129 Q45 153 30 139', right: 'M168 129 Q197 150 196 175', lh: [33, 137], rh: [196, 179], la: -75, ra: 12, lean: 3, prop: 'heart', hand: 'hold' },
    rest: { left: 'M72 145 Q56 178 112 187', right: 'M166 141 Q190 162 136 185', lh: [111, 188], rh: [137, 185], la: -50, ra: 50, lean: 12, seated: true, closed: true, prop: 'moon', hand: 'hold' },
    reassure: { left: 'M72 144 Q49 172 119 164', right: 'M166 145 Q187 173 124 166', lh: [113, 165], rh: [132, 167], la: -55, ra: 55, lean: 0, seated: true, closed: true, hand: 'open' },
    celebrate: { left: 'M72 130 Q44 147 46 165', right: 'M168 127 Q197 136 187 88', lh: [45, 167], rh: [188, 88], la: -12, ra: -5, lean: -10, prop: 'flag', hand: 'hold' },
    waiting: { left: 'M72 132 Q67 167 131 145', right: 'M169 129 Q196 163 202 137', lh: [128, 148], rh: [202, 138], la: -35, ra: 40, lean: 5, prop: 'clock', hand: 'point' },
    repair: { left: 'M72 131 Q43 152 38 124', right: 'M168 133 Q191 151 187 172', lh: [38, 124], rh: [188, 174], la: -5, ra: 12, lean: 0, prop: 'tool', hand: 'hold' },
    secure: { left: 'M72 137 Q53 157 83 176', right: 'M168 137 Q189 157 159 176', lh: [83, 176], rh: [159, 176], la: -5, ra: 5, lean: 0, prop: 'lock', hand: 'hold' },
    saved: { left: 'M73 128 Q47 133 39 111', right: 'M168 128 Q195 145 194 153', lh: [39, 111], rh: [194, 152], la: 0, ra: 10, lean: 0, prop: 'receipt', hand: 'hold' },
};
function Glove({ x, y, angle = 0, kind = 'open' }: {
    x: number;
    y: number;
    angle?: number;
    kind?: 'open' | 'hold' | 'point';
}) {
    return <G transform={("translate(" + (x) + "," + (y) + ")rotate(" + (angle) + ")")} stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill={WHITE}>
  <Path d={kind === 'point' ? 'M-10 10 Q-18 1 -11 -8 Q-7 -11 -4 -5 L-4 -20 Q-4 -28 2 -25 L3 -8 Q12 -13 13 -7 Q16 -2 9 1 Q17 5 9 9 Q15 14 5 17 L-4 17 Z' : kind === 'hold' ? 'M-9 12 Q-20 5 -15 -7 Q-12 -15 -5 -10 Q0 -18 5 -12 Q12 -15 15 -7 Q18 1 11 10 Q8 19 -1 18 Z' : 'M-7 15 Q-20 8 -20 -4 Q-20 -12 -14 -8 L-10 -2 L-14 -14 Q-15 -22 -9 -21 Q-4 -20 -2 -8 L-3 -22 Q-3 -28 3 -26 Q8 -23 7 -8 L10 -18 Q13 -23 18 -19 Q23 -14 13 0 Q23 -6 24 1 Q24 6 13 12 Q10 21 0 19 Z'}/>
  <Path d="M-9 12 Q-1 16 7 13 M-7 -1 Q0 -5 5 2" fill="none" strokeWidth={2}/>
 </G>;
}
function Shoe({ x, y, angle = 0 }: {
    x: number;
    y: number;
    angle?: number;
}) { return <G transform={("translate(" + (x) + "," + (y) + ")rotate(" + (angle) + ")")} fill={WHITE} stroke={INK} strokeWidth={3.6} strokeLinejoin="round" strokeLinecap="round"><Path d="M-23 7 Q-23 -5 -9 -8 Q-5 -16 4 -12 L10 -6 Q24 -5 25 8 L25 14 Q5 20 -23 14 Z"/><Path d="M-22 8 Q0 15 24 8 M-10 -4 Q1 -7 7 3 M-5 -9 Q5 -10 11 -3" fill="none" strokeWidth={2.3}/></G>; }
function PoseProp({ prop }: {
    prop?: PoseGeometry['prop'];
}) {
    const common = { stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    return <G {...common}>
  {(prop === 'clipboard' || prop === 'pencil') && <><Path d={prop === 'pencil' ? 'M116 140 L172 143 L166 204 L112 199 Z' : 'M125 133 L179 133 L167 194 L115 194 Z'} fill={prop === 'pencil' ? LILAC : YELLOW}/><Rect x={137} y={128} width={24} height={9} rx={3} fill={LILAC}/><Path d="M129 154 L160 154 M126 164 L152 164 M123 174 L150 174" fill="none" strokeWidth={2}/><Path d="M88 123 L95 119 L117 150 L109 155 Z" fill={YELLOW}/><Path d="M88 123 L85 116 Q88 111 92 113 L95 119" fill={CORAL}/><Path d="M109 155 L118 160 L117 150" fill={WHITE}/></>}
  {prop === 'shield' && <><Path d="M167 105 Q188 119 210 119 L210 154 Q209 184 185 200 Q158 184 158 153 L158 119 Z" fill={LIME}/><Path d="M171 148 L182 159 L200 137" fill="none" strokeWidth={6}/></>}
  {prop === 'timer' && <><Path d="M204 172 L230 172 M207 175 Q205 187 217 192 Q230 200 230 213 L204 213 Q205 201 217 193 Q229 187 228 175" fill={YELLOW}/><Path d="M203 171 L231 171 M203 215 L231 215" stroke={CORAL} strokeWidth={6}/></>}
  {prop === 'book' && <><Path d="M82 143 Q103 138 122 153 Q143 138 164 143 L164 198 Q142 194 122 207 Q101 194 82 198 Z" fill={YELLOW}/><Path d="M122 153 L122 207 M87 142 L88 136 Q106 134 121 145 Q141 134 159 136 L160 142" fill={WHITE}/><Path d="M91 157 Q104 156 113 163 M91 169 Q103 168 113 175 M132 164 Q144 155 155 157 M132 176 Q144 167 155 169" strokeWidth={1.7} fill="none"/></>}
  {prop === 'heart' && <><Path d="M33 123 C-5 101 7 77 27 90 C44 68 70 99 33 123 Z" fill={CORAL}/><Path d="M5 74 L0 64 M33 70 L33 58 M57 76 L64 65" stroke={YELLOW} strokeWidth={4}/></>}
  {prop === 'moon' && <Path d="M213 52 Q178 76 211 92 Q179 94 177 68 Q179 47 213 52 Z" fill={YELLOW}/>}
  {prop === 'flag' && <><Path d="M188 96 L180 34" strokeWidth={5}/><Path d="M181 37 Q200 30 224 35 L219 52 L228 68 Q204 64 184 71 Z" fill={YELLOW}/><Path d="M202 40 L206 48 L215 49 L208 55 L210 64 L202 59 L195 64 L196 55 L190 49 L199 48 Z" fill={INK}/></>}
  {prop === 'clock' && <><Circle cx={203} cy={109} r={29} fill={CORAL}/><Circle cx={203} cy={109} r={22} fill={WHITE}/><Path d="M203 94 L203 109 L214 117" fill="none" strokeWidth={4}/></>}
  {prop === 'tool' && <><Path d="M29 136 L42 91 Q26 76 38 57 L40 74 L52 78 L62 64 Q68 89 52 94 L42 141 Q32 146 29 136 Z" fill={YELLOW}/></>}
  {prop === 'lock' && <><Rect x={81} y={148} width={81} height={51} rx={5} fill={YELLOW}/><Path d="M110 169 L110 159 C110 142 134 142 134 159 L134 169" fill="none" strokeWidth={5}/><Rect x={107} y={166} width={31} height={25} rx={4} fill={LILAC}/><Path d="M122 175 L122 183" strokeWidth={4}/></>}
  {prop === 'receipt' && <><Path d="M180 98 L212 102 L206 154 L173 150 Z" fill={LIME}/><Path d="M183 120 L190 128 L204 112" fill="none" strokeWidth={5}/><Path d="M186 87 L184 77 M201 88 L205 78" stroke={YELLOW} strokeWidth={4}/></>}
 </G>;
}
function Scene({ pose, category, dark }: {
    pose: CompanionPose;
    category?: CompanionCategory;
    dark: boolean;
}) {
    const family = companionSceneFamily(pose, category);
    const tint = family === 'protection' || family === 'movement' ? LIME : family === 'reflection' || family === 'account' ? LILAC : family === 'planning' || family === 'commitment' ? YELLOW : family === 'calm' ? CORAL : BLUE;
    return <G opacity={dark ? .18 : .32}>
  <Ellipse cx={120} cy={147} rx={106} ry={95} fill={tint}/>
  {family === 'calm' ? <><Path d="M12 194 Q35 172 59 194 Q83 212 108 192 M163 64 Q178 53 193 64" fill="none" stroke={tint} strokeWidth={5}/><Circle cx={207} cy={55} r={12} fill={tint}/></> : family === 'protection' ? <><Path d="M18 108 L35 99 L52 108 L52 128 Q49 149 35 159 Q18 149 18 128 Z" fill={tint}/><Path d="M182 53 L201 39 L220 53" fill="none" stroke={tint} strokeWidth={5}/></> : <><Path d="M17 91 Q28 69 39 91 Z M187 213 Q209 179 229 213 Z" fill={tint}/><Circle cx={205} cy={64} r={7} fill={tint}/><Circle cx={26} cy={158} r={4} fill={tint}/></>}
 </G>;
}
export function KiteCompanionRig({ pose, width, height, animated, drift, gesture, blink, phaseProgress, scene = true, category, dark = false }: {
    pose: CompanionPose;
    width: number;
    height: number;
    animated: boolean;
    drift: SharedValue<number>;
    gesture: SharedValue<number>;
    blink: SharedValue<number>;
    phaseProgress?: SharedValue<number>;
    scene?: boolean;
    category?: CompanionCategory;
    dark?: boolean;
}) {
    const p = POSES[pose];
    const svgMotion = (matrix: number[]): { transform?: string; matrix?: number[] } => { 'worklet'; return web ? { transform: `matrix(${matrix.join(' ')})` } : { matrix }; };
    // The 28-unit full-body hop uses the art's 38-unit top margin. Clamp spring
    // overshoot so even 56-point avatars retain clear SVG bounds on native.
    const bodyMotion = useAnimatedProps(() => { const phase = animated && phaseProgress ? Math.max(0, Math.min(1, phaseProgress.value)) : 0; const scale=1+(pose === 'breathe' ? phase*.035 : 0); return svgMotion(scaleAround(scale,scale,120,124,animated ? -drift.value*1.8-Math.max(0,Math.min(1,gesture.value))*28 : 0)); });
    const leftMotion = useAnimatedProps(() => svgMotion(rotationAround(animated ? (pose === 'welcome' ? Math.max(0,Math.min(1,gesture.value))*28 : drift.value*2) : 0,73,130)));
    const rightMotion = useAnimatedProps(() => svgMotion(rotationAround(animated ? (pose === 'celebrate' ? gesture.value*10 : pose === 'guide' ? drift.value*3 : drift.value*-1.5) : 0,168,130)));
    const legMotion = useAnimatedProps(() => svgMotion(rotationAround(animated && pose === 'move' ? drift.value*4 : 0,132,183)));
    const eyesMotion = useAnimatedProps(() => svgMotion(scaleAround(1,animated ? 1-blink.value*.92 : 1,0,112)));
    const mouthMotion = useAnimatedProps(() => { const scale=animated ? 1+gesture.value*.1 : 1; return svgMotion(scaleAround(scale,scale,120,139)); });
    const propMotion = useAnimatedProps(() => svgMotion(rotationAround(animated && pose === 'celebrate' ? gesture.value*3 : 0,185,91)));
    const id = React.useId().replace(/:/g, '');
    return <Svg width={width} height={height} viewBox="0 0 240 260" accessible={false} testID={`companion-rig-${pose}`}>
  <Defs><LinearGradient id={`body${id}`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#82D6FF"/><Stop offset="1" stopColor={BLUE}/></LinearGradient></Defs>
  {scene && <Scene pose={pose} category={category} dark={dark}/>}
  <Ellipse cx={120} cy={p.seated ? 225 : 239} rx={p.seated ? 76 : 65} ry={6} fill={INK} opacity={dark ? .18 : .08}/>
  <G transform={("rotate(" + (p.lean) + ",120,130)")}>
   <AnimatedG animatedProps={bodyMotion}>
    <G fill="none" stroke={dark ? "#AAB4C1" : INK} strokeWidth={12} strokeLinecap="round">
     {p.seated ? <><Path d="M105 178 Q68 205 88 219 Q118 237 154 209 M134 180 Q172 203 148 221 Q118 237 88 208"/></> : <><Path d={pose === 'move' || pose === 'celebrate' ? 'M106 178 Q82 204 88 220' : 'M106 178 Q93 201 96 220'}/><AnimatedG animatedProps={legMotion}><Path d={pose === 'move' || pose === 'celebrate' ? 'M134 178 Q156 194 174 201' : 'M134 178 Q145 201 143 220'}/></AnimatedG></>}
     <AnimatedG animatedProps={leftMotion}><Path d={p.left}/></AnimatedG><AnimatedG animatedProps={rightMotion}><Path d={p.right}/></AnimatedG>
    </G>
    {p.seated ? <><Shoe x={74} y={215} angle={-22}/><Shoe x={164} y={215} angle={22}/></> : <><Shoe x={89} y={226}/><AnimatedG animatedProps={legMotion}><Shoe x={pose === 'move' || pose === 'celebrate' ? 180 : 147} y={pose === 'move' || pose === 'celebrate' ? 208 : 226} angle={pose === 'move' || pose === 'celebrate' ? -35 : 0}/></AnimatedG></>}
    <Path d="M111 38 Q120 29 129 38 Q157 64 187 108 Q193 117 185 126 L130 187 Q120 198 111 187 L57 126 Q49 117 55 108 Q84 66 111 38 Z" fill={`url(#body${id})`} stroke={INK} strokeWidth={5.5} strokeLinejoin="round"/>
    <AnimatedG animatedProps={eyesMotion} stroke={INK} strokeWidth={5.8} strokeLinecap="round" fill="none">
     {p.closed ? <><Path d="M91 109 Q96 121 103 110 M137 110 Q143 122 149 110"/></> : <><Path d="M92 109 Q96 119 103 110 M137 110 Q142 119 149 109"/><Circle cx={99} cy={110} r={1.1} fill={INK}/><Circle cx={143} cy={110} r={1.1} fill={INK}/></>}
    </AnimatedG>
    <AnimatedG animatedProps={mouthMotion}><Path d={pose === 'breathe' ? 'M118 133 Q114 137 119 141 Q125 143 126 137 Q126 132 118 133' : pose === 'reassure' || pose === 'rest' ? 'M113 137 Q121 143 129 136' : 'M110 132 Q120 148 132 133'} stroke={INK} strokeWidth={5} fill={pose === 'breathe' ? INK : 'none'} strokeLinecap="round"/></AnimatedG>
    <AnimatedG animatedProps={propMotion}><PoseProp prop={p.prop}/></AnimatedG>
    <AnimatedG animatedProps={leftMotion}><Glove x={p.lh[0]} y={p.lh[1]} angle={p.la} kind={pose === 'saved' ? 'point' : pose === 'guide' ? 'hold' : p.hand}/></AnimatedG>
    <AnimatedG animatedProps={rightMotion}><Glove x={p.rh[0]} y={p.rh[1]} angle={p.ra} kind={pose === 'guide' ? 'point' : p.hand}/></AnimatedG>
   </AnimatedG>
  </G>
 </Svg>;
}

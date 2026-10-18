import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, Pressable, View } from 'react-native';
import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { JournalScreen as RealJournalScreen } from '@/components/JournalScreen';
import { createDefaultRecoveryState,getLocalDateKey, recordDailyHabitCompletion } from '@/lib/recovery-state';
import { recordJournalForDate } from '@/lib/recovery-day-write';
import { useFreedNavigation } from '@/features/use-freed-navigation';
import { createJournalRepository } from '@/lib/journal-repository';
let mockDestination='journal';
let mockPrevious='features';
let mockCold=false;
const mockBack=jest.fn(),mockReplace=jest.fn(),mockDispatch=jest.fn(),mockGuided=jest.fn();
let mockState:any;
const mockContainer={isReady:()=>true,getRootState:()=>mockState,dispatch:mockDispatch,addListener:()=>()=>{}};
jest.mock('expo-sqlite/localStorage/install',()=>({}));
jest.mock('expo-router',()=>({usePathname:()=>`/flow/${mockDestination}`,useRouter:()=>({back:mockBack,replace:mockReplace,canGoBack:()=>!mockCold}),useNavigationContainerRef:()=>mockContainer}));
jest.mock('@/hooks/use-app-preferences',()=>({useOptionalAppPreferences:()=>null,useAppPreferences:()=>({mode:'light'})}));
jest.mock('@/design-system/motion',()=>({useMotionSettings:()=>({active:false})}));
jest.mock('@/components/DirectionalIcons',()=>({ChevronLeft:()=>null}));
jest.mock('@react-navigation/native',()=>({CommonActions:{reset:(value:any)=>({type:'RESET',payload:value})}}));
const screenBoundary=({onBack,onSaved}:any)=><View><Pressable accessibilityRole="button" onPress={onBack}><Text>Back</Text></Pressable>{onSaved?<Pressable accessibilityRole="button" onPress={()=>onSaved()}><Text>Saved</Text></Pressable>:null}</View>;
let mockRecovery=createDefaultRecoveryState();
const mockPersist=jest.fn((update:any)=>{mockRecovery=update(mockRecovery);return mockRecovery;});
let mockJournalRepository:ReturnType<typeof createJournalRepository>;
function productionTool(realJournal=false) {
 const source=readFileSync(`${process.cwd()}/src/features/freed-app.tsx`,'utf8'),start=source.indexOf('    if (screen === "customChallenge") {',source.indexOf('  const renderScreen =')),end=source.indexOf('\n    return (\n      <AppBackground>',start);
 const compiled=transpileModule(`return function Tool() { const {setScreen,setTab,backFromTool}=useFreedNavigation(); const screen=mockScreen(); ${source.slice(start,end)} return null; };`,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
 const deps={privateViewLocked:false,journalReaderRequest:null,getFirebaseAccountScope:()=> 'connected-owner',setJournalReaderRequest:jest.fn(),journalRepository:mockJournalRepository,journalMedia:null,legacyJournalNotes:[],journalLegacyDraft:undefined,journalChanged:jest.fn(),openJournalBackup:jest.fn(),journeyOwner:'connected-owner',getLocalDateKey,licensedFeatures:true,React,useFreedNavigation,mockScreen:()=>mockDestination,CustomChallengeScreen:screenBoundary,FunctionalBreathingScreen:screenBoundary,JournalScreen:realJournal?RealJournalScreen:screenBoundary,CoachPanel:screenBoundary,CheckInScreen:screenBoundary,SlipLogScreen:screenBoundary,
 premiumCapabilities:{customChallenges:true,advancedAiCoach:false},customChallenges:[],recoveryState:{toolCompletionSessionIds:[],coachMessages:[]},todayCheckIn:null,attempts:[],streakDays:0,bestStreakDays:0,attemptsToday:0,weeklyReport:{},startPanicIntervention:jest.fn(),setActiveAttempt:jest.fn(),startStandaloneChallenge:mockGuided,persistRecoveryState:mockPersist,recordJournalForDate,recordDailyHabitCompletion};
 return new Function(...Object.keys(deps),compiled)(...Object.values(deps));
}
beforeEach(()=>{jest.clearAllMocks();mockPrevious='features';mockCold=false;mockState={key:'app',index:1,routeNames:['(tabs)','flow/[destination]','index'],routes:[{name:'flow/[destination]',params:{destination:mockPrevious,feature:'practice-journal',search:'write'}},{name:'flow/[destination]',params:{destination:mockDestination}}]};});
test.each(['breathing','journal','coach','checkin','customChallenge','slip'])('production %s visible Back preserves the existing directory route and search state',destination=>{
 mockDestination=destination;mockState.routes[1].params.destination=destination;const before=mockState.routes[0];const Tool=productionTool();const view=render(<Tool />);fireEvent.press(view.getByRole('button',{name:'Back'}));expect(mockBack).toHaveBeenCalledTimes(1);expect(mockDispatch).not.toHaveBeenCalled();expect(mockReplace).not.toHaveBeenCalled();expect(mockState.routes[0]).toBe(before);
});
test('Journal visible Back preserves a focused-practice previous route',()=>{
 mockDestination='journal';mockState.routes[0].params.destination='feature';const Tool=productionTool();const view=render(<Tool />);fireEvent.press(view.getByRole('button',{name:'Back'}));expect(mockBack).toHaveBeenCalledTimes(1);expect(mockDispatch).not.toHaveBeenCalled();
});
test('cold direct-entry tool Back has a directory fallback',()=>{
 mockDestination='journal';mockCold=true;mockState.index=0;mockState.routes=mockState.routes.slice(1);const Tool=productionTool();const view=render(<Tool />);fireEvent.press(view.getByRole('button',{name:'Back'}));expect(mockReplace).toHaveBeenCalledWith('/flow/features');expect(mockDispatch).not.toHaveBeenCalled();
});
test('visible tool Back never returns to a protected reset-chain route',()=>{
 mockDestination='coach';mockState.routes[0].params.destination='challenge';const Tool=productionTool();const view=render(<Tool />);fireEvent.press(view.getByRole('button',{name:'Back'}));expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({type:'RESET'}));expect(mockBack).not.toHaveBeenCalled();
});
test.each(['checkin','slip'])('%s explicit saved completion still resets to Today',destination=>{
 mockDestination=destination;const Tool=productionTool();const view=render(<Tool />);fireEvent.press(view.getByRole('button',{name:'Saved'}));expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({type:'RESET'}));expect(mockBack).not.toHaveBeenCalled();
});

test('actual Journal saved callback preserves the owning directory route and durable private note',()=>{
 const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)};Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
 mockJournalRepository=createJournalRepository({storage,ownerId:'connected-owner',newId:()=> 'entry_one'});
 mockRecovery=createDefaultRecoveryState();mockDestination='journal';mockState.routes[1].params.destination='journal';const previous=mockState.routes[0];const Tool=productionTool(true);const view=render(<Tool />);
 fireEvent.press(view.getByTestId('journal-new-entry'));fireEvent.changeText(view.getByTestId('journal-reflection'),'My saved private note');fireEvent.press(view.getByTestId('journal-save'));
 const reopened=createJournalRepository({storage,ownerId:'connected-owner'});expect(reopened.list()).toHaveLength(1);expect(reopened.list()[0].text).toBe('My saved private note');expect(createJournalRepository({storage,ownerId:'another-owner'}).list()).toHaveLength(0);
 expect(mockPersist).not.toHaveBeenCalled();expect(mockRecovery.dailyCheckIns).toHaveLength(0);expect(mockRecovery.dailyHabits).toHaveLength(0);expect(mockBack).not.toHaveBeenCalled();
 fireEvent.press(view.getByRole('button',{name:'Back'}));expect(mockBack).toHaveBeenCalledTimes(1);expect(mockDispatch).not.toHaveBeenCalled();expect(mockState.routes[0]).toBe(previous);
});

test('custom reset saved completion keeps the existing guided gateway',()=>{
 mockDestination='customChallenge';const Tool=productionTool();const view=render(<Tool />);fireEvent.press(view.getByRole('button',{name:'Saved'}));expect(mockGuided).toHaveBeenCalledTimes(1);expect(mockBack).not.toHaveBeenCalled();expect(mockDispatch).not.toHaveBeenCalled();
});

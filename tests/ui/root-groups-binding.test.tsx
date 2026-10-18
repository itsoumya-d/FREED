import React from 'react';
import { render,fireEvent } from '@testing-library/react-native';
import { View,Text,Pressable } from 'react-native';
import { readFileSync } from 'node:fs';
import { transpileModule,ModuleKind,JsxEmit } from 'typescript';
import { createDefaultRecoveryState } from '@/lib/recovery-state';
import { unavailableAppGroupsSnapshot } from '@/lib/app-groups-controller';
test('actual Shield root binds native groups overview, Apps route and dedicated Advanced callbacks',()=>{
 const s=readFileSync(process.env.TASK2_CENTRAL_SOURCE??'src/features/freed-app.tsx','utf8'),start=s.indexOf('function ShieldScreen('),end=s.indexOf('\nfunction ',start+1);const source=s.slice(start,end);let overview:any,apps:any,advanced:any;const push=jest.fn();
 const button=(label:string,fn:()=>void)=><Pressable accessibilityRole="button" onPress={fn}><Text>{label}</Text></Pressable>;
 const props={disciplineSettings:createDefaultRecoveryState().disciplineSettings,activeUnlock:null,protectionCapability:{platform:'ios',appGroups:true},protectionStatus:null,onRefreshProtection:jest.fn(async()=>({})),onOpenProtectionSetup:jest.fn(),onDisciplineChange:jest.fn(),onAttempt:jest.fn(),groups:{...unavailableAppGroupsSnapshot(),supported:true,platform:'ios',groups:[]},getActionScope:()=> '["root-owner",1]',initialGroupId:'legacy-default',onOpenGroups:jest.fn(),onOpenGroup:jest.fn(),onAddGroup:jest.fn(),onOpenAdvanced:jest.fn(),onPermissions:jest.fn(),onSafariSetup:jest.fn(),onExceptions:jest.fn(),onDiagnostics:jest.fn()};
 const deps:any={React,View,Text,Pressable,router:{push},ScrollView:View,useAppTheme:()=>({colors:{text:'#111',text2:'#555'},typography:{},mode:'light'}),useMomentumBottomPadding:()=>0,useWindowDimensions:()=>({width:400,fontScale:1}),describeAppGuard:()=>({}),getProtectionSetupReadiness:()=>({websiteProtection:{ready:false,status:'Off',explanation:''}}),translateSource:(v:string)=>v,APP_GUARD_MODES:[],MomentumPageHeader:View,PillButton:({label,onPress}:any)=>button(label,onPress),
  ProtectOverview:(p:any)=>{overview=p;return <View testID="groups-overview"/>;},AppGroupsScreen:(p:any)=>{apps=p;return <View testID="actual-native-groups"/>;},AdvancedProtectionScreen:(p:any)=>{advanced=p;return <View testID="actual-advanced">{button('permissions',p.onPermissions)}{button('exceptions',p.onExceptions)}{button('diagnostics',p.onDiagnostics)}</View>;},Link:View,freedShieldSectionPath:(v:string)=>v,freedShieldSectionTitle:(v:string)=>v,getPracticePalette:()=>({}),ShieldCheck:()=>null,ChevronRight:()=>null,tap:()=>{},Card:View,ProtectionLayers:()=>null,AppScheduleEditor:()=>null,ProfileAction:()=>null};
 const Shield=new Function(...Object.keys(deps),transpileModule(source+';return ShieldScreen;',{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.React}}).outputText)(...Object.values(deps));const view=render(<Shield {...props}/>);expect(overview.groups).toBe(props.groups);expect(overview.onOpenGroups).toBe(props.onOpenGroups);expect(overview.onOpenGroup).toBe(props.onOpenGroup);expect(overview.onAddGroup).toBe(props.onAddGroup);
 view.rerender(<Shield {...props} section="apps"/>);expect(view.getByTestId('actual-native-groups')).toBeOnTheScreen();expect(apps.getActionScope).toBe(props.getActionScope);expect(apps.initialGroupId).toBe('legacy-default');expect(apps.createOnOpen).toBe(false);expect(apps.mode).toBe('apps');apps.onManageGroups();expect(push).toHaveBeenCalledWith('groups');
 const consumed=jest.fn();view.rerender(<Shield {...props} section="apps" createOnOpen onCreateRequestConsumed={consumed}/>);expect(apps.createOnOpen).toBe(true);apps.onCreateRequestConsumed();expect(consumed).toHaveBeenCalledTimes(1);
 view.rerender(<Shield {...props} section="groups" createOnOpen/>);expect(view.getByTestId('actual-native-groups')).toBeOnTheScreen();expect(apps.mode).toBe('groups');expect(apps.createOnOpen).toBe(false);
 view.rerender(<Shield {...props} section="advanced"/>);expect(view.getByTestId('actual-advanced')).toBeOnTheScreen();for(const [label,fn]of [['permissions',props.onPermissions],['exceptions',props.onExceptions],['diagnostics',props.onDiagnostics]] as const){fireEvent.press(view.getByRole('button',{name:label}));expect(fn).toHaveBeenCalledTimes(1);}
});

test('actual Root opens only a current owner-visible well-formed group and otherwise falls back safely',()=>{
 const s=readFileSync('src/features/freed-app.tsx','utf8'),start=s.indexOf('  const openAppGroups ='),end=s.indexOf('  const pendingAppsAddIntent =',start);const source=s.slice(start,end);
 const groupId='20202020-2020-4020-8020-202020202020',scope='["root-owner",4]';let sdkOwner:string|null='root-owner',authOwner:string|null='root-owner';
 const push=jest.fn(),setProtectionIntent=jest.fn(),setScreen=jest.fn(),enterAccountFlow=jest.fn(),create=jest.fn(),picker=jest.fn(),activate=jest.fn();
 const deps:any={protectionCapability:{appGroups:true},setProtectionIntent,setScreen,journeyOwner:'root-owner',getFirebaseAccountScope:()=>sdkOwner,getFirebaseAuthSnapshot:()=>({status:'ready',signedIn:Boolean(authOwner),anonymous:false,ownerUid:authOwner,email:null}),getJourneyOwner:(auth:any)=>auth.ownerUid,getProtectionActionScope:()=>scope,knownProtectionScope:scope,appGroupsSnapshotScope:scope,visibleAppGroups:{supported:true,groups:[{id:groupId}]},enterAccountFlow,router:{push},freedShieldSectionPath:(section:string)=>`/shield/${section}`,create,picker,activate};
 const compiled=transpileModule(`function build(){${source};return openAppGroups;} return build;`,{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.React}}).outputText;
 const make=(overrides:Record<string,unknown>={})=>{const inputs={...deps,...overrides};return new Function(...Object.keys(inputs),compiled)(...Object.values(inputs))();};const openAppGroups=make();
 openAppGroups(groupId);expect(push).toHaveBeenLastCalledWith({pathname:'/shield/apps',params:{groupId}});
 push.mockClear();openAppGroups();expect(push).toHaveBeenLastCalledWith('/shield/apps');
 push.mockClear();openAppGroups('30303030-3030-4030-8030-303030303030');expect(push).toHaveBeenLastCalledWith('/shield/apps');
 push.mockClear();openAppGroups({nativeEvent:{}});expect(push).toHaveBeenLastCalledWith('/shield/apps');
 for(const stale of [
  {getProtectionActionScope:()=> '["root-owner",5]'},
  {knownProtectionScope:'["root-owner",3]'},
  {appGroupsSnapshotScope:'["root-owner",3]'},
  {appGroupsSnapshotScope:null},
  {visibleAppGroups:null},
  {visibleAppGroups:{supported:false,groups:[{id:groupId}]}},
 ]){push.mockClear();make(stale)(groupId);expect(push).toHaveBeenLastCalledWith('/shield/apps');expect(enterAccountFlow).not.toHaveBeenCalled();}
 push.mockClear();make({visibleAppGroups:{supported:true,groups:[{id:'legacy-default'}]}})('legacy-default');expect(push).toHaveBeenLastCalledWith({pathname:'/shield/apps',params:{groupId:'legacy-default'}});
 expect(create).not.toHaveBeenCalled();expect(picker).not.toHaveBeenCalled();expect(activate).not.toHaveBeenCalled();
 push.mockClear();sdkOwner='other-owner';authOwner='other-owner';openAppGroups(groupId);expect(push).not.toHaveBeenCalled();expect(enterAccountFlow).toHaveBeenCalledTimes(1);expect(setScreen).toHaveBeenCalledWith('account');
});

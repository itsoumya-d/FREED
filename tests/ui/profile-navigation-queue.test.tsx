import React from 'react';
import { View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { useFreedNavigation } from '@/features/use-freed-navigation';
let mockReady=false,mockPath='/flow/account';
const mockRouter={dismissTo:jest.fn(),replace:jest.fn(),push:jest.fn(),navigate:jest.fn(),back:jest.fn(),canGoBack:()=>false};
const mockCallbacks:Record<string,()=>void>={};
const mockContainer={isReady:()=>mockReady,addListener:(event:string,callback:()=>void)=>{mockCallbacks[event]=callback;return()=>{delete mockCallbacks[event];};},getRootState:()=>({key:'root',index:0,routeNames:['flow/[destination]'],routes:[{name:'flow/[destination]',key:'account-route',params:{destination:'account'}}]}),dispatch:jest.fn()};
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,usePathname:()=>mockPath,useNavigationContainerRef:()=>mockContainer}));
function harness(){let api:any;function Probe(){api=useFreedNavigation();return <View/>;}const view=render(<Probe/>);return {get:()=>api,path:(next:string)=>{mockPath=next;view.rerender(<Probe/>);}};}
beforeEach(()=>{mockPath='/flow/account';mockReady=false;Object.values(mockRouter).forEach(value=>{if(jest.isMockFunction(value))value.mockClear();});});
test('actual navigation hook queues exact private page until ready and rechecks delivery ownership',()=>{
 const f=harness();let valid=true;act(()=>f.get().returnProfileSection('settings',()=>valid));expect(mockRouter.dismissTo).not.toHaveBeenCalled();act(()=>{mockReady=true;mockCallbacks.ready();});expect(mockRouter.dismissTo).toHaveBeenCalledWith('/profile');expect(mockRouter.push).toHaveBeenCalledWith('/profile/settings',{withAnchor:true});
});
test.each(['owner','operation','cancel'])('actual not-ready queue discards stale %s predicate before native delivery',()=>{
 const f=harness();let valid=true;act(()=>f.get().returnProfileSection('account',()=>valid));valid=false;act(()=>{mockReady=true;mockCallbacks.ready();});expect(mockRouter.dismissTo).not.toHaveBeenCalled();
});
test('interacted account deferred public sheet owns presentation until it resumes and closes',()=>{
 mockReady=true;const f=harness();act(()=>f.path('/support'));act(()=>f.get().deferAuxiliaryPresentation());expect(mockRouter.dismissTo).toHaveBeenLastCalledWith('/flow/account');act(()=>f.path('/flow/account'));
 act(()=>f.get().returnProfileSection('account',()=>true));expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);act(()=>f.get().resumeAuxiliaryPresentation());expect(mockRouter.push).toHaveBeenLastCalledWith('/support');act(()=>f.path('/support'));expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);act(()=>f.path('/flow/account'));expect(mockRouter.dismissTo).toHaveBeenLastCalledWith('/profile');expect(mockRouter.push).toHaveBeenLastCalledWith('/profile/account',{withAnchor:true});
});
test('malformed section never enters pending queue or changes the selected tab',()=>{
 const f=harness();act(()=>f.get().returnProfileSection(['account'] as any,()=>true));act(()=>{mockReady=true;mockCallbacks.ready();});expect(mockRouter.dismissTo).not.toHaveBeenCalled();expect(f.get().tab).toBe('today');
});

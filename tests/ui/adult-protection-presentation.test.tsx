import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ProtectOverview } from '@/components/ProtectOverview';
import { IOSWebsiteProtectionSetup } from '@/components/IOSWebsiteProtectionSetup';
import { EncryptedDnsSection } from '@/components/EncryptedDnsSection';
import { getProtectionSetupReadiness } from '@/lib/protection-readiness';
import { createDefaultDisciplineSettings } from '@/lib/recovery-state';
import { getAppPalette } from '@/design-system/app-palette';
import { appI18n } from '@/i18n/runtime';

jest.mock('expo-sqlite/localStorage/install',()=>({}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('lucide-react-native',()=>({Globe2:()=>null,Grid2X2:()=>null,X:()=>null}));
jest.mock('@/components/DirectionalIcons',()=>({ChevronRight:()=>null}));
jest.mock('@/components/NativeAppGroupLabels',()=>({NativeAppGroupLabels:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:mockMode}),useOptionalAppPreferences:()=>null}));
jest.mock('expo-router',()=>({Link:({children}:any)=>children}));
jest.mock('freed-protection',()=>({openProtectionSettings:jest.fn(),openVpnSettings:jest.fn()}));
jest.mock('@/hooks/use-encrypted-dns',()=>({useEncryptedDns:()=>mockDns}));
let mockMode:'light'|'dark'='light';
let mockDns:any;
const capability:any={platform:'ios',screenTime:true,managedSettings:true,accessibility:false,dnsFiltering:false,localVpnFallback:false,notes:[]};
const policy:any={authorized:true,adultFilterActive:true,adultWebPolicyConfigured:true,active:true,mode:'screen-time',message:''};
const dns={supported:true,releaseEnabled:true,configured:true,enabled:true,healthy:true,reason:null,provider:'cloudflare-families',requiresSettings:false};
const observations={readbackAt:100,enablement:'observed-current',routing:'observed-current',adultBrowsing:'observed-blocked',ordinaryBrowsing:'observed-allowed'};
beforeEach(async()=>{
 localStorage.clear();mockMode='light';await appI18n.changeLanguage('en');
 mockDns={status:{...dns},pending:null,error:null,operationReason:null,operationDiagnostic:null,lastCheckedAt:100,refresh:jest.fn(async()=>mockDns.status),configure:jest.fn(async()=>({accepted:true})),acknowledgeOperation:jest.fn()};
});
const overview=(extra:any={})=>render(<ProtectOverview capability={capability} status={policy} settings={createDefaultDisciplineSettings()} onSetup={jest.fn()} {...extra}/>);
const setup=(extra:any={})=>render(<IOSWebsiteProtectionSetup readiness={getProtectionSetupReadiness(capability,policy,0)} authorized busy={false} error={null} onRun={jest.fn()} onRefresh={jest.fn(async()=>({capability,status:policy,readTicket:{revision:1,isCurrent:()=>true}}))} onClose={jest.fn()} onOpenTest={jest.fn()} onAdvanced={jest.fn()} {...extra}/>);

test.each(['light','dark'] as const)('configured websites stay amber with a native requested-state Switch in %s',mode=>{
 mockMode=mode;const onSetup=jest.fn(),view=overview({onSetup});
 expect(view.getByTestId('protect-websites-status')).toHaveTextContent('Needs attention');
 expect(view.getByTestId('protect-websites-state')).toHaveStyle({backgroundColor:getAppPalette(mode).attentionTint});
 expect(view.getByRole('switch',{name:'Adult website protection'})).toBeChecked();
 expect(onSetup).not.toHaveBeenCalled();fireEvent(view.getByTestId('protect-websites-switch'),'valueChange',false);
 expect(onSetup).toHaveBeenCalledWith('websites');
 expect(view.getByTestId('protect-websites-switch')).toBeChecked();
});
test('Switch delegates a requested change without faking a saved toggle',()=>{
 const onRequestedChange=jest.fn(),onSetup=jest.fn(),view=overview({onRequestedChange,onSetup});
 fireEvent(view.getByTestId('protect-websites-switch'),'valueChange',false);
 expect(onRequestedChange).toHaveBeenCalledWith(false);expect(onSetup).not.toHaveBeenCalled();
 expect(view.getByTestId('protect-websites-switch')).toBeChecked();
});
test('only current routing and both browsing observations make the overview green',()=>{
 mockDns={...mockDns,status:{...dns,healthy:null}};
 const view=overview({observations});
 expect(view.getByTestId('protect-websites-status')).toHaveTextContent('On');
 expect(view.getByTestId('protect-websites-state')).toHaveStyle({backgroundColor:getAppPalette('light').onTint});
 mockDns={...mockDns,pending:'refresh'};view.rerender(<ProtectOverview capability={capability} status={policy} settings={createDefaultDisciplineSettings()} onSetup={jest.fn()} observations={observations as any}/>);
 expect(view.getByTestId('protect-websites-status')).toHaveTextContent('Needs attention');
 mockDns={...mockDns,pending:null,lastCheckedAt:101};view.rerender(<ProtectOverview capability={capability} status={policy} settings={createDefaultDisciplineSettings()} onSetup={jest.fn()} observations={observations as any}/>);
 expect(view.getByTestId('protect-websites-status')).toHaveTextContent('Needs attention');
 expect(view.getByTestId('protect-websites-state')).toHaveStyle({backgroundColor:getAppPalette('light').attentionTint});
});
test('unconfigured available protection is red and unsupported protection is neutral',()=>{
 mockDns={...mockDns,status:{...dns,configured:false,enabled:false}};
 const view=overview({status:{...policy,authorized:false,adultFilterActive:false,adultWebPolicyConfigured:false}});
 expect(view.getByTestId('protect-websites-status')).toHaveTextContent('Off');
 expect(view.getByTestId('protect-websites-state')).toHaveStyle({backgroundColor:getAppPalette('light').offTint});
 expect(view.getByTestId('protect-websites-switch')).not.toBeChecked();
 mockDns={...mockDns,status:{...dns,supported:false,releaseEnabled:false,configured:false,enabled:false}};
 view.rerender(<ProtectOverview capability={null} status={null} settings={createDefaultDisciplineSettings()} onSetup={jest.fn()}/>);
 expect(view.getByTestId('protect-websites-status')).toHaveTextContent('Unavailable');
 expect(view.getByTestId('protect-websites-state')).toHaveStyle({backgroundColor:getAppPalette('light').surface2});
 expect(view.getByTestId('protect-websites-switch')).toBeDisabled();
});
test('a current native read warning invalidates an older green observation set',()=>{
 const view=overview({observations,syncMessage:'Current configuration is unknown.'});
 expect(view.getByTestId('protect-websites-status')).toHaveTextContent('Needs attention');
 expect(view.getByTestId('protect-websites-state')).toHaveStyle({backgroundColor:getAppPalette('light').attentionTint});
});
test('an independent observed web policy remains visible after the requested baseline is off',()=>{
 mockDns={...mockDns,status:{...dns,configured:false,enabled:false,healthy:null}};
 const view=overview({status:{...policy,adultFilterActive:false,adultFilterRequested:false,adultWebPolicyConfigured:true}});
 expect(view.getByTestId('protect-websites-status')).toHaveTextContent('Needs attention');
 expect(view.getByTestId('protect-websites-state')).toHaveStyle({backgroundColor:getAppPalette('light').attentionTint});
});
test('DNS is primary even with Advanced available and a configuration check appears once',()=>{
 const advanced=jest.fn(),view=setup({onAdvanced:advanced});
 expect(view.queryByTestId('dns-section')).toBeNull();
 expect(view.getAllByRole('button',{name:'Check configuration'})).toHaveLength(1);
 expect(mockDns.configure).not.toHaveBeenCalled();fireEvent.press(view.getByTestId('website-open-advanced'));expect(advanced).toHaveBeenCalledTimes(1);
});
test('DNS standalone check defaults on and can be suppressed for the composed wizard',()=>{
 const view=render(<EncryptedDnsSection setup/>);expect(view.getByTestId('dns-refresh')).toBeOnTheScreen();
 view.rerender(<EncryptedDnsSection setup showConfigurationCheck={false}/>);
 expect(view.queryByTestId('dns-refresh')).toBeNull();
});
test('current observed proof has consistent browsing results and needs no redundant wizard check',()=>{
 mockDns={...mockDns,status:{...dns,healthy:null}};
 const view=setup({observations});
 expect(view.getByTestId('website-overall-status')).toHaveTextContent('On');
 expect(view.getByTestId('website-browsing-test-status')).toHaveTextContent('Verified on this network.');
 expect(view.queryByTestId('dns-browsing-test-status')).toBeNull();
 expect(view.queryByTestId('website-configuration-step')).toBeNull();
 mockDns={...mockDns,lastCheckedAt:101};view.rerender(<IOSWebsiteProtectionSetup readiness={getProtectionSetupReadiness(capability,policy,0)} authorized busy={false} error={null} observations={observations as any} onRun={jest.fn()} onRefresh={jest.fn(async()=>({capability,status:policy,readTicket:{revision:1,isCurrent:()=>true}}))} onClose={jest.fn()} onOpenTest={jest.fn()}/>);
 expect(view.getByTestId('website-overall-status')).toHaveTextContent('Needs attention');
 expect(view.queryByTestId('dns-browsing-test-status')).toBeNull();
 expect(view.getByTestId('website-configuration-step')).toBeOnTheScreen();
});
test('overview skips empty native group rows before the three-row limit and keeps pending selections',()=>{
 const group={id:'empty',revision:1,rule:{kind:'daily-limit',limitMinutes:30},enabled:false,ready:false,packages:[],applicationCount:0,draftApplicationCount:null};
 const groups:any={supported:true,platform:'ios',revision:1,configurationGeneration:0,scopeEpoch:1,groups:[group,{...group,id:'empty-two'},{...group,id:'empty-three'},{...group,id:'committed',applicationCount:2,draftApplicationCount:0},{...group,id:'pending',draftApplicationCount:1}],legacyCompatibility:{retained:false,applicationCount:0}};
 const view=overview({capability:{...capability,appGroups:true},groups});
 expect(view.queryByTestId('protect-apps-group-empty')).toBeNull();expect(view.queryByTestId('protect-apps-group-empty-two')).toBeNull();
 expect(view.getByTestId('protect-apps-group-committed')).toBeOnTheScreen();expect(view.getByTestId('protect-apps-group-committed')).toHaveTextContent(/30 minutes shared across these apps/);expect(view.getByTestId('protect-apps-group-pending')).toBeOnTheScreen();expect(view.queryByTestId('protect-apps-empty')).toBeNull();
 view.rerender(<ProtectOverview capability={{...capability,appGroups:true}} status={policy} settings={createDefaultDisciplineSettings()} onSetup={jest.fn()} groups={{...groups,groups:[group]}}/>);
 expect(view.getByTestId('protect-apps-empty')).toHaveTextContent('No group apps selected. Add apps to begin.');
 expect(view.getByTestId('protect-add-group')).toBeOnTheScreen();
});
test('configuration readback and browser taps never manufacture verification',async()=>{
 const open=jest.fn(),view=setup({onOpenTest:open});
 await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});
 fireEvent.press(view.getByTestId('website-test-toggle'));fireEvent.press(view.getByTestId('website-test-adult'));fireEvent.press(view.getByTestId('website-test-normal'));
 expect(open.mock.calls).toEqual([['https://nudity.testcategory.com'],['https://example.com']]);
 expect(view.getByTestId('website-browsing-test-status')).toHaveTextContent('Browsing test needed');
 expect(view.queryByText(/verified on this network/i)).toBeNull();
});
test('unknown or superseded native readback cannot advance the current setup task',async()=>{
 const refresh=jest.fn(async()=>({})),view=setup({onRefresh:refresh});
 await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});
 expect(view.getByTestId('website-next-step')).toHaveTextContent(/Check configuration/);
 refresh.mockResolvedValue({capability,status:policy,superseded:true} as any);
 await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});
 expect(view.getByTestId('website-next-step')).toHaveTextContent(/Check configuration/);
});

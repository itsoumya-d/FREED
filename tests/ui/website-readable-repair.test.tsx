import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { IOSWebsiteProtectionSetup } from '@/components/IOSWebsiteProtectionSetup';
import { getProtectionSetupReadiness } from '@/lib/protection-readiness';
import { appI18n } from '@/i18n/runtime';
jest.mock('@/hooks/use-encrypted-dns',()=>({useEncryptedDns:()=>({status:{supported:true,configured:false,enabled:false,reason:null},refresh:jest.fn(async()=>({reason:null}))})}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));
jest.mock('@/components/EncryptedDnsSection',()=>({EncryptedDnsSection:()=>null}));
const capability:any={platform:'ios',screenTime:true,managedSettings:true,accessibility:false,dnsFiltering:true,localVpnFallback:false,notes:[]};
beforeEach(async()=>{await appI18n.changeLanguage('en');});
test('failed policy is Needs attention, not a perpetual Setting up, with one current action',()=>{
 const run=jest.fn(),status:any={authorized:true,adultFilterActive:false,adultWebPolicyConfigured:false,active:false,mode:'screen-time',message:''};
 const view=render(<IOSWebsiteProtectionSetup readiness={getProtectionSetupReadiness(capability,status,0)} next={{action:'apply-adult-filter'} as any} authorized busy={false} error="Policy storage failed" onRun={run} onRefresh={jest.fn(async()=>({}))} onClose={jest.fn()} onOpenTest={jest.fn()} onAdvanced={jest.fn()}/>);
 expect(view.getByTestId('website-overall-status')).toHaveTextContent('Needs attention');
 expect(view.queryByTestId('feature-setup-refresh')).toBeNull();expect(view.queryByTestId('website-configuration-check')).toBeNull();
 fireEvent.press(view.getByTestId('feature-setup-continue'));expect(run).toHaveBeenCalledTimes(1);
});
test('configured policy has one setup check; browser links do not appear or record a pass without explicit test entry',()=>{
 const status:any={authorized:true,adultFilterActive:true,adultWebPolicyConfigured:true,active:true,mode:'screen-time',message:''};
 const open=jest.fn(),view=render(<IOSWebsiteProtectionSetup readiness={getProtectionSetupReadiness(capability,status,0)} authorized busy={false} error={null} onRun={jest.fn()} onRefresh={jest.fn(async()=>({}))} onClose={jest.fn()} onOpenTest={open} onAdvanced={jest.fn()}/>);
 expect(view.getAllByRole('button',{name:'Check configuration'})).toHaveLength(1);expect(open).not.toHaveBeenCalled();
 expect(view.queryByTestId('website-test-adult')).toBeNull();expect(view.queryByText(/test passed/i)).toBeNull();
});

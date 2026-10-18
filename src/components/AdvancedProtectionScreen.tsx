import React from 'react';
import { IOSWebsiteRecoveryProbe } from './IOSWebsiteRecoveryProbe';
import { ScrollView } from 'react-native';
import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
import { useAppTheme } from '@/design-system/use-app-theme';
import { MomentumPageHeader, MomentumSection } from './MomentumPageHeader';
import { EncryptedDnsSection } from './EncryptedDnsSection';
import { View, Text, Pressable } from './Localized';
export function AdvancedProtectionScreen({capability,status,onPermissions,onSafariSetup,onExceptions,onDiagnostics}:{capability:ProtectionCapability|null;status:ProtectionStatus|null;onPermissions:()=>void;onSafariSetup?:()=>void;onExceptions:()=>void;onDiagnostics:()=>void}) {
 const {colors}=useAppTheme();const row=(label:string,description:string,action:()=>void,id:string)=><Pressable testID={id} accessibilityRole="button" onPress={action} style={{minHeight:56,paddingVertical:12,gap:4}}><Text style={{color:colors.accent,fontSize:17,fontWeight:'700'}}>{label}</Text><Text style={{color:colors.text2,fontSize:15,lineHeight:22}}>{description}</Text></Pressable>;
 return <ScrollView testID="advanced-protection-screen" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:24,gap:20}}><MomentumPageHeader pose="guide" context="protection-advanced" title="Advanced protection" description="Optional layers and device checks. App timing belongs in each group’s rule." category="reflection" compact restrained/>
 <MomentumSection title="Device permissions" category="commitment"><Text style={{color:colors.text2,fontSize:17,lineHeight:24}}>{capability?.platform==='ios'?(status?.authorized?'Screen Time is authorized. Apply and check the adult policy in website setup.':'Allow Screen Time inside FREED to configure supported protection.'):'Android needs usage access and accessibility for app rules. Each action opens the supported device settings route.'}</Text>{row('Review permissions','Return to FREED after changing a permission to read the device state.',onPermissions,'advanced-permissions')}</MomentumSection>
 <MomentumSection title="Optional DNS layer" category="calm"><EncryptedDnsSection setup={capability?.platform==='ios'}/></MomentumSection>
 <MomentumSection title="Other controls" category="reflection">{onSafariSetup?row('Safari protection','Review optional Safari extension permissions.',onSafariSetup,'advanced-safari'):null}{row('Domain exceptions','Review only FREED’s domain exceptions.',onExceptions,'advanced-exceptions')}{row('Diagnostics','Check configuration and a URL without claiming a browsing result.',onDiagnostics,'advanced-diagnostics')}</MomentumSection>
 <IOSWebsiteRecoveryProbe/>
 </ScrollView>;
}

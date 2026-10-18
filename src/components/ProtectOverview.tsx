import React from 'react';
import { SpringPressable } from '@/design-system/motion';
import { appI18n, translateSource } from '@/i18n/runtime';
import type { AppGroupsSnapshot } from '@/lib/app-groups-contract';
import { type AdultProtectionObservations } from '@/lib/adult-protection-presentation';
import { useAdultProtectionPresentation } from '@/hooks/use-adult-protection-presentation';
import { getAppProtectionPresentation } from '@/lib/app-protection-presentation';
import { NativeAppGroupLabels } from './NativeAppGroupLabels';
import { InstalledGroupAppsPreview } from './InstalledGroupApps';
import { ScrollView, Switch } from 'react-native';
import { Link, type Href } from 'expo-router';
import { ChevronRight } from './DirectionalIcons';
import { Globe2, Grid2X2 } from 'lucide-react-native';
import { Text, View, Pressable } from './Localized';
import { MomentumSection, useMomentumBottomPadding } from './MomentumPageHeader';
import { useAppTheme } from '@/design-system/use-app-theme';
import { getProtectionSetupReadiness, type ProtectionFeatureReadiness, type ProtectionIntent } from '@/lib/protection-readiness';
import { freedShieldSectionPath, freedShieldSectionTitle, type FreedShieldSection } from '@/lib/native-navigation';
import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
import { APP_GUARD_MODES, describeAppGuard } from '@/lib/app-guard';
import type { DisciplineSettings } from '@/lib/recovery-state';

function actionFor(feature: ProtectionFeatureReadiness) {
  if (feature.status === 'Needs attention') return 'Fix';
  if (feature.status === 'On' || feature.status === 'Unavailable') return 'Check';
  return 'Set up';
}

function actionAccessibilityLabel(feature: ProtectionFeatureReadiness, website: boolean) {
  if (feature.status === 'Needs attention') return website ? 'Fix adult website protection' : 'Fix app protection';
  if (feature.status === 'Unavailable') return 'Check device support';
  if (feature.status === 'On') return website ? 'Review adult website protection' : 'Review app protection';
  return website ? 'Set up adult website protection' : 'Set up app protection';
}

export function ProtectOverview({ actionScope=null, capability, status, settings, onSetup, onRequestedChange, observations, syncing = false, syncMessage, onRetry, groups, groupsPending, groupsError, groupsWaitingForOwner, onOpenGroups, onOpenGroup, onAddGroup, onOpenRecovery }: { actionScope?:string|null; onOpenRecovery?:()=>void; observations?: AdultProtectionObservations|null; onRequestedChange?:(requested:boolean)=>void; groups?: AppGroupsSnapshot|null; groupsPending?: boolean; groupsError?: string|null; groupsWaitingForOwner?: boolean; onOpenGroups?:()=>void; onOpenGroup?:(groupId:string)=>void; onAddGroup?:()=>void; capability: ProtectionCapability | null; status: ProtectionStatus | null; settings: DisciplineSettings; onSetup: (intent: ProtectionIntent) => void; syncing?: boolean; syncMessage?: string|null; onRetry?: () => void }) {
  const [details, setDetails] = React.useState<ProtectionIntent | null>(null);
  const { colors } = useAppTheme();
  const bottom = useMomentumBottomPadding();
  const adult = useAdultProtectionPresentation({ capability, status, observations, syncing, syncMessage });
  const guard = describeAppGuard(capability, status, settings.appGuardMode);
  const readiness = getProtectionSetupReadiness(capability, status, settings.blockedAppPackages.length, 'both', settings.appGuardMode);
  const appProtection = getAppProtectionPresentation({ modernGroups: capability?.appGroups === true, groups, pending: groupsPending, error: groupsError, waitingForOwner: groupsWaitingForOwner, legacy: readiness.appLimits });

  const link = (section: FreedShieldSection, description: string) => <Link key={section} href={freedShieldSectionPath(section) as Href} asChild withAnchor>
    <Pressable testID={`shield-open-${section}`} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 64, padding: 12, borderRadius: 16, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? .7 : 1 })}>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 24 }}>{freedShieldSectionTitle(section)}</Text>
        <Text style={{ color: colors.text2, fontSize: 14, lineHeight: 20 }}>{description}</Text>
      </View>
      <View style={{ flexShrink: 0 }}><ChevronRight color={colors.text2} size={20} /></View>
    </Pressable>
  </Link>;

  return <ScrollView testID="shield-overview" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: bottom }}>
    <Text accessibilityRole="header" style={{color:colors.text,fontSize:28,lineHeight:36,fontWeight:'800'}}>Protect</Text>
    {syncing ? <Text accessibilityLiveRegion="polite" style={{ color: colors.text2, lineHeight: 24 }}>Updating protection…</Text> : syncMessage ? <Text accessibilityRole="alert" style={{ color: colors.text2, lineHeight: 24 }}>{syncMessage}</Text> : null}
    {syncMessage && onRetry ? <Pressable accessibilityRole="button" testID="protect-sync-retry" disabled={syncing} onPress={onRetry} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontWeight: '700' }}>Retry</Text></Pressable> : null}

    {(['websites', 'apps'] as const).map(intent => {
      const website = intent === 'websites';
      const feature = website ? {...readiness.websiteProtection,status:adult.status as ProtectionFeatureReadiness['status']} : readiness.appLimits;
      const name = website ? 'Adult websites' : 'Apps';
      const action = actionFor(feature);
      const actionLabel = actionAccessibilityLabel(feature, website);
      const Icon = website ? Globe2 : Grid2X2;
      const coverage = website
        ? capability?.platform === 'ios'
          ? 'Screen Time can block supported adult websites.'
          : capability?.platform === 'android'
            ? 'DNS Guard can block supported adult website lookups.'
            : feature.explanation
        : capability?.platform === 'ios' || capability?.platform === 'android'
          ? 'Covers selected apps; Shorts and Reels cannot be separated within an app.'
          : feature.supported
            ? 'Covers selected apps; Shorts and Reels cannot be separated within an app.'
            : 'App limits require a supported native iOS or Android build.';
      const targetCount = capability?.platform === 'ios' ? readiness.selectedIosTargets : readiness.appCount;
      const targetLabel = capability?.platform === 'ios' && !capability.appGuardModes ? `${targetCount} selected targets` : `${targetCount} selected apps`;
      const modeLabel = APP_GUARD_MODES.find(item => item.value === status?.appGuardMode)?.label;
      const showAppSummary = !website && capability?.platform !== undefined;
      const nativeDailyLimit = capability?.platform === 'android' && guard.mode === 'daily-limit' && typeof status?.dailyLimitMinutes === 'number' ? status.dailyLimitMinutes : undefined;
      const statusColor = website ? adult.tone === 'on' ? colors.success : adult.tone === 'attention' ? colors.warning : adult.tone === 'off' ? colors.red : colors.text2 : feature.status === 'On' ? colors.mint : feature.status === 'Needs attention' ? colors.warning : colors.text2;
      const stateSurface = colors.surface;
      const selectedGroups = groups?.groups.filter(group => group.applicationCount > 0 || (group.draftApplicationCount ?? 0) > 0 || group.packages.length > 0) ?? [];

      if (!website && capability?.appGroups) return <MomentumSection key={intent} category="movement" testID="protect-apps-card">
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Grid2X2 accessible={false} size={22} color={colors.accent}/><View style={{flex:1,minWidth:0,gap:4}}><Text accessibilityRole="header" testID="protect-apps-title" style={{color:colors.text,fontSize:21,lineHeight:28,fontWeight:'800'}}>Apps</Text><Text testID="protect-apps-status" style={{color:colors.text2,fontSize:15,lineHeight:22}}>{appProtection.status}</Text></View></View>
        {groups && selectedGroups.slice(0,3).map(group=><Pressable testID={`protect-apps-group-${group.id}`} key={group.id} accessibilityRole="button" onPress={() => onOpenGroup ? onOpenGroup(group.id) : onOpenGroups?.()} style={{minHeight:56,gap:6,paddingVertical:12,borderTopWidth:1,borderColor:colors.border}}>{groups.platform==='ios'?<NativeAppGroupLabels key={groups.revision} groupId={group.id} draft={group.draftApplicationCount!=null} layout="preview" configurationGeneration={groups.configurationGeneration} scopeEpoch={groups.scopeEpoch} storeRevision={groups.revision} groupRevision={group.revision}/>:<InstalledGroupAppsPreview actionScope={actionScope} packages={group.packages}/>}<Text translate={false} style={{color:colors.text,fontSize:15,lineHeight:22}}>{group.rule.kind==='daily-limit'?`${group.rule.limitMinutes.toLocaleString(appI18n.language)} ${translateSource('minutes shared across these apps')}`:translateSource(group.rule.kind==='before-use'?'Before use':group.rule.kind==='scheduled'?'Schedule':'Existing protection')}</Text><Text style={{color:colors.text2,fontSize:15}}>{group.draftApplicationCount!=null?'Changes not applied':!group.enabled?'Off':group.ready?'Ready':'Needs attention'}</Text></Pressable>)}
        {groups?.supported && selectedGroups.length === 0 ? <Text testID="protect-apps-empty" style={{color:colors.text2,fontSize:17,lineHeight:24}}>No group apps selected. Add apps to begin.</Text> : null}

        <View style={{alignItems:'stretch',gap:12}}>{groups?.supported && selectedGroups.length === 0 && !groups.legacyCompatibility.retained && !groups.groups.some(group=>group.draftApplicationCount!=null||group.categoryCount>0||group.webDomainCount>0) && !groups.reason && !syncing && !syncMessage && Boolean(onAddGroup??onOpenGroups) ? null : <Pressable testID="protect-apps-setup" accessibilityRole="button" onPress={() => onOpenGroups ? onOpenGroups() : onSetup('apps')} style={{maxWidth:'100%',minWidth:0,minHeight:48,padding:12,borderRadius:14,backgroundColor:colors.surface2,alignItems:'center',justifyContent:'center'}}><Text style={{maxWidth:'100%',minWidth:0,color:colors.accent,fontSize:17,lineHeight:24,fontWeight:'700',textAlign:'center'}}>Review apps</Text></Pressable>}
        <Pressable testID="protect-add-group" accessibilityRole="button" disabled={!groups?.supported} onPress={() => (onAddGroup ?? onOpenGroups)?.()} style={{maxWidth:'100%',minWidth:0,minHeight:48,padding:12,borderRadius:14,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center',opacity:!groups?.supported?.55:1}}><Text style={{maxWidth:'100%',minWidth:0,color:colors.onAccent,fontSize:17,lineHeight:24,fontWeight:'700',textAlign:'center'}}>Add apps</Text></Pressable></View>
      </MomentumSection>;

      return <MomentumSection key={intent} category={website ? 'commitment' : 'movement'} testID={`protect-${intent}-card`}>
        {website ? <View testID="protect-websites-state" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor:stateSurface }}>
          <Globe2 accessible={false} color={colors.accent} size={22} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text testID="protect-websites-title" accessibilityRole="header" style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '800' }}>{name}</Text><Text testID="protect-websites-status" accessibilityLiveRegion="polite" style={{ color: statusColor, fontSize: 15, lineHeight: 22, fontWeight: '700' }}>{feature.status}</Text></View>
          <Switch accessible testID="protect-websites-switch" accessibilityRole="switch" accessibilityLabel={translateSource('Adult website protection')} accessibilityHint={translateSource('Opens setup or review before changing protection.')} accessibilityState={{ disabled: syncing || !adult.supported, checked: adult.requested }} disabled={syncing || !adult.supported} value={adult.requested} onValueChange={requested => onRequestedChange ? onRequestedChange(requested) : onSetup('websites')} trackColor={{ false: colors.surface3, true: adult.verified ? colors.success : colors.warning }} style={{ minHeight: 44, flexShrink: 0 }} />
        </View> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View accessible={false} pointerEvents="none" style={{ flexShrink: 0 }}><Icon color={colors.accent} size={24} /></View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text testID={`protect-${intent}-title`} accessibilityRole="header" style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '800' }}>{name}</Text>
            <Text testID={`protect-${intent}-status`} accessibilityLiveRegion="polite" style={{ color: statusColor, fontSize: 14, lineHeight: 20, fontWeight: '700' }}>{feature.status}</Text>
          </View>
        </View>}

        {!website?<Text testID={`protect-${intent}-coverage`} style={{ color: colors.text2, fontSize: 16, lineHeight: 23 }}>{coverage}</Text>:null}
        {website ? <Text testID="protect-websites-next-step" style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{adult.nextAction}</Text> : null}

        {showAppSummary ? <View testID="protect-apps-target-summary" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, lineHeight: 23, fontWeight: '600' }}>{targetLabel}</Text>
          {targetCount > 0 && modeLabel ? <Text style={{ color: colors.text2, fontSize: 15, lineHeight: 22 }}>{modeLabel}</Text> : null}
          {nativeDailyLimit !== undefined ? <Text style={{ color: colors.text2, fontSize: 15, lineHeight: 22 }}>{`${nativeDailyLimit} minutes`}</Text> : null}
        </View> : null}

        <Pressable testID={`protect-${intent}-details-toggle`} accessibilityRole="button" accessibilityState={{ expanded: details === intent }} onPress={() => setDetails(value => value === intent ? null : intent)} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? .7 : 1 })}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>How protection works</Text>
        </Pressable>
        {details === intent ? <View testID={`protect-${intent}-details`} style={{ gap: 8 }}>
          {website ? <><Text testID="protect-websites-coverage" style={{color:colors.text2,fontSize:15,lineHeight:22}}>{coverage}</Text><Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{adult.description}</Text></> : null}
          <Text style={{ color: colors.text2, fontSize: 15, lineHeight: 23 }}>{feature.scope}</Text>
          <Text style={{ color: colors.text2, fontSize: 15, lineHeight: 23 }}>{feature.explanation}</Text>
        </View> : null}

        <Pressable testID={`protect-${intent}-setup`} accessibilityRole="button" accessibilityLabel={actionLabel} onPress={() => onSetup(intent)} style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.surface2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, opacity: pressed ? .7 : 1 })}>
          <Text style={{ flex: 1, minWidth: 0, color: colors.accent, fontSize: 17, lineHeight: 24, fontWeight: '700' }}>{action}</Text><ChevronRight accessible={false} color={colors.accent} size={20}/>
        </Pressable>
      </MomentumSection>;
    })}

    {onOpenRecovery ? <View testID="protect-recovery-entry" style={{ gap: 8, paddingVertical: 8 }}><SpringPressable testID="protect-open-recovery" accessibilityRole="button" onPress={onOpenRecovery} style={{ minHeight: 52, padding: 16, borderRadius: 16, backgroundColor: colors.surface2, flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: colors.accent, fontSize: 17, lineHeight: 24, fontWeight: '700' }}>Open a reset</Text></View><ChevronRight color={colors.accent} size={20} /></SpringPressable><Text style={{ color: colors.text2, fontSize: 13, lineHeight: 20 }}>Adult websites stay blocked during a reset.</Text></View> : null}
    <MomentumSection category="reflection" testID="protect-advanced">
      {link('advanced', 'Safari, permissions and repair details')}
    </MomentumSection>
  </ScrollView>;
}

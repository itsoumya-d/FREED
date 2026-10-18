import React from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, Pressable, View } from './Localized';
import { MomentumPageHeader, useMomentumBottomPadding } from './MomentumPageHeader';
import { useAppTheme } from '@/design-system/use-app-theme';
import { searchFeatures, getFeatureStatus, type FeatureId, type FeatureStatusContext } from '@/lib/feature-catalogue';
import { translateSource } from '@/i18n/runtime';
export function FeatureDirectory({ context, onOpen, onBack }: { context: FeatureStatusContext; onOpen: (id: FeatureId) => void; onBack: () => void }) {
 const { colors } = useAppTheme(), bottom = useMomentumBottomPadding(); const { i18n } = useTranslation();
 const [search,setSearch] = React.useState(''); const features = searchFeatures(search,translateSource,i18n.language);
 return <ScrollView testID="feature-directory" contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,gap:16,paddingBottom:bottom}}>
 <MomentumPageHeader title="All features" description="Choose what you need. Status reflects this device and your current account." pose="guide" compact />
 <TextInput testID="feature-search" accessibilityLabel="Search all features" placeholder="Search all features" value={search} onChangeText={setSearch} style={{minHeight:48,padding:16,borderRadius:12,backgroundColor:colors.surface,color:colors.text}} />
 {(['Protect','Reset','Daily plan','Progress','Account/data'] as const).map(group => { const rows = features.filter(f => f.group === group); return rows.length ? <View key={group} style={{gap:12}}><Text accessibilityRole="header" style={{color:colors.text,fontSize:24,fontWeight:'800'}}>{group}</Text>{rows.map(f => <Pressable key={f.id} testID={`feature-${f.id}`} accessibilityRole="button" onPress={() => onOpen(f.id)} style={{padding:16,borderRadius:16,backgroundColor:colors.surface,gap:8,minHeight:96}}><Text style={{color:colors.text,fontSize:21,fontWeight:'700'}}>{f.title}</Text><Text style={{color:colors.text2,lineHeight:24}}>{f.purpose}</Text><Text testID={`feature-status-${f.id}`} accessibilityLiveRegion="polite" style={{color:colors.text2,fontSize:15}}>{getFeatureStatus(f,context)}</Text><Text style={{color:colors.accent,fontWeight:'700'}}>{f.action}</Text></Pressable>)}</View> : null; })}
 {!features.length ? <Text testID="feature-empty" accessibilityLiveRegion="polite" style={{color:colors.text2}}>No features match your search. Try another word.</Text> : null}
 <Pressable accessibilityRole="button" onPress={onBack} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:colors.accent}}>Back</Text></Pressable>
 </ScrollView>;
}

/** Root feature routes show the requested existing form/report, expanded on entry. */
export function FocusedFeatureContent({ focus, children }: { focus?: string; children: React.ReactNode }) {
 if (!focus || focus === 'practices') return <>{children}</>;
 const titles: Record<string, readonly string[]> = {
  account: ['Sign-in'], routine: ['Your routine'], backup: ['Encrypted Backup'], reminders: ['Reminders'], accountability: ['Accountability'], privacy: ['Privacy & support'],
  activity: ['Activity estimate','Activity Estimates'], adaptive: ['ADAPTIVE SIGNALS'], achievements: ['Milestones and achievements'], insight: ['PERSONAL INSIGHT'], weekly: ['Weekly Report'], monthly: ['Monthly growth'], estimate: ['Urge estimate'], analytics: ['PRIVACY-SAFE SNAPSHOT','Analytics sharing']
 };
 return <>{React.Children.toArray(children).filter(child => React.isValidElement<{ title?: string; state?: unknown }>(child) && (focus === 'history' ? Boolean(child.props.state) : titles[focus]?.includes(child.props.title ?? ''))).map((child,index) => React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<{collapsible?: boolean; initiallyExpanded?: boolean}>, { key: `${focus}-${index}`, collapsible: false, initiallyExpanded: true }) : child)}</>;
}

import React from 'react';
import { Modal, ScrollView, TextInput, Image } from 'react-native';
import { getInstalledGroupApps, isNativeAccountActionScopeCurrent } from 'freed-protection';
import type { InstalledGroupApp } from '@/lib/app-groups-contract';
import { useAppTheme } from '@/design-system/use-app-theme';
import { translateSource } from '@/i18n/runtime';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable } from './Localized';
function AppRow({app,selected,onPress}:{app:InstalledGroupApp;selected?:boolean;onPress?:()=>void}) {
 const {colors}=useAppTheme();return <Pressable accessibilityRole={onPress?'checkbox':'text'} accessibilityState={{checked:selected,disabled:!app.eligible}} disabled={!onPress || !app.eligible} onPress={onPress} style={{minHeight:56,flexDirection:'row',alignItems:'center',gap:12,paddingVertical:8}}>
  {app.iconUri?<Image source={{uri:app.iconUri}} style={{width:36,height:36,borderRadius:8}} accessibilityIgnoresInvertColors/>:null}
  <Text translate={false} style={{flex:1,color:app.eligible?colors.text:colors.text2,fontSize:17}}>{app.name}</Text>
  {onPress?<Text translate={false} style={{color:colors.accent,fontSize:22}}>{selected?'☑':'☐'}</Text>:null}
 </Pressable>;
}
export function InstalledGroupAppsPreview({packages,actionScope}:{packages:string[];actionScope:string|null}) {
 const [apps,setApps]=React.useState<InstalledGroupApp[]>([]);const {colors}=useAppTheme();
 React.useEffect(()=>{setApps([]);let alive=true;void Promise.all(packages.slice(0,4).map(async id=>{try{return(await getInstalledGroupApps(id,0,60,actionScope)).apps.find(a=>a.packageName===id) ?? null;}catch{return null;}})).then(rows=>{if(alive&&isNativeAccountActionScopeCurrent(actionScope))setApps(rows.filter((a):a is InstalledGroupApp=>a!==null));});return()=>{alive=false;};},[packages.join('\0'),actionScope]);
 return <View>{apps.map(app=><AppRow key={app.packageName} app={app}/>)}{packages.length && !apps.length?<Text style={{color:colors.text2}}>Installed app previews are unavailable. Check selection.</Text>:null}</View>;
}
export function InstalledGroupAppsChooser({selected,onDone,onClose,actionScope}:{actionScope:string|null;selected:string[];onDone:(packages:string[])=>void;onClose:()=>void}) {
 const {colors}=useAppTheme();const [draft,setDraft]=React.useState(selected),[query,setQuery]=React.useState(''),[apps,setApps]=React.useState<InstalledGroupApp[]>([]),[next,setNext]=React.useState<number|null>(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(false);
 const epoch=React.useRef(0);
 const load=async(offset:number,search=query)=>{const read=++epoch.current;setBusy(true);setError(false);try{const page=await getInstalledGroupApps(search,offset,60,actionScope);if(read!==epoch.current||!isNativeAccountActionScopeCurrent(actionScope))return;setApps(previous=>offset?[...previous,...page.apps]:page.apps);setNext(page.nextOffset);setError(!page.supported);}catch{if(read===epoch.current)setError(true);}finally{if(read===epoch.current)setBusy(false);}};
 React.useEffect(()=>{setApps([]);setNext(null);const timer=setTimeout(()=>{void load(0,query);},150);return()=>{clearTimeout(timer);epoch.current++;};},[query,actionScope]);
 const action=(label:string,onPress:()=>void,id?:string)=><Pressable testID={id} accessibilityRole="button" onPress={onPress} style={{minHeight:44,padding:12,justifyContent:'center'}}><Text style={{color:colors.accent,fontWeight:'700',fontSize:17}}>{label}</Text></Pressable>;
 return <Modal visible presentationStyle="pageSheet" animationType="slide" onRequestClose={onClose}><SafeAreaView style={{flex:1,backgroundColor:colors.bg}}><View style={{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:12}}>{action('Cancel',onClose)}{action('Done',()=>{if(isNativeAccountActionScopeCurrent(actionScope))onDone(draft);},'group-apps-done')}</View><View style={{paddingHorizontal:24,gap:8}}><Text accessibilityRole="header" style={{color:colors.text,fontSize:24,fontWeight:'700'}}>Choose installed apps</Text><TextInput testID="group-apps-search" accessibilityLabel={translateSource('Search installed apps')} placeholder={translateSource('Search installed apps')} placeholderTextColor={colors.text2} value={query} onChangeText={setQuery} autoCorrect={false} style={{minHeight:48,padding:12,borderRadius:12,backgroundColor:colors.surface2,color:colors.text,fontSize:17}}/></View><ScrollView contentContainerStyle={{padding:24}}>{apps.map(app=><AppRow key={app.packageName} app={app} selected={draft.includes(app.packageName)} onPress={()=>setDraft(old=>old.includes(app.packageName)?old.filter(id=>id!==app.packageName):old.length<200?[...old,app.packageName]:old)}/>)}{busy?<Text style={{color:colors.text2}}>Checking installed apps…</Text>:null}{error?<Text accessibilityRole="alert" style={{color:colors.red}}>Installed apps could not be read. Retry on this device.</Text>:null}{next!==null? action('Show more apps',()=>{void load(next);}):null}</ScrollView></SafeAreaView></Modal>;
}

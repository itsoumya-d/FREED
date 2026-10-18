import React from 'react';
import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
import { useAppTheme } from '@/design-system/use-app-theme';
import { appI18n } from '@/i18n/runtime';
import type { AppGroupValueOptionsProps } from './AppGroupValueOptions';
export function AppGroupValueOptions({label,value,options,onChange}:AppGroupValueOptionsProps) {
 const {colors,mode}=useAppTheme();
 return <Host colorScheme={mode} layoutDirection={appI18n.dir()==='rtl'?'rightToLeft':'leftToRight'} style={{width:'100%',height:240}}><Picker label={label} selection={value} onSelectionChange={selected=>{if(options.some(option=>option.value===selected))onChange(selected);}} modifiers={[pickerStyle('wheel'),tint(colors.accent)]}>{options.map(option=><Text key={option.value} modifiers={[tag(option.value)]}>{option.label}</Text>)}</Picker></Host>;
}

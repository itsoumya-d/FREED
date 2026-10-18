import React from 'react';
import { Pressable, Text, View } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
export type AppGroupValueOption = { value: number; label: string; testID: string };
export type AppGroupValueOptionsProps = { label: string; value: number; options: AppGroupValueOption[]; onChange: (value: number) => void };
export function AppGroupValueOptions({ value, options, onChange }: AppGroupValueOptionsProps) {
 const {colors}=useAppTheme();
 return <View accessibilityRole="radiogroup">{options.map(option=><Pressable key={option.value} testID={option.testID} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{checked:option.value===value}} onPress={()=>onChange(option.value)} style={{minHeight:48,padding:12,backgroundColor:option.value===value?colors.surface2:colors.surface,borderRadius:12}}><Text translate={false} style={{color:colors.text,fontSize:17}}>{option.label}{option.value===value?' ✓':''}</Text></Pressable>)}</View>;
}

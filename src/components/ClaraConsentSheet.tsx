import React from 'react';
import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Text, View, Pressable } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
export type ClaraConsentSheetProps = { visible: boolean; onClose: () => void; children: React.ReactNode };
/** Hosts the caller's existing consent controls; closing has no service or consent side effect. */
export function ClaraConsentSheet({ visible, onClose, children }: ClaraConsentSheetProps) {
  const { colors } = useAppTheme();
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView testID="clara-consent-sheet" style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 24, lineHeight: 32, fontWeight: '800' }}>Cloud chat</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close cloud settings" onPress={onClose}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><X color={colors.text2} size={22} /></Pressable>
      </View>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
        {children}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

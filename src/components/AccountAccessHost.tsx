import React from 'react';
import { Keyboard, Modal, View } from 'react-native';
import { BasicHelpPresentation } from './BasicHelp';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccountAccessScreen, type AccountAccessScreenHandle, type AccountAccessScreenProps } from './AccountAccessScreen';

/** One app-owned presentation; route changes never own its drafts or operation. */
export function AccountAccessHost({ visible, ...accountProps }: AccountAccessScreenProps & { visible: boolean }) {
  return visible ? <AccountAccessPresentation {...accountProps} /> : null;
}

function AccountAccessPresentation(props: AccountAccessScreenProps) {
  // Each presentation owns its ref. A late native Back event from a dismissed
  // presentation sees its cleared ref, never a newly opened account session.
  const account = React.useRef<AccountAccessScreenHandle>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" allowSwipeDismissal={false}
      onRequestClose={() => { if (helpOpen) setHelpOpen(false); else account.current?.requestBack(); }}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }} accessibilityViewIsModal={!helpOpen} accessibilityElementsHidden={helpOpen} importantForAccessibility={helpOpen ? "no-hide-descendants" : "auto"}>
          <AccountAccessScreen {...props} ref={account} onHelp={() => { Keyboard.dismiss(); setHelpOpen(true); }} />
        </View>
        <BasicHelpPresentation visible={helpOpen} onClose={() => setHelpOpen(false)} />
      </SafeAreaProvider>
    </Modal>
  );
}

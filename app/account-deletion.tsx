import { AccountDeletionPage } from "@/features/legal-pages";
import { Platform } from 'react-native';
import { useFreedAppController } from '@/features/freed-app';

function NativeAccountDeletion() {
  const controller = useFreedAppController();
  return controller.renderAccountDeletion();
}
export default function AccountDeletionRoute() { return Platform.OS === 'web' ? <AccountDeletionPage /> : <NativeAccountDeletion />; }

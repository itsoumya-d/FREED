import { Redirect, useLocalSearchParams } from 'expo-router';
import { FreedRoute } from '@/features/freed-app';
import { parseFreedShieldSection } from '@/lib/native-navigation';

export default function ShieldDetailRoute() {
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  const shieldSection = parseFreedShieldSection(section);
  if (!shieldSection) return <Redirect href="/shield" />;
  return <FreedRoute screen="main" tab="shield" shieldSection={shieldSection} />;
}

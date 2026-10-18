import { Redirect, useLocalSearchParams } from 'expo-router';
import { FreedRoute } from '@/features/freed-app';
import { parseFreedProfileSection } from '@/lib/native-navigation';

export default function ProfileDetailRoute() {
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  const profileSection = parseFreedProfileSection(section);
  if (!profileSection) return <Redirect href="/profile" />;
  return <FreedRoute screen="main" tab="profile" profileSection={profileSection} />;
}

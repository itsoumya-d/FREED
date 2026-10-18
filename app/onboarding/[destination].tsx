import { useLocalSearchParams } from 'expo-router';
import { FreedRoute } from '@/features/freed-app';
import { parseFreedRoute } from '@/lib/native-navigation';
export default function OnboardingRoute() {
  const { destination } = useLocalSearchParams<{ destination: string }>();
  return <FreedRoute screen={parseFreedRoute(`/onboarding/${destination}`).screen} />;
}

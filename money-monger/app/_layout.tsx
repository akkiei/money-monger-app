import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { colors } from '../src/theme/tokens';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_700Bold,
  });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
        // Swipe-from-edge to go back (iOS gesture; Android hardware back works too).
        gestureEnabled: true,
        animation: 'slide_from_right',
      }}
    />
  );
}

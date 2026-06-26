import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { bootAuth } from '../src/net/session';
import { colors } from '../src/theme/tokens';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_700Bold,
  });

  // Establish the anonymous Supabase session early so a token is ready for
  // create/join (the server verifies it in onAuth → becomes the playerId).
  useEffect(() => {
    void bootAuth();
  }, []);

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

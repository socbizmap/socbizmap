import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';

import { DataProvider } from '@/src/session';
import { colors, WEB_COLUMN_MAX_WIDTH } from '@/src/theme';

WebBrowser.maybeCompleteAuthSession();

export {
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  return (
    <DataProvider>
      <View style={styles.shell}>
        <View style={styles.column}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ title: 'SocBizMap' }} />
            <Stack.Screen name="auth/callback" options={{ title: 'SocBizMap', headerBackVisible: false }} />
            <Stack.Screen name="start" options={{ title: 'SocBizMap', headerBackVisible: false }} />
            <Stack.Screen name="map" options={{ title: 'SocBizMap' }} />
            <Stack.Screen name="pin/[id]" options={{ title: 'SocBizMap' }} />
            <Stack.Screen name="create" options={{ title: 'SocBizMap' }} />
            <Stack.Screen name="profile" options={{ title: 'SocBizMap' }} />
            <Stack.Screen name="chats" options={{ title: 'SocBizMap' }} />
            <Stack.Screen name="chat/[pinId]" options={{ title: 'SocBizMap' }} />
            <Stack.Screen name="reply-sent" options={{ title: 'SocBizMap' }} />
            <Stack.Screen name="rate" options={{ title: 'SocBizMap' }} />
            <Stack.Screen name="admin" options={{ title: 'SocBizMap' }} />
          </Stack>
        </View>
      </View>
    </DataProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: WEB_COLUMN_MAX_WIDTH,
    backgroundColor: colors.bg,
  },
});

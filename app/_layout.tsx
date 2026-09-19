import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { DataProvider } from '@/src/session';
import { colors, WEB_COLUMN_MAX_WIDTH } from '@/src/theme';

WebBrowser.maybeCompleteAuthSession();

export {
  ErrorBoundary,
} from 'expo-router';

function useWebPageShell() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.getElementById('root') ?? document.body;
    const prev = {
      htmlHeight: document.documentElement.style.height,
      htmlWidth: document.documentElement.style.width,
      bodyHeight: document.body.style.height,
      bodyWidth: document.body.style.width,
      bodyMargin: document.body.style.margin,
      bodyBg: document.body.style.background,
      rootHeight: root.style.height,
      rootWidth: root.style.width,
      rootDisplay: root.style.display,
      rootFlex: root.style.flexDirection,
    };
    document.documentElement.style.height = '100%';
    document.documentElement.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.width = '100%';
    document.body.style.margin = '0';
    document.body.style.background = colors.primarySoft;
    root.style.height = '100%';
    root.style.width = '100%';
    root.style.minHeight = '100vh';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    return () => {
      document.documentElement.style.height = prev.htmlHeight;
      document.documentElement.style.width = prev.htmlWidth;
      document.body.style.height = prev.bodyHeight;
      document.body.style.width = prev.bodyWidth;
      document.body.style.margin = prev.bodyMargin;
      document.body.style.background = prev.bodyBg;
      root.style.height = prev.rootHeight;
      root.style.width = prev.rootWidth;
      root.style.display = prev.rootDisplay;
      root.style.flexDirection = prev.rootFlex;
    };
  }, []);
}

export default function RootLayout() {
  useWebPageShell();
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
    minHeight: '100%',
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

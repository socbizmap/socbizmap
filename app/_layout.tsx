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
      htmlMaxHeight: document.documentElement.style.maxHeight,
      htmlWidth: document.documentElement.style.width,
      bodyHeight: document.body.style.height,
      bodyMaxHeight: document.body.style.maxHeight,
      bodyWidth: document.body.style.width,
      bodyMargin: document.body.style.margin,
      bodyBg: document.body.style.background,
      rootHeight: root.style.height,
      rootMaxHeight: root.style.maxHeight,
      rootMinHeight: root.style.minHeight,
      rootWidth: root.style.width,
      rootDisplay: root.style.display,
      rootFlex: root.style.flexDirection,
    };
    document.documentElement.style.width = '100%';
    document.body.style.width = '100%';
    document.body.style.margin = '0';
    document.body.style.background = colors.primarySoft;
    root.style.width = '100%';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';

    // 100vh includes the mobile URL bar, and body scroll is locked, so the
    // bottom of the column sits under the browser chrome. Pin the shell to
    // the visible viewport instead.
    const applyHeight = () => {
      const viewport = window.visualViewport;
      const height = Math.round(viewport?.height ?? window.innerHeight);
      const px = `${height}px`;
      document.documentElement.style.height = px;
      document.documentElement.style.maxHeight = px;
      document.body.style.height = px;
      document.body.style.maxHeight = px;
      root.style.height = px;
      root.style.maxHeight = px;
      root.style.minHeight = '0px';
    };
    applyHeight();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', applyHeight);
    viewport?.addEventListener('scroll', applyHeight);
    window.addEventListener('resize', applyHeight);
    return () => {
      viewport?.removeEventListener('resize', applyHeight);
      viewport?.removeEventListener('scroll', applyHeight);
      window.removeEventListener('resize', applyHeight);
      document.documentElement.style.height = prev.htmlHeight;
      document.documentElement.style.maxHeight = prev.htmlMaxHeight;
      document.documentElement.style.width = prev.htmlWidth;
      document.body.style.height = prev.bodyHeight;
      document.body.style.maxHeight = prev.bodyMaxHeight;
      document.body.style.width = prev.bodyWidth;
      document.body.style.margin = prev.bodyMargin;
      document.body.style.background = prev.bodyBg;
      root.style.height = prev.rootHeight;
      root.style.maxHeight = prev.rootMaxHeight;
      root.style.minHeight = prev.rootMinHeight;
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
    minHeight: 0,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: WEB_COLUMN_MAX_WIDTH,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
});

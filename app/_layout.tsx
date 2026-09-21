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

/**
 * Phone Chrome's layout viewport (100vh / height 100%) includes the URL bar
 * and, with edge-to-edge, the gesture nav. Pin the shell to the visual
 * viewport and keep bottom padding for the safe-area inset so actions stay
 * fully tappable.
 */
function useWebPageShell() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.getElementById('root') ?? document.body;
    const prev = {
      htmlHeight: document.documentElement.style.height,
      bodyHeight: document.body.style.height,
      bodyMargin: document.body.style.margin,
      bodyOverflow: document.body.style.overflow,
      bodyBg: document.body.style.background,
      position: root.style.position,
      top: root.style.top,
      left: root.style.left,
      width: root.style.width,
      height: root.style.height,
      minHeight: root.style.minHeight,
      display: root.style.display,
      flexDirection: root.style.flexDirection,
      overflow: root.style.overflow,
      boxSizing: root.style.boxSizing,
      paddingBottom: root.style.paddingBottom,
    };

    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.background = colors.primarySoft;

    const apply = () => {
      const vv = window.visualViewport;
      const height = Math.round(vv?.height ?? window.innerHeight);
      const offsetTop = Math.round(vv?.offsetTop ?? 0);
      root.style.position = 'fixed';
      root.style.top = `${offsetTop}px`;
      root.style.left = '0';
      root.style.width = '100%';
      root.style.height = `${height}px`;
      root.style.minHeight = '0';
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
      root.style.overflow = 'hidden';
      root.style.boxSizing = 'border-box';
      root.style.paddingBottom = 'env(safe-area-max-inset-bottom, env(safe-area-inset-bottom, 0px))';
    };

    apply();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);

    return () => {
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      document.documentElement.style.height = prev.htmlHeight;
      document.body.style.height = prev.bodyHeight;
      document.body.style.margin = prev.bodyMargin;
      document.body.style.overflow = prev.bodyOverflow;
      document.body.style.background = prev.bodyBg;
      root.style.position = prev.position;
      root.style.top = prev.top;
      root.style.left = prev.left;
      root.style.width = prev.width;
      root.style.height = prev.height;
      root.style.minHeight = prev.minHeight;
      root.style.display = prev.display;
      root.style.flexDirection = prev.flexDirection;
      root.style.overflow = prev.overflow;
      root.style.boxSizing = prev.boxSizing;
      root.style.paddingBottom = prev.paddingBottom;
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
              contentStyle: { backgroundColor: colors.bg, flex: 1, minHeight: 0 },
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

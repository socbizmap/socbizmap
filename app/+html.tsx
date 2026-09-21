import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="uk">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: [
              'html,body,#root{width:100%;margin:0;background:#CCFBF1;}',
              'html,body,#root{height:100%;height:100dvh;}',
              'html,body{overflow:hidden;}',
              '#root{display:flex;flex-direction:column;min-height:0;overflow:hidden;box-sizing:border-box;',
              'padding-bottom:env(safe-area-inset-bottom,0px);',
              'padding-bottom:env(safe-area-max-inset-bottom,env(safe-area-inset-bottom,0px));}',
            ].join(''),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { baseURL } from "@/lib/base-url";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: "--font-ibm-plex-sans",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "SuperImg Editor",
  description: "Programmatic video editor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <head>
        <NextChatSDKBootstrap baseUrl={baseURL} />
      </head>
      <body className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

/**
 * Patches browser APIs so the Next.js app works inside ChatGPT's triple-iframe sandbox.
 * Only activates when window.self !== window.top with mismatched origins.
 *
 * Patches: <base href>, html attribute observer, history.pushState/replaceState,
 * external link handler, fetch rewriting (sandbox origin → real app origin).
 */
function NextChatSDKBootstrap({ baseUrl }: { baseUrl: string }) {
  const bootstrapScript = `(function(){
    var baseUrl = ${JSON.stringify(baseUrl)};
    window.innerBaseUrl = baseUrl;
    window.__isChatGptApp = typeof window.openai !== "undefined";

    var htmlEl = document.documentElement;
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.type === "attributes" && m.target === htmlEl) {
          var attr = m.attributeName;
          if (attr && attr !== "suppresshydrationwarning" && attr !== "class" && attr !== "style") {
            htmlEl.removeAttribute(attr);
          }
        }
      });
    });
    observer.observe(htmlEl, { attributes: true, attributeOldValue: true });

    var origReplace = history.replaceState;
    history.replaceState = function(s, unused, url) {
      var u = new URL(url || "", window.location.href);
      origReplace.call(history, s, unused, u.pathname + u.search + u.hash);
    };

    var origPush = history.pushState;
    history.pushState = function(s, unused, url) {
      var u = new URL(url || "", window.location.href);
      origPush.call(history, s, unused, u.pathname + u.search + u.hash);
    };

    var appOrigin = new URL(baseUrl).origin;
    var isInIframe = window.self !== window.top;

    window.addEventListener("click", function(e) {
      var a = e.target && e.target.closest && e.target.closest("a");
      if (!a || !a.href) return;
      var url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin && url.origin !== appOrigin) {
        try {
          if (window.openai) {
            window.openai.openExternal({ href: a.href });
            e.preventDefault();
          }
        } catch(err) {}
      }
    }, true);

    if (isInIframe && window.location.origin !== appOrigin) {
      var origFetch = window.fetch;
      window.fetch = function(input, init) {
        var url;
        if (typeof input === "string" || input instanceof URL) {
          url = new URL(input, window.location.href);
        } else {
          url = new URL(input.url, window.location.href);
        }

        if (url.origin === appOrigin) {
          if (typeof input === "string" || input instanceof URL) {
            input = url.toString();
          } else {
            input = new Request(url.toString(), input);
          }
          return origFetch.call(window, input, Object.assign({}, init, { mode: "cors" }));
        }

        if (url.origin === window.location.origin) {
          var newUrl = new URL(baseUrl);
          newUrl.pathname = url.pathname;
          newUrl.search = url.search;
          newUrl.hash = url.hash;
          if (typeof input === "string" || input instanceof URL) {
            input = newUrl.toString();
          } else {
            input = new Request(newUrl.toString(), input);
          }
          return origFetch.call(window, input, Object.assign({}, init, { mode: "cors" }));
        }

        return origFetch.call(window, input, init);
      };
    }
  })();`;

  return (
    <>
      <base href={baseUrl + "/"} />
      <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
    </>
  );
}

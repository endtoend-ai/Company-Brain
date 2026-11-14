import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import "./site.css";
import { ThemeProvider } from "../components/theme-provider";
import { ParticleField } from "../components/particle-field";
import { AuthProvider } from "../lib/auth-context";
import { I18nProvider } from "../lib/i18n/language-context";
import { getDictionary } from "../lib/i18n";
import { LOCALE_COOKIE, LOCALES, normalizeLocale, type Locale } from "../lib/i18n/types";

async function readLocale(): Promise<Locale> {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
}

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await readLocale());
  return {
    title: dictionary.meta.title,
    description: dictionary.meta.description
  };
}

const noFlash = `(function(){try{var t=localStorage.getItem('ff-theme');if(!t){t='light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await readLocale();
  return (
    <html lang={LOCALES[locale].htmlLang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <I18nProvider initialLocale={locale}>
          <ThemeProvider>
            <AuthProvider>
              <ParticleField />
              <div className="grain" aria-hidden />
              <div className="app-shell">{children}</div>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

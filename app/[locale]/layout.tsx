import type React from "react"
import { Inter } from "next/font/google"
import "../globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppFooter } from "@/components/app-footer"
import { i18n, type Locale } from '@/lib/i18n/config'
import { isRTL } from '@/lib/i18n/utils'

const inter = Inter({ subsets: ["latin"] })

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params;
  const rtl = isRTL(locale);

  return (
    <html lang={locale} dir={rtl ? 'rtl' : 'ltr'} suppressHydrationWarning>
               <body className={`${inter.className} ${rtl ? 'rtl' : 'ltr'}`} suppressHydrationWarning>
           <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
             <div className="min-h-screen flex flex-col">
               <main className="flex-1">
                 {children}
               </main>
               <AppFooter />
             </div>
           </ThemeProvider>
         </body>
    </html>
  )
} 
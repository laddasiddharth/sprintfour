import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Conseal — Correction",
  description: "Fix a redaction tool's mistakes before a document goes out.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const themeScript = `
  (function() {
    try {
      var saved = localStorage.getItem('theme');
      var preferred = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      if (preferred === 'dark') {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

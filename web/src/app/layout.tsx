import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const archivo = localFont({
  src: "./fonts/archivo-latin.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "LoomXR", template: "%s | LoomXR" },
  description: "Personalized packaging previewed in web AR.",
  // The app and the customer flow are not for search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const archivo = localFont({
  src: "./fonts/archivo-latin.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
});

// Display serif for headings. The same face is used for the labels on the
// generated packaging, so the app and its output feel like one product.
const playfair = localFont({
  src: [
    { path: "./fonts/playfair-700.woff", weight: "700", style: "normal" },
    { path: "./fonts/playfair-400-italic.woff", weight: "400", style: "italic" },
  ],
  variable: "--font-playfair",
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
  themeColor: "#12283a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" className={`${archivo.variable} ${playfair.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}

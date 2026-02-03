import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import ClientBody from "./ClientBody";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://saturaai.com";
const defaultTitle = "Satura - The #1 AI Tool for YouTube Growth & Viral Shorts";
const defaultDescription =
  "Satura's AI makes viral Shorts clips, subtitles, and polished edits in minutes. Upload your video, and Satura does the rest. Grow, get discovered, get paid.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: "%s | Satura",
  },
  description: defaultDescription,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Satura",
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Satura",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/og.png"],
  },
  icons: {
    icon: ["/favicon.ico", "/icon.svg"],
    apple: ["/apple-touch-icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <ClientBody>{children}</ClientBody>
    </html>
  );
}

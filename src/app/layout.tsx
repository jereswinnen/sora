import type { Metadata } from "next";
import "@/styles/globals.css";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { ToasterProvider } from "@/components/providers/ToasterProvider";

export const metadata: Metadata = {
  title: "Sora",
  description: "Save and manage articles to read later",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <ToasterProvider />
      </body>
    </html>
  );
}

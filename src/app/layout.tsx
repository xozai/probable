import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Probable",
  description: "OPCC exhibit automation for site-civil engineers",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

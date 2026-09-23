import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Disco Sundays CRM",
  description: "Internal business operating system for Disco Sundays.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}

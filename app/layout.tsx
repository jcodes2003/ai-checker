import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Reflection Checker",
  description: "Teacher-led reflection grading with AI scoring and feedback.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

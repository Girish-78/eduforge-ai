import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "InsForge EduAI",
  description:
    "AI-first CBSE teaching workspace with role-based tools and document generation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900 flex flex-col">
        {children}
        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            className: "text-sm",
          }}
        />
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { Header } from '@/components/layout/header';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SiteProbe - AI専門家チームによるサイト分析',
  description:
    'URLを入力するだけで、AI専門家チームがWebサイトをマーケティング、SEO、デザイン、技術、ビジネスの観点から多角的に分析し、具体的な改善提案を行います。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
        </div>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}

import './globals.css';
import type { Metadata } from 'next';
import AppNotification from '@/components/AppNotification';

export const metadata: Metadata = {
  title: 'Web Agent Platform',
  description: 'Multi-Agent AI Platform for Software Development',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-white">
        {children}
        <AppNotification />
      </body>
    </html>
  );
}

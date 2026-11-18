import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SentinelLocal',
  description: 'Autonomous After-Hours Revenue & Margin Sentinel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

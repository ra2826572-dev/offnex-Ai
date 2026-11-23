import type { Metadata, Viewport } from 'next';
import React from 'react';
import './globals.css';
import { OfflineBootstrap } from '@/components/OfflineBootstrap';

export const metadata: Metadata = {
  title: 'OfflineGPT - Your AI. Your Device. Your Freedom.',
  description:
    'Private, multilingual offline AI assistant running locally on your device with Ollama, PDF document understanding, voice assistant, learning hub, and knowledge base.',
  openGraph: {
    title: 'OfflineGPT - Your AI. Your Device. Your Freedom.',
    description:
      'Private, multilingual offline AI assistant running locally on your device with Ollama, PDF document understanding, voice assistant, learning hub, and knowledge base.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Offnex Ai',
  },
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/assets/offnex_icon_square.png', type: 'image/png' },
    ],
    shortcut: '/icon.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B0D18',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="/sw-register.js" async />
      </head>
      <body className="bg-[#0B0D18] text-white antialiased selection:bg-purple-600 selection:text-white">
        <OfflineBootstrap />
        {children}
      </body>
    </html>
  );
}

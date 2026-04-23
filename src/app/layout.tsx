import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import ToastProvider from '@/components/ToastProvider'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CRM Cold Call',
  description: 'Gestion des prospects cold call',
}

function SidebarSkeleton() {
  return (
    <div className="w-56 shrink-0 bg-[#111827] border-r border-gray-800 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="w-24 h-5 bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="flex-1 p-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-800/60 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="flex h-screen overflow-hidden bg-[#0a0f1e] text-gray-100 antialiased">
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar />
        </Suspense>
        <ToastProvider>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  )
}

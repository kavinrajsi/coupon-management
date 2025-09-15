'use client';
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'
import { usePathname } from 'next/navigation'

export default function RootLayout({ children }) {
  const pathname = usePathname()
  
  // Hide navigation on view pages
  const isViewPage = pathname?.startsWith('/view/')
  
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          {!isViewPage && (
            <nav className="bg-blue-600 text-white p-4">
              <div className="container mx-auto flex justify-between items-center">
                <h1 className="text-xl font-bold">Coupon Management</h1>
                <div className="space-x-4">
                  <a href="/admin" className="hover:underline">Admin</a>
                  <a href="/store" className="hover:underline">Store</a>
                  <a href="/customer" className="hover:underline">Customer</a>
                </div>
              </div>
            </nav>
          )}
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
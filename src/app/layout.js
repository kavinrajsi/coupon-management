import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'

export const metadata = {
  title: 'Coupon Management System',
  description: 'A comprehensive coupon management system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
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
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
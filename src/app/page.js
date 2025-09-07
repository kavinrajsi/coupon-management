export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white-800 mb-8">
          Coupon Management System
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl text-gray-800 font-semibold mb-4">Admin Panel</h2>
            <p className="text-gray-600 mb-4">
              Generate coupon codes, view statistics, and manage all coupons
            </p>
            <a 
              href="/admin"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Go to Admin
            </a>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl text-gray-800 font-semibold mb-4">Store Panel</h2>
            <p className="text-gray-600 mb-4">
              Validate coupon codes and mark them as used
            </p>
            <a 
              href="/store"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Go to Store
            </a>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl text-gray-800 font-semibold mb-4">Customer Panel</h2>
            <p className="text-gray-600 mb-4">
              View available coupons and get shareable links
            </p>
            <a 
              href="/customer"
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              Go to Customer
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
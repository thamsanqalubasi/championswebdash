import { Outlet, Link } from "react-router-dom";
import { Home, LogIn, User, Building2, Lock } from "lucide-react";

export default function PortalLayout() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <Link to="/portal" className="flex items-center gap-2 font-bold text-lg text-blue-700">
              <Building2 size={22} />
              <span>Property Portal</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/portal" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-700 transition">
                <Home size={15}/> <span className="hidden sm:inline">Listings</span>
              </Link>
              <Link to="/portal/dashboard" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-700 transition">
                <User size={15}/> <span className="hidden sm:inline">My Account</span>
              </Link>
              <Link to="/portal/login" className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition">
                <LogIn size={15}/> Sign In
              </Link>
              <Link to="/dashboard" className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition">
                <Lock size={15}/> Company Login
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 bg-gray-50 py-8 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Property Portal. All rights reserved.</p>
        <p className="mt-1 text-xs">Powered by Champions Web Platform</p>
      </footer>
    </div>
  );
}

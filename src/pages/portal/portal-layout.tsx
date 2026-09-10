import { Outlet, Link, useNavigate } from "react-router-dom";
import { Home, LogIn, User, Building2 } from "lucide-react";

export default function PortalLayout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <Link to="/portal" className="flex items-center gap-2 font-bold text-lg text-blue-700">
              <Building2 size={22} />
              <span>Property Portal</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/portal" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-700 transition">
                <Home size={15}/> Listings
              </Link>
              <Link to="/portal/dashboard" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-700 transition">
                <User size={15}/> My Account
              </Link>
              <Link to="/portal/login" className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
                <LogIn size={15}/> Sign In
              </Link>
              <Link to="/dashboard" className="text-xs text-gray-400 hover:text-gray-600 transition">Admin →</Link>
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

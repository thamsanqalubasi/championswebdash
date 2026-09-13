import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, LogIn, User, Building2, Lock, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function PortalLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu on page navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      <nav className="sticky top-0 z-40 border-b border-gray-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Brand Logo */}
            <Link
              to="/"
              className="flex items-center gap-2 font-black text-xl text-blue-600 dark:text-blue-400 tracking-tight transition hover:opacity-90"
            >
              <Building2 size={24} className="text-blue-600 dark:text-blue-400" />
              <span>Paimbabook</span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-2 lg:gap-3">
              <Link
                to="/"
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                  location.pathname === "/"
                    ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                    : "text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <Home size={16} /> <span>Listings</span>
              </Link>
              <Link
                to="/portal/dashboard"
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                  location.pathname.startsWith("/portal/dashboard")
                    ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                    : "text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <User size={16} /> <span>My Account</span>
              </Link>
              <Link
                to="/portal/login"
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-sm font-semibold shadow-xs transition"
              >
                <LogIn size={15} /> <span>Sign In</span>
              </Link>
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/60 shadow-xs transition"
              >
                <Lock size={15} /> <span>Company Login</span>
              </Link>
              <div className="ml-1 pl-2 border-l border-gray-200 dark:border-slate-800">
                <ThemeToggle variant="compact" />
              </div>
            </div>

            {/* Mobile Actions: Dark Mode Toggle + Menu Hamburger */}
            <div className="flex md:hidden items-center gap-2">
              <ThemeToggle variant="compact" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition shadow-xs"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown / Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl transition-all">
            <div className="mx-auto max-w-6xl px-4 py-4 space-y-2">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  location.pathname === "/"
                    ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                    : "text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                  <Home size={17} />
                </div>
                <div>
                  <div className="font-semibold">Browse Listings</div>
                  <div className="text-xs text-gray-400 dark:text-slate-400">Rooms, Lodges & Rentals</div>
                </div>
              </Link>

              <Link
                to="/portal/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  location.pathname.startsWith("/portal/dashboard")
                    ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                    : "text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-slate-800 text-purple-600 dark:text-purple-400">
                  <User size={17} />
                </div>
                <div>
                  <div className="font-semibold">My Account</div>
                  <div className="text-xs text-gray-400 dark:text-slate-400">Guest Bookings & Enquiries</div>
                </div>
              </Link>

              <div className="pt-2 pb-1 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                <Link
                  to="/portal/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-xs transition"
                >
                  <LogIn size={15} /> <span>Sign In</span>
                </Link>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-750 shadow-xs transition"
                >
                  <Lock size={15} /> <span>Company Login</span>
                </Link>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                <ThemeToggle variant="menu-item" />
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 text-center text-sm text-gray-500 dark:text-slate-400 transition-colors">
        <p className="font-semibold text-gray-700 dark:text-slate-300">&copy; {new Date().getFullYear()} Paimbabook. All rights reserved.</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">Paimbabook Hospitality & Property Management Platform</p>
      </footer>
    </div>
  );
}

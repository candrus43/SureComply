import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  user: { name: string; email: string };
}

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vendors", label: "Vendors", icon: Users },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ user }: SidebarProps) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isActive = (to: string) =>
    currentPath === to || currentPath.startsWith(to + "/");

  const NavItems = () => (
    <>
      {navItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            isActive(item.to)
              ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400 pl-2.5"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
          }`}
        >
          <item.icon className="w-4 h-4" />
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-zinc-900 border-r border-zinc-800 flex flex-col shadow-2xl">
            {/* Logo + close */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
                  <Shield className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="font-semibold text-white text-sm">SureComply</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-4 px-3 space-y-1">
              <NavItems />
            </nav>

            {/* User */}
            <div className="border-t border-zinc-800 p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-semibold text-emerald-400">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{user.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                </div>
                <a
                  href="/logout"
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </a>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[240px] flex-col bg-zinc-900 border-r border-zinc-800 flex-shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-5 border-b border-zinc-800">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="font-semibold text-white text-sm">SureComply</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          <NavItems />
        </nav>

        {/* User */}
        <div className="border-t border-zinc-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-semibold text-emerald-400">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{user.name}</p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
            <a
              href="/logout"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}

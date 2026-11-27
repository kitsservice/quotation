import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  Settings, 
  ExternalLink,
  ChevronDown,
  Menu,
  ArrowLeft,
  Laptop
} from 'lucide-react';

const EMPTY_NOTIFICATIONS = [];

function TopHeader({
  searchQuery,
  setSearchQuery,
  onOpenSettings,
  onOpenSync,
  companySettings: _companySettings,
  onQuickAction: _onQuickAction,
  onToggleSidebar,
  onBack
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.top-header-menu-container')) {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };

    if (showNotifications || showUserMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [showNotifications, showUserMenu]);

  const notifications = EMPTY_NOTIFICATIONS;

  return (
    <header className="no-print h-16 shrink-0 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      
      {/* Left: Hamburger Toggle, Backward Button & Search Bar */}
      <div className="flex items-center flex-1 max-w-md space-x-2 sm:space-x-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            title="Toggle Navigation Menu"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all shadow-2xs active:scale-95 shrink-0 cursor-pointer border border-slate-200/60"
            title="Go to previous slide"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
            placeholder="Search anything..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs font-medium text-slate-800 placeholder-slate-400 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2.5 sm:space-x-3.5 ml-4">

        {/* Sync Across Laptops Button */}
        {onOpenSync && (
          <button
            type="button"
            onClick={onOpenSync}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100/90 text-blue-700 text-xs font-bold transition-all shadow-2xs active:scale-95 shrink-0 cursor-pointer border border-blue-200/80"
            title="Transfer or sync data across laptops"
          >
            <Laptop className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="hidden sm:inline">Sync Laptops</span>
          </button>
        )}

        {/* Notifications */}
        <div className="relative top-header-menu-container">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between font-bold text-slate-800">
                <span>Notifications</span>
                {notifications.length > 0 && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                    {notifications.length} New
                  </span>
                )}
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map(n => (
                    <div key={n.id} className="p-3 hover:bg-slate-50 transition-colors">
                      <p className="font-semibold text-slate-700 leading-snug">{n.title}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{n.time}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-600">No new notifications</p>
                    <p className="text-[11px]">System ready for quotations & invoices</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200" />

        {/* User Profile Pill */}
        <div className="relative top-header-menu-container">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center space-x-2.5 pl-1.5 pr-2.5 py-1 rounded-xl hover:bg-slate-100 transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
              AD
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors leading-tight">
                Admin
              </div>
              <div className="text-[10px] text-slate-400 font-medium leading-tight">
                KITS Admin
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <div className="font-bold text-slate-800 whitespace-nowrap">KITS ROBOTICS & AUTOMATION PVT.LTD.</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">GSTIN: 27AAMCK1536C1ZP</div>
              </div>
              <div className="py-1">
                {onOpenSync && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenSync();
                    }}
                    className="w-full flex items-center space-x-2.5 px-4 py-2 hover:bg-slate-50 text-slate-700 font-medium"
                  >
                    <Laptop className="w-4 h-4 text-blue-600" />
                    <span>Sync Between Laptops</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center space-x-2.5 px-4 py-2 hover:bg-slate-50 text-slate-700 font-medium"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Company Settings</span>
                </button>
                <a
                  href="https://kitsautomation.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center space-x-2.5 px-4 py-2 hover:bg-slate-50 text-slate-700 font-medium"
                >
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                  <span>Visit Website</span>
                </a>
              </div>
            </div>
          )}
        </div>

      </div>

    </header>
  );
}

export default React.memo(TopHeader);

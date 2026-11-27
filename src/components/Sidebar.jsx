import React, { useMemo } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  FileCheck2, 
  Receipt, 
  Truck,
  Users,
  BarChart3, 
  Settings,
  X
} from 'lucide-react';
import kitsLogoSrc from '../assets/kits-logo.jpg';

function Sidebar({
  activeTab,
  setActiveTab,
  onOpenSettings,
  companySettings = null,
  quotationsCount = 0,
  proformaCount = 0,
  invoicesCount = 0,
  challansCount = 0,
  customersCount = 0,
  isOpen = true,
  onClose
}) {
  const navSections = useMemo(() => [
    {
      title: 'Core Modules',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'quotes', label: 'Quotations', icon: FileText, badge: quotationsCount },
        { id: 'proforma', label: 'Proforma Invoices', icon: FileCheck2, badge: proformaCount },
        { id: 'invoices', label: 'Final Invoices', icon: Receipt, badge: invoicesCount },
        { id: 'challans', label: 'Delivery Challans', icon: Truck, badge: challansCount },
      ]
    },
    {
      title: 'Management',
      items: [
        { id: 'clients', label: 'Customers', icon: Users, badge: customersCount },
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { id: 'settings', label: 'Settings & Company', icon: Settings, action: onOpenSettings },
      ]
    }
  ], [quotationsCount, proformaCount, invoicesCount, challansCount, customersCount, onOpenSettings]);

  const handleNavClick = (item) => {
    if (item.action) {
      item.action();
    } else {
      setActiveTab(item.id);
    }
    if (onClose && typeof window !== 'undefined' && window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="lg:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 transition-opacity animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Shell */}
      <aside 
        className={`no-print fixed lg:static inset-y-0 left-0 z-50 bg-[#091122] text-slate-300 flex flex-col shrink-0 h-full border-r border-slate-800/90 select-none transition-all duration-300 ease-in-out ${
          isOpen 
            ? 'w-68 translate-x-0 shadow-2xl lg:shadow-none' 
            : '-translate-x-full lg:translate-x-0 lg:w-0 lg:border-r-0 lg:overflow-hidden lg:opacity-0'
        }`}
      >
        {/* Top Gradient Accent Strip */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-600 shrink-0"></div>

        {/* Brand Header */}
        <div className="py-4 px-5 border-b border-slate-800/70 shrink-0 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              {/* Logo Box with Soft Glowing Glass Effect */}
              <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-md shadow-blue-950/40 shrink-0 overflow-hidden border border-slate-700/60 flex items-center justify-center">
                <img 
                  src={companySettings?.logoUrl || kitsLogoSrc} 
                  alt="KITS Logo" 
                  className="w-full h-full object-contain" 
                />
              </div>

              {/* Company & Product Title */}
              <div className="min-w-0">
                <div className="font-extrabold text-[12px] tracking-wider text-white uppercase leading-tight whitespace-nowrap">
                  KITS ROBOTICS &amp;
                </div>
                <div className="text-[10px] text-blue-400 font-semibold tracking-tight leading-tight mt-0.5 whitespace-nowrap">
                  AUTOMATION PVT.LTD.
                </div>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              title="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Sections Area */}
        <div className="flex-1 px-3 py-3 space-y-5 overflow-y-auto custom-scrollbar">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              <div className="text-[9.5px] font-bold tracking-widest text-slate-400 uppercase px-3 pb-1">
                {section.title}
              </div>

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id || 
                  (item.id === 'quotes' && (activeTab === 'editor' || activeTab === 'preview'));

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item)}
                    className={`w-full group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/30 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      {/* Active Indicator Bar */}
                      {isActive && (
                        <div className="w-1 h-4 bg-cyan-300 rounded-full shadow-[0_0_8px_rgba(103,232,249,0.9)] -ml-1 mr-1" />
                      )}
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'
                      }`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums transition-colors ${
                        isActive 
                          ? 'bg-white/20 text-white' 
                          : 'bg-slate-800/90 text-slate-400 border border-slate-700/60 group-hover:border-slate-600 group-hover:text-white'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

      </aside>
    </>
  );
}

export default React.memo(Sidebar);

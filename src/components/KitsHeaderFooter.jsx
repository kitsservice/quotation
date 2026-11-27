import React from 'react';
import KitsLogo from './KitsLogo';
import { MapPin, Globe, Mail, Phone } from 'lucide-react';

/**
 * Reusable official KITS Document Header matching the exact reference quotation
 */
export const KitsDocumentHeader = React.memo(function KitsDocumentHeader({ companySettings }) {
  const gstin = companySettings?.gstin || '27AAMCK1536C1ZP';
  // Format GSTN with spaces: "2 7 A A M C K 1 5 3 6 C 1 Z P"
  const spacedGstn = gstin.split('').join(' ');
  const rawCompanyName = companySettings?.name || 'KITS ROBOTICS & AUTOMATION PVT.LTD.';
  const oldCompanyNames = [
    'KITS ROBOTICS AND AUTOMATION PVT.LTD.',
    'KITS Robotics and Automation Pvt.Ltd.',
    'KITS Robotics & Automation Pvt.Ltd',
    'KITS Robotics & Automation Pvt. Ltd.',
    'KITS Robotics and Automation Pvt.Ltd',
    'KITS ROBOTICS & AUTOMATION PVT. LTD.',
    'KITS ROBOTICS & AUTOMATION PVT.LTD',
    'KITS Robotics & Automation',
    'KITS Robotics & Automation Pvt Ltd'
  ];
  const companyName = (!rawCompanyName || oldCompanyNames.includes(rawCompanyName.trim()))
    ? 'KITS ROBOTICS & AUTOMATION PVT.LTD.'
    : rawCompanyName;

  return (
    <div className="w-full">
      {/* Top Cyan Accent Strip */}
      <div className="h-1.5 w-full bg-[#0284c7] -mt-3 -mx-4 mb-3 sm:-mt-4 sm:-mx-6 sm:mb-4"></div>

      {/* Main Header Row: 3-column balanced grid keeps the company name fixed dead center in one clean line */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center pb-3 w-full">
        {/* Left: Official Isometric Cube Logo & Brand */}
        <div className="flex items-center justify-start shrink-0">
          <KitsLogo className="h-16 sm:h-20 w-auto" src={companySettings?.logoUrl} />
        </div>

        {/* Center: Company Name (Proper & in One Line) */}
        <div className="text-center px-1 sm:px-2 flex justify-center items-center">
          <h1 className="text-[12px] xs:text-[14px] sm:text-[16px] md:text-[18.5px] print:text-[18.5px] font-black tracking-tight text-[#0f245c] font-serif leading-none whitespace-nowrap">
            {companyName}
          </h1>
        </div>

        {/* Right: Curved GSTIN Banner (Double Tone Gradient) */}
        <div className="flex items-center justify-end shrink-0">
          <div className="bg-gradient-to-r from-[#0f245c] to-[#0284c7] text-white text-[9.5px] sm:text-[10px] font-bold py-0.5 px-3 rounded-l-full shadow-xs tracking-wide flex items-center whitespace-nowrap border-l border-y border-white/20">
            <span>GSTIN: {spacedGstn}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Reusable official KITS Document Footer matching the exact reference quotation
 */
export const KitsDocumentFooter = React.memo(function KitsDocumentFooter({ companySettings, isSoftware = false }) {
  const addressLine1 = companySettings?.address?.split(',').slice(0, 3).join(',') || 'KITS, 1st floor, Mukta Plaza, KITS Square,';
  const addressLine2 = companySettings?.address?.split(',').slice(3).join(',') || 'Income tax chowk, Gaurakshan Road, Akola-444001';
  const website = companySettings?.website || 'www.kitstechsolutions.com';
  const email = companySettings?.email || 'info@kitstechsolutions.com';
  const rawPhone = companySettings?.phone || '9823042432/7385582242';
  const phone = isSoftware
    ? (rawPhone.replace(/(?:^|\s*[/,-]\s*)9453536807(?:\s*[/,-]\s*|$)/g, ' ').replace(/\s+/g, ' ').replace(/^[/\s,-]+|[/\s,-]+$/g, '').trim() || '9823042432/7385582242')
    : rawPhone;

  return (
    <div className="w-full pt-3 mt-auto relative">
      {/* Light Blue Horizontal Divider */}
      <div className="h-[2px] w-full bg-[#38bdf8] mb-3"></div>

      {/* Footer Content Grid */}
      <div className="grid grid-cols-2 text-[10px] sm:text-[11px] text-slate-800 leading-tight pb-2 relative z-10">
        
        {/* Left Column: Address & Website */}
        <div className="space-y-2 pr-2">
          <div className="flex items-start space-x-2">
            <div className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-3 h-3 text-slate-800" />
            </div>
            <div>
              <div className="font-bold text-slate-900">{addressLine1}</div>
              <div className="text-slate-700 font-medium">{addressLine2}</div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center shrink-0">
              <Globe className="w-3 h-3 text-slate-800" />
            </div>
            <a 
              href={`https://${website}`} 
              target="_blank" 
              rel="noreferrer"
              className="text-[#0284c7] font-bold hover:underline"
            >
              {website}
            </a>
          </div>
        </div>

        {/* Right Column: Email & Phone */}
        <div className="space-y-2 pl-4">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center shrink-0">
              <Mail className="w-3 h-3 text-slate-800" />
            </div>
            <a 
              href={`mailto:${email}`}
              className="text-[#0284c7] font-bold hover:underline truncate"
            >
              {email}
            </a>
          </div>

          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center shrink-0">
              <Phone className="w-3 h-3 text-slate-800" />
            </div>
            <span className="font-bold text-slate-900 font-mono">
              {phone}
            </span>
          </div>
        </div>

      </div>

      {/* Modern Double-Tone Diagonal Decorative Shape (Bottom Left Corner, kept sleekly under) */}
      <div 
        className="absolute -bottom-3 -left-4 sm:-bottom-4 sm:-left-6 w-14 h-6 bg-gradient-to-tr from-[#0f245c] to-[#0284c7] pointer-events-none z-0 opacity-90"
        style={{ clipPath: 'polygon(0 100%, 100% 100%, 0 0)' }}
      ></div>
    </div>
  );
});

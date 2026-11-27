import React from 'react';
import kitsLogoSrc from '../assets/kits-logo.jpg';

/**
 * Official KITS "inspire Engineering" Logo
 */
function KitsLogo({ 
  className = "h-18 sm:h-20 w-auto", 
  src = null, 
  alt = "KITS ROBOTICS & AUTOMATION PVT.LTD. - inspire Engineering" 
}) {
  const finalSrc = src || kitsLogoSrc;

  return (
    <div className={`flex items-center justify-center shrink-0 ${className}`}>
      <img
        src={finalSrc}
        alt={alt}
        className="h-full w-auto max-h-24 object-contain block"
      />
    </div>
  );
}

export default React.memo(KitsLogo);

import React, { memo } from 'react';

// Using React.memo to prevent unnecessary re-renders
const Footer = memo(function Footer() {
  // Simplified - removed unnecessary useMemo
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-amber-900 text-amber-50 py-4 mt-auto">
      <div className="container mx-auto text-center">
        <p className="text-amber-200">&copy; {currentYear} Rendezvous App. All rights reserved.</p>
      </div>
    </footer>
  );
});

// Add a display name for better debugging
Footer.displayName = 'Footer';

export default Footer;
import React, { memo } from 'react';

// Using React.memo to prevent unnecessary re-renders
const Header = memo(function Header() {
  return (
    <header className="bg-amber-900 text-amber-50 p-6 shadow-md">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold flex justify-center font-serif">Rendezvous</h1>
        <h2 className="text-lg flex justify-center mt-2 text-amber-200 italic">Meet me halfway.</h2>
      </div>
    </header>
  );
});

// Add a display name for better debugging
Header.displayName = 'Header';

export default Header;
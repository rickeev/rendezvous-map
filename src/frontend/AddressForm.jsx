import React, { useState, useCallback, memo, useEffect } from 'react';

// Using memo to prevent unnecessary re-renders
const AddressForm = memo(function AddressForm({ onCoordsUpdate }) {
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [previousAddresses, setPreviousAddresses] = useState({ address1: '', address2: '' });
  const [apiStats, setApiStats] = useState({ total: 0, limit: 50 });
  const [serverAvailable, setServerAvailable] = useState(true);

  // Check server health and fetch API stats
  useEffect(() => {
    // Check if server is available
    const checkServerHealth = async () => {
      try {
        const response = await fetch(`${VITE_API_BASE_URL}/api/health`);
        if (response.ok) {
          setServerAvailable(true);
          // Now fetch the stats since server is available
          fetchStats();
        } else {
          setServerAvailable(false);
          console.error('Server returned error status:', response.status);
        }
      } catch (error) {
        console.error('Server health check failed:', error);
        setServerAvailable(false);
      }
    };
    
    // Fetch API stats from server
    const fetchStats = async () => {
      try {
        const response = await fetch(`${VITE_API_BASE_URL}/api/stats`);
        if (response.ok) {
          const data = await response.json();
          setApiStats(data.requestStats || { total: 0, limit: 50 });
        }
      } catch (error) {
        console.error('Error fetching API stats:', error);
        // Set default stats on error
        setApiStats({ total: 0, limit: 50 });
      }
    };
    
    // Initial check
    checkServerHealth();
    
    // Check server health every 30 seconds
    const intervalId = setInterval(checkServerHealth, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Fetch coordinates from backend API
  const fetchCoordinates = useCallback(async (address) => {
    if (!address.trim()) {
      throw new Error('Address cannot be empty');
    }
    
    try {
      const response = await fetch(`${VITE_API_BASE_URL}/api/geocode?address=${encodeURIComponent(address)}`);
      
      if (!response.ok) {
        let errorMessage = 'Error fetching address coordinates';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          // If we can't parse JSON, use the response status text
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (data.status === 'ZERO_RESULTS') {
        throw new Error(`Could not find the address: "${address}"`);
      }
      
      if (data.status !== 'OK') {
        throw new Error(`Geocoding error: ${data.status}`);
      }
      
      const location = data.results[0]?.geometry.location;
      
      if (!location) {
        throw new Error('Could not parse location data from response');
      }
      
      return {
        lat: location.lat,
        lng: location.lng,
        originalAddress: address
      };
    } catch (error) {
      console.error('Error in fetchCoordinates:', error);
      throw error;
    }
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    setIsLoading(true);
    setError('');

    // Validate inputs
    if (!address1.trim() || !address2.trim()) {
      setError('Both addresses are required');
      setIsLoading(false);
      return;
    }

    // Check if addresses have changed
    const addressChanged = 
      address1 !== previousAddresses.address1 || 
      address2 !== previousAddresses.address2;
    
    // If addresses have not changed, don't do another lookup
    if (!addressChanged) {
      setIsLoading(false);
      return;
    }

    // Clear existing coordinates
    onCoordsUpdate([]);
    
    try {
      // Add retry mechanism with exponential backoff
      const getCoordinatesWithRetry = async (address, retries = 2, delay = 1000) => {
        try {
          return await fetchCoordinates(address);
        } catch (error) {
          if (retries === 0) throw error;
          
          // Wait for specified delay
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry with exponential backoff
          return getCoordinatesWithRetry(address, retries - 1, delay * 2);
        }
      };
      
      // Fetch both coordinates
      const [coord1, coord2] = await Promise.all([
        getCoordinatesWithRetry(address1),
        getCoordinatesWithRetry(address2)
      ]);

      if (coord1 && coord2) {
        // Save the current addresses for future comparison
        setPreviousAddresses({ address1, address2 });
        
        // Update with new coordinates and original addresses
        onCoordsUpdate([coord1, coord2]);
      } else {
        setError('Could not fetch one or both addresses.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [address1, address2, previousAddresses, fetchCoordinates, onCoordsUpdate]);

  return (
    <div className="p-6 bg-amber-100 rounded-lg shadow-md border border-amber-300">
      <h2 className="text-xl font-semibold mb-4 text-amber-900 font-serif">Enter Two Locations</h2>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Server availability warning */}
      {!serverAvailable && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>Server connection issue detected. The application may not function correctly.</p>
        </div>
      )}
      
      {/* Show request stats warning */}
      {serverAvailable && apiStats.total >= 40 && (
        <div className="bg-amber-200 border border-amber-500 text-amber-800 px-4 py-3 rounded mb-4">
          <p>You're approaching the API request limit. {apiStats.limit - apiStats.total} requests remaining.</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="address1" className="block text-sm font-medium text-amber-800 mb-1">
            Address 1
          </label>
          <input
            id="address1"
            type="text"
            placeholder="e.g. 123 Main St, Anytown CA"
            className="border border-amber-300 p-2 w-full rounded bg-amber-50 text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            value={address1}
            onChange={(e) => setAddress1(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div>
          <label htmlFor="address2" className="block text-sm font-medium text-amber-800 mb-1">
            Address 2
          </label>
          <input
            id="address2"
            type="text"
            placeholder="e.g. 456 Oak Ave, Othertown CA"
            className="border border-amber-300 p-2 w-full rounded bg-amber-50 text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            value={address2}
            onChange={(e) => setAddress2(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <button 
          type="submit" 
          className={`w-full py-2 px-4 rounded font-medium ${
            isLoading 
              ? 'bg-amber-400 cursor-not-allowed' 
              : 'bg-amber-700 hover:bg-amber-800 text-amber-50'
          }`}
          disabled={isLoading}
        >
          {isLoading ? 'Finding Midpoint...' : 'Find Midpoint'}
        </button>
        <p className="text-sm text-amber-700 mt-2 text-center">
          This will find restaurants in a 1-mile radius of the midpoint
        </p>
      </form>
    </div>
  );
});

// Add display name for better debugging
AddressForm.displayName = 'AddressForm';

export default AddressForm;
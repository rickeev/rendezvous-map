import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, Circle } from '@react-google-maps/api';
import RestaurantInfoWindow from './RestaurantInfoWindow';

// API base URL - use absolute URL
const API_BASE_URL = 'http://localhost:5000';

// Define static values outside component to prevent re-creation
const containerStyle = {
  width: '100%',
  height: '500px'
};

// Circle options for the 1-mile radius
const circleOptions = {
  strokeColor: '#FF0000',
  strokeOpacity: 0.8,
  strokeWeight: 2,
  fillColor: '#FF0000',
  fillOpacity: 0.1,
  clickable: false,
  draggable: false,
  editable: false,
  visible: true,
  zIndex: 1
};

// Define libraries array with correct type
const libraries = ['places'];

// 1 mile in meters (for the circle radius)
const ONE_MILE_IN_METERS = 1609.34;

// Helper function to safely get lat/lng from location
function getPosition(location) {
  if (!location) return null;
  
  try {
    // Handle function-style location (from Google Maps JS API)
    if (typeof location.lat === 'function' && typeof location.lng === 'function') {
      return {
        lat: location.lat(),
        lng: location.lng()
      };
    }
    
    // Handle object-style location (from server API)
    if (typeof location.lat === 'number' && typeof location.lng === 'number') {
      return {
        lat: location.lat,
        lng: location.lng
      };
    }
    
    // Handle lat/lng as direct properties
    if (location.latitude !== undefined && location.longitude !== undefined) {
      return {
        lat: parseFloat(location.latitude),
        lng: parseFloat(location.longitude)
      };
    }
  } catch (error) {
    console.error('Error parsing location:', error);
  }
  
  return null;
}

// Renamed from Map to MapView to avoid collision with JavaScript's Map
function MapView({ coords, onRestaurantsUpdate, selectedRestaurant, onRestaurantSelect }) {
  const [restaurants, setRestaurants] = useState([]);
  const [map, setMap] = useState(null);
  const [infoWindowRestaurant, setInfoWindowRestaurant] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use a state to control whether to show the circle
  const [showCircle, setShowCircle] = useState(false);

  // Debug logging for restaurants
  useEffect(() => {
    if (restaurants.length > 0) {
      console.log("Restaurants data received:", restaurants.length);
      console.log("First restaurant sample:", restaurants[0]);
      
      // Log location format
      if (restaurants[0].geometry && restaurants[0].geometry.location) {
        const loc = restaurants[0].geometry.location;
        console.log("Location format:", {
          isFunction: typeof loc.lat === 'function',
          isNumber: typeof loc.lat === 'number',
          raw: loc
        });
      }
      
      onRestaurantsUpdate(restaurants);
    }
  }, [restaurants, onRestaurantsUpdate]);

  // Update InfoWindow when selectedRestaurant changes from parent
  useEffect(() => {
    if (selectedRestaurant) {
      setInfoWindowRestaurant(selectedRestaurant);
    }
  }, [selectedRestaurant]);

  // Reset the info window when selectedRestaurant becomes null
  useEffect(() => {
    if (selectedRestaurant === null) {
      setInfoWindowRestaurant(null);
    }
  }, [selectedRestaurant]);

  // Handle changes in coordinates - explicitly reset all states
  useEffect(() => {
    // Immediate reset when coordinates change
    setShowCircle(false);
    
    if (coords.length === 2) {
      // Reset all relevant states
      setRestaurants([]);
      setInfoWindowRestaurant(null);
      setIsLoading(true);
      setError(null);
      
      // Use a short timeout to ensure clean re-rendering
      const timeoutId = setTimeout(() => {
        setShowCircle(true);
      }, 100); // Slightly longer timeout to ensure proper reset
      
      // Clean up the timeout
      return () => clearTimeout(timeoutId);
    } else {
      // No valid coords, reset everything
      setRestaurants([]);
      setInfoWindowRestaurant(null);
      setIsLoading(false);
      setError(null);
    }
  }, [coords]);

  // Calculate midpoint - memoized to avoid recalculation on every render
  const midpoint = useMemo(() => {
    if (coords.length >= 2) {
      return {
        lat: (coords[0].lat + coords[1].lat) / 2,
        lng: (coords[0].lng + coords[1].lng) / 2
      };
    }
    return {
      lat: 38.5816, // Default to Sacramento, CA
      lng: -121.4944
    };
  }, [coords]);

  // Map options - memoized to avoid recreating on every render
  const mapOptions = useMemo(() => ({
    disableDefaultUI: false,
    clickableIcons: true,
    zoomControl: true,
    mapTypeControl: true,
    streetViewControl: true,
    rotateControl: true,
    fullscreenControl: true
  }), []);

  // Handle map load
  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
    console.log("Map loaded successfully");
  }, []);

  // Fetch nearby places from server API
  const fetchNearbyPlaces = useCallback(async (lat, lng, radius = ONE_MILE_IN_METERS) => {
    try {
      console.log(`Fetching places near ${lat},${lng} with radius ${radius}m`);
      const response = await fetch(`${API_BASE_URL}/api/places/nearby?lat=${lat}&lng=${lng}&radius=${radius}&type=restaurant`);
      
      if (!response.ok) {
        let errorMessage = 'Error fetching nearby places';
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
      return data;
    } catch (error) {
      console.error('Error fetching nearby places:', error);
      throw error;
    }
  }, []);

  // Fetch place details from server API
  const fetchPlaceDetails = useCallback(async (placeId) => {
    try {
      console.log(`Fetching details for place ID: ${placeId}`);
      const response = await fetch(`${API_BASE_URL}/api/places/details?placeid=${placeId}`);
      
      if (!response.ok) {
        let errorMessage = 'Error fetching place details';
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
      return data;
    } catch (error) {
      console.error('Error fetching place details:', error);
      throw error;
    }
  }, []);

  // Fetch restaurants when midpoint changes
  useEffect(() => {
    // Don't do anything if we don't have a map or at least 2 coordinates
    if (!map || coords.length < 2) return;
    
    // Reset state
    setInfoWindowRestaurant(null);
    setRestaurants([]);
    setIsLoading(true);
    setError(null);

    // Set a timeout to cancel the request if it takes too long
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      setError('Request timed out. Please try again.');
    }, 10000); // 10 second timeout

    // Fetch restaurants using server API
    fetchNearbyPlaces(midpoint.lat, midpoint.lng, ONE_MILE_IN_METERS)
      .then(data => {
        clearTimeout(timeoutId);
        setIsLoading(false);
        
        if (data.status === 'OK' && data.results) {
          // Limit results to reduce API calls
          const limitedResults = data.results.slice(0, 10);
          console.log(`Found ${limitedResults.length} restaurants`);
          setRestaurants(limitedResults);
        } else if (data.status === 'ZERO_RESULTS') {
          console.log('No restaurants found in this area');
        } else {
          console.error('Places API error:', data.status);
          setError(`Error getting restaurant data: ${data.status}`);
        }
      })
      .catch(err => {
        clearTimeout(timeoutId);
        setIsLoading(false);
        setError(err.message || 'Error fetching restaurant data');
      });
    
    // Cleanup function to clear timeout
    return () => {
      clearTimeout(timeoutId);
    };
  }, [map, coords, midpoint, fetchNearbyPlaces]);

  // Handle restaurant marker click to get detailed information
  const handleRestaurantClick = useCallback((restaurant) => {
    // Get position using our helper function
    const position = restaurant.geometry && restaurant.geometry.location 
      ? getPosition(restaurant.geometry.location)
      : null;
    
    // Skip if the restaurant doesn't have valid location data
    if (!position) {
      console.error('Restaurant has invalid location data:', restaurant);
      return;
    }
    
    // Notify parent of selection
    onRestaurantSelect(restaurant);
    setInfoWindowRestaurant(restaurant);
    
    // Don't make a new API call if this restaurant is already selected
    if (infoWindowRestaurant && infoWindowRestaurant.place_id === restaurant.place_id) {
      return;
    }
    
    // Only fetch details if we have the place_id
    if (restaurant.place_id) {
      // Use server API to get place details
      fetchPlaceDetails(restaurant.place_id)
        .then(data => {
          if (data.status === 'OK' && data.result) {
            // Create enhanced restaurant with all details
            const enhancedRestaurant = {
              ...restaurant,
              ...data.result,
              // Ensure we have valid geometry data - if not, use the original
              geometry: data.result.geometry || restaurant.geometry
            };
            
            // Update both the info window and parent selection
            setInfoWindowRestaurant(enhancedRestaurant);
            onRestaurantSelect(enhancedRestaurant);
            
            // Find and update this restaurant in the list
            setRestaurants(prevRestaurants => 
              prevRestaurants.map(r => 
                r.place_id === enhancedRestaurant.place_id ? enhancedRestaurant : r
              )
            );
          } else if (data.status !== 'OK') {
            console.error('Error fetching place details:', data.status);
          }
        })
        .catch(err => {
          console.error("Error getting place details:", err);
        });
    }
  }, [infoWindowRestaurant, fetchPlaceDetails, onRestaurantSelect]);

  // Generate a unique key for this set of coordinates
  const coordsKey = useMemo(() => {
    if (coords.length !== 2) return 'no-coords';
    return `${coords[0].lat.toFixed(6)}-${coords[0].lng.toFixed(6)}-${coords[1].lat.toFixed(6)}-${coords[1].lng.toFixed(6)}`;
  }, [coords]);

  return (
    <>
      <LoadScript 
        googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
        libraries={libraries}
      >
        <GoogleMap 
          mapContainerStyle={containerStyle} 
          center={midpoint} 
          zoom={14}
          onLoad={onMapLoad}
          options={mapOptions}
          key={coordsKey} // Add a key to force remount of the map when coords change
        >
          {/* Original markers for the two addresses */}
          {coords.map((coord, idx) => (
            <Marker 
              key={`address-${idx}-${coordsKey}`}
              position={coord}
              icon={{
                url: idx === 0 ? 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' : 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
              }}
            />
          ))}

          {/* Midpoint marker */}
          {coords.length >= 2 && (
            <Marker
              key={`midpoint-${coordsKey}`}
              position={midpoint}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                scaledSize: new google.maps.Size(40, 40)
              }}
            />
          )}

          {/* 1-mile radius circle - only shown when showCircle is true */}
          {coords.length >= 2 && showCircle && (
            <Circle
              key={`circle-${coordsKey}`}
              center={midpoint}
              radius={ONE_MILE_IN_METERS}
              options={circleOptions}
            />
          )}

          {/* Restaurant markers - updated to handle both location types */}
          {restaurants.map((restaurant, idx) => {
            // Use our helper function to get position regardless of format
            const position = restaurant.geometry && restaurant.geometry.location 
              ? getPosition(restaurant.geometry.location)
              : null;
            
            // Only render if we have a valid position
            if (position) {
              const isSelected = selectedRestaurant && selectedRestaurant.place_id === restaurant.place_id;
              
              return (
                <Marker
                  key={`restaurant-${restaurant.place_id || idx}-${coordsKey}`}
                  position={position}
                  icon={{
                    url: isSelected 
                      ? 'http://maps.google.com/mapfiles/ms/icons/purple-dot.png'
                      : 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
                    scaledSize: new google.maps.Size(isSelected ? 40 : 30, isSelected ? 40 : 30)
                  }}
                  title={restaurant.name || `Restaurant ${idx + 1}`}
                  onClick={() => handleRestaurantClick(restaurant)}
                  animation={isSelected ? google.maps.Animation.BOUNCE : null}
                />
              );
            }
            return null; // Skip this restaurant if it doesn't have valid location data
          })}

          {/* Restaurant info window - updated to handle both location types */}
          {infoWindowRestaurant && infoWindowRestaurant.geometry && 
           infoWindowRestaurant.geometry.location && (
            <RestaurantInfoWindow
              key={`info-${infoWindowRestaurant.place_id}-${coordsKey}`}
              restaurant={infoWindowRestaurant}
              position={getPosition(infoWindowRestaurant.geometry.location)}
              onClose={() => {
                setInfoWindowRestaurant(null);
                onRestaurantSelect(null);
              }}
            />
          )}
        </GoogleMap>
      </LoadScript>
      
      {/* Status messages */}
      {isLoading && coords.length >= 2 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-center">
          <p>Loading restaurants near the midpoint...</p>
        </div>
      )}
      
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-center">
          <p>{error}</p>
        </div>
      )}
      
      {!isLoading && !error && restaurants.length === 0 && coords.length >= 2 && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded text-center">
          <p>No restaurants found within 1 mile of the midpoint.</p>
        </div>
      )}
    </>
  );
}

export default MapView;
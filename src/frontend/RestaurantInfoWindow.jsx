import React, { memo, useMemo } from 'react';
import { InfoWindow } from '@react-google-maps/api';

// Using memo to prevent unnecessary re-renders
const RestaurantInfoWindow = memo(function RestaurantInfoWindow({ restaurant, position, onClose }) {
  // Get photo URL safely - using server proxy endpoint
  const photoUrl = useMemo(() => {
    try {
      if (restaurant.photos && restaurant.photos.length > 0) {
        // Handle both function-style and direct URL
        if (typeof restaurant.photos[0].getUrl === 'function') {
          return restaurant.photos[0].getUrl();
        } else if (restaurant.photos[0].photo_reference) {
          // Use our secure proxy endpoint instead of direct Google Maps URL
          return `${import.meta.env.VITE_API_BASE_URL}${import.meta.env.VITE_API_PATH}/places/photo?maxwidth=400&photoreference=${
            restaurant.photos[0].photo_reference
          }`;
        } else if (restaurant.photos[0].url) {
          return restaurant.photos[0].url;
        }
      }
    } catch (error) {
      console.error('Error getting photo URL:', error);
    }
    return null;
  }, [restaurant.photos]);

  // Generate rating stars
  const ratingStars = useMemo(() => {
    if (typeof restaurant.rating !== 'number') return null;
    
    const stars = [];
    const fullStars = Math.floor(restaurant.rating);
    const hasHalfStar = restaurant.rating - fullStars >= 0.5;
    
    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={`full-${i}`} className="text-yellow-500">★</span>);
    }
    
    // Add half star if needed
    if (hasHalfStar) {
      stars.push(<span key="half" className="text-yellow-500">★</span>);
    }
    
    // Add empty stars
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="text-gray-300">★</span>);
    }
    
    return stars;
  }, [restaurant.rating]);

  // Format opening hours
  const openingHours = useMemo(() => {
    if (!restaurant.opening_hours) return null;
    
    // If we have the formatted weekday_text
    if (restaurant.opening_hours.weekday_text && 
        Array.isArray(restaurant.opening_hours.weekday_text)) {
      return (
        <div className="mt-1 text-xs text-gray-600">
          {restaurant.opening_hours.open_now !== undefined && (
            <div className={restaurant.opening_hours.open_now ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
              {restaurant.opening_hours.open_now ? 'Open Now' : 'Closed Now'}
            </div>
          )}
        </div>
      );
    }
    
    // Just show open/closed status
    if (restaurant.opening_hours.open_now !== undefined) {
      return (
        <div className="mt-1 text-xs text-gray-600">
          <span className={restaurant.opening_hours.open_now ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
            {restaurant.opening_hours.open_now ? 'Open Now' : 'Closed Now'}
          </span>
        </div>
      );
    }
    
    return null;
  }, [restaurant.opening_hours]);

  // Format price level
  const priceLevel = useMemo(() => {
    if (typeof restaurant.price_level !== 'number') return null;
    
    // Use string repeat method instead of array
    const dollarString = '$'.repeat(restaurant.price_level);
    
    return (
      <span className="text-green-700 font-semibold">
        {dollarString}
      </span>
    );
  }, [restaurant.price_level]);

  return (
    <InfoWindow position={position} onCloseClick={onClose}>
      <div className="min-w-[200px] max-w-[300px]">
        <h3 className="font-bold text-lg mb-1">{restaurant.name || 'Restaurant'}</h3>
        
        {photoUrl && (
          <img
            src={photoUrl}
            alt={restaurant.name || 'Restaurant'}
            className="w-full h-32 object-cover mb-2 rounded"
            loading="lazy" // Add lazy loading for better performance
          />
        )}
        
        <div className="space-y-1">
          {restaurant.vicinity && (
            <p className="text-sm text-gray-600">{restaurant.vicinity}</p>
          )}
          
          {/* Price level and rating in one row */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              {priceLevel && (
                <div className="mr-2">{priceLevel}</div>
              )}
              {ratingStars && (
                <div className="flex">
                  {ratingStars}
                  <span className="ml-1 text-sm text-gray-600">
                    ({restaurant.user_ratings_total || 0})
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Opening hours */}
          {openingHours}
          
          {/* External links */}
          <div className="mt-2 space-y-1">
            {restaurant.website && (
              <a
                href={restaurant.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline block"
              >
                Visit Website
              </a>
            )}
            
            {restaurant.place_id && (
              <a
                href={`https://www.google.com/maps/place/?q=place_id:${restaurant.place_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline block"
              >
                View on Google Maps
              </a>
            )}
          </div>
        </div>
      </div>
    </InfoWindow>
  );
});

// Add display name for better debugging
RestaurantInfoWindow.displayName = 'RestaurantInfoWindow';

export default RestaurantInfoWindow;
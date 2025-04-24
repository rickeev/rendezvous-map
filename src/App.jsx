import React, { useState, useEffect } from 'react';
import Header from './frontend/Header';
import Footer from './frontend/Footer';
import AddressForm from './frontend/AddressForm';
import MapView from './frontend/MapView';

function App() {
  const [coords, setCoords] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // Reset restaurant-related states when coordinates change
  useEffect(() => {
    setRestaurants([]);
    setSelectedRestaurant(null);
  }, [coords]);

  // Modified handler to receive coordinates from AddressForm
  const handleCoordsUpdate = (newCoords) => {
    setCoords(newCoords);
    // No need to reset restaurants here as the useEffect will handle it
  };

  // Handler for receiving restaurants from MapView
  const handleRestaurantsUpdate = (newRestaurants) => {
    setRestaurants(newRestaurants);
  };

  // Handler for restaurant selection
  const handleRestaurantSelect = (restaurant) => {
    setSelectedRestaurant(restaurant);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column - Form and Restaurant Details */}
          <div className="lg:w-2/5 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto pr-2">
            <AddressForm onCoordsUpdate={handleCoordsUpdate} />
              
            {coords.length >= 2 && restaurants.length > 0 && (
              <div className="mt-6 bg-green-50 border border-green-200 rounded p-4">
                <h3 className="text-lg font-semibold mb-4">Restaurant Details</h3>
                
                <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2">
                  <div className="space-y-4">
                    {restaurants.map((restaurant, index) => (
                      <div 
                        key={restaurant.place_id || `restaurant-${index}`} 
                        className={`bg-white p-4 rounded-lg shadow-md cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                          selectedRestaurant && selectedRestaurant.place_id === restaurant.place_id 
                            ? 'border-2 border-blue-500 bg-blue-50' 
                            : ''
                        }`}
                        onClick={() => handleRestaurantSelect(restaurant)}
                      >
                        <h5 className="font-semibold text-gray-800 mb-2">
                          {restaurant.name || `Restaurant ${index + 1}`}
                        </h5>
                        
                        <div className="text-sm text-gray-600">
                          {/* Address */}
                          <p className="mb-2">{restaurant.vicinity || 'Address not available'}</p>
                          
                          {/* Rating */}
                          {restaurant.rating && (
                            <div className="flex items-center mb-2">
                              <span className="mr-2">Rating:</span>
                              {[...Array(5)].map((_, i) => (
                                <span 
                                  key={i} 
                                  className={`text-xl ${
                                    i < Math.round(restaurant.rating) 
                                      ? 'text-yellow-400' 
                                      : 'text-gray-300'
                                  }`}
                                >
                                  ★
                                </span>
                              ))}
                              <span className="ml-2 text-gray-500">
                                ({restaurant.rating.toFixed(1)})
                              </span>
                            </div>
                          )}

                          {/* External Links */}
                          <div className="flex space-x-2 mt-2">
                            {restaurant.website && (
                              <a
                                href={restaurant.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Visit Website
                              </a>
                            )}
                            
                            {restaurant.place_id && (
                              <a
                                href={`https://www.google.com/maps/place/?q=place_id:${restaurant.place_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Google Maps
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Right Column - Map and Legend */}
          <div className="lg:w-3/5">
            <div className="rounded-lg overflow-hidden shadow-md">
              <MapView 
                coords={coords} 
                onRestaurantsUpdate={handleRestaurantsUpdate}
                selectedRestaurant={selectedRestaurant}
                onRestaurantSelect={handleRestaurantSelect}
              />
            </div>
            
            {coords.length >= 2 && (
              <div className="mt-4 p-4 bg-white rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-2">Map Legend</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center">
                    <div className="h-4 w-4 rounded-full bg-blue-500 mr-2"></div>
                    <span>Address 1</span>
                  </div>
                  <div className="flex items-center">
                    <div className="h-4 w-4 rounded-full bg-green-500 mr-2"></div>
                    <span>Address 2</span>
                  </div>
                  <div className="flex items-center">
                    <div className="h-4 w-4 rounded-full bg-red-500 mr-2"></div>
                    <span>Midpoint</span>
                  </div>
                  <div className="flex items-center">
                    <div className="h-4 w-4 rounded-full bg-yellow-300 mr-2"></div>
                    <span>Restaurants</span>
                  </div>
                  <div className="flex items-center col-span-2">
                    <div className="h-4 w-4 rounded-full border-2 border-red-500 bg-red-100 bg-opacity-20 mr-2"></div>
                    <span>1-mile radius</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

export default App;
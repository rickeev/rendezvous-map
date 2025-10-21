# Rendezvous

A full-stack web app that finds the perfect meeting spot. Enter two addresses and discover restaurants within a 1-mile radius halfway between them.

### What It Does

- Takes two addresses from users
- Calculates the midpoint between them
- Shows you restaurants within 1 mile of that midpoint on a Google Map
- Displays restaurant details like ratings, hours, and links to their websites

### Tech Stack

**Frontend:**
- React 19
- Tailwind CSS
- Google Maps API
- Vite

**Backend:**
- Node.js with Express
- Axios for HTTP requests
- Rate limiting and caching to manage API usage
- Helmet for security headers

### Getting Started

#### Prerequisites
- Node.js (v18+)
- A Google Maps API key

#### Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   GOOGLE_MAPS_API_KEY=your_api_key_here
   PORT=5000
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. In another terminal, start the backend:
   ```bash
   node src/backend/server.js
   ```

5. Open http://localhost:5173 in your browser

### How It Works

1. **Geocoding:** The app takes your two addresses and converts them to coordinates using Google's Geocoding API
2. **Midpoint Calculation:** It calculates the exact midpoint between the two locations
3. **Restaurant Search:** It queries the Google Places API for restaurants within 1 mile of that midpoint
4. **Display:** Results show up both on the map and in a sortable list with ratings, hours, and website links

### Key Features

- **Caching System:** Reduces API calls by caching previous searches
- **Rate Limiting:** Prevents hitting Google's API quota limits
- **Error Handling:** Graceful error messages if addresses can't be found or the API fails
- **Request Tracking:** Monitors how many API calls you've made in a session

The backend handles all API communication with Google Maps to keep the API key secure. It manages:
- Caching of geocoding, place search, and place detail results
- Rate limiting between requests
- Request counting to prevent quota overages
- Batch processing for multiple addresses at once

The frontend is a React SPA that communicates with the backend through simple REST endpoints. All the heavy lifting happens server-side.

### API Endpoints

- `GET /api/health` – Check if the server is running
- `GET /api/geocode` – Convert an address to coordinates
- `POST /api/geocode/batch` – Geocode multiple addresses at once
- `GET /api/places/nearby` – Find restaurants near a location
- `GET /api/places/details` – Get detailed info about a specific restaurant
- `GET /api/stats` – See how many API calls you've made

### Limitations & Notes

- The free tier of Google Maps API has quotas, so the app limits requests to prevent overages
- Restaurants are limited to the top 10 results to keep the map readable
- The 1-mile radius is hardcoded—feel free to make it adjustable
// server.js - Optimized API Management for Google Maps Services
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import compression from 'compression';
import helmet from 'helmet';

// Initialize environment variables
dotenv.config();

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Create an axios instance with connection pooling and timeouts
const api = axios.create({
  timeout: 10000,
  headers: {
    'Accept': 'application/json'
  },
  // Keep connections alive for better performance
  maxContentLength: 50 * 1000 * 1000, // 50 MB
  maxBodyLength: 50 * 1000 * 1000, // 50 MB
  // Add custom httpsAgent for connection reuse
  httpsAgent: new (require('https')).Agent({ keepAlive: true })
});

// Cache storage with maps for different API services
const cache = {
  geocoding: new Map(),
  places: new Map(),
  details: new Map()
};

// Cache expiry times (milliseconds)
const CACHE_EXPIRY = {
  geocoding: 30 * 60 * 1000,  // 30 minutes
  places: 15 * 60 * 1000,     // 15 minutes
  details: 60 * 60 * 1000     // 60 minutes
};

// Memory management - cache size limits
const CACHE_LIMITS = {
  geocoding: 1000,
  places: 500,
  details: 500
};

// Request tracking
const requestStats = {
  total: 0,
  geocoding: 0,
  places: 0,
  details: 0,
  limit: 50,  // Maximum requests per session
  lastReset: Date.now()
};

// Rate limiting helper - adjusted for less strict limits
const rateLimiter = {
  lastGeocodeRequest: 0,
  lastPlacesRequest: 0,
  lastDetailsRequest: 0,
  minInterval: 100, // 0.1 seconds between requests - reduced for better performance
  
  canMakeRequest(type) {
    const now = Date.now();
    let lastRequest;
    
    switch(type) {
      case 'geocoding':
        lastRequest = this.lastGeocodeRequest;
        this.lastGeocodeRequest = now;
        break;
      case 'places':
        lastRequest = this.lastPlacesRequest;
        this.lastPlacesRequest = now;
        break;
      case 'details':
        lastRequest = this.lastDetailsRequest;
        this.lastDetailsRequest = now;
        break;
      default:
        return false;
    }
    
    // Check if enough time has passed since the last request
    if (now - lastRequest < this.minInterval) {
      console.log(`Rate limit check failed for ${type}. Only ${now - lastRequest}ms since last request.`);
      return false;
    }
    
    return true;
  }
};

// Session management - automatic reset after 24 hours
function checkSessionReset() {
  // Reset stats after 24 hours
  if (Date.now() - requestStats.lastReset > 24 * 60 * 60 * 1000) {
    console.log('Resetting session stats (24-hour period elapsed)');
    Object.keys(requestStats).forEach(key => {
      if (typeof requestStats[key] === 'number' && key !== 'limit') {
        requestStats[key] = 0;
      }
    });
    
    // Clear all caches on session reset for clean state
    cache.geocoding.clear();
    cache.places.clear();
    cache.details.clear();
    
    requestStats.lastReset = Date.now();
  }
}

// Cache management - check cache size and purge oldest items if needed
function manageCacheSize(type) {
  const cacheMap = cache[type];
  const limit = CACHE_LIMITS[type];
  
  if (cacheMap.size > limit) {
    console.log(`Cache ${type} exceeded limit (${cacheMap.size}/${limit}), purging oldest items`);
    
    // Convert to array of [key, {data, timestamp}] pairs and sort by timestamp
    const entries = Array.from(cacheMap.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 20% of entries
    const removeCount = Math.floor(entries.length * 0.2);
    for (let i = 0; i < removeCount; i++) {
      cacheMap.delete(entries[i][0]);
    }
    
    console.log(`Removed ${removeCount} items from ${type} cache`);
  }
}

// Middleware - security and performance
app.use(helmet({ contentSecurityPolicy: false })); // Security headers
app.use(compression()); // Compress responses
app.use(cors({
  origin: '*', // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Debug middleware to log all requests - only in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });
}

// Static files when in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Request tracking middleware
app.use((req, res, next) => {
  checkSessionReset();
  next();
});

// Helper to handle API requests with caching
async function handleCachedRequest(type, cacheKey, apiUrl) {
  // Check cache
  const cachedItem = cache[type].get(cacheKey);
  if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_EXPIRY[type])) {
    // Update access time to implement LRU behavior
    cachedItem.lastAccessed = Date.now();
    console.log(`Using cached ${type} data for ${cacheKey}`);
    return cachedItem.data;
  }
  
  // Check limits
  if (requestStats.total >= requestStats.limit) {
    throw new Error('Request limit reached');
  }
  
  // Rate limiting - with detailed logging
  if (!rateLimiter.canMakeRequest(type)) {
    throw new Error('Rate limit reached, please try again in a moment');
  }
  
  // Make request
  try {
    console.log(`Making ${type} API request to Google Maps: ${apiUrl}`);
    
    // Use our configured axios instance
    const response = await api.get(apiUrl);
    
    // Log Google API response status
    console.log(`Google API response status: ${response.data.status}`);
    
    // Update stats
    requestStats.total++;
    requestStats[type]++;
    
    // Handle Google API errors
    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      console.error(`Google Maps API error: ${response.data.status}`);
      if (response.data.error_message) {
        console.error(`Error message: ${response.data.error_message}`);
      }
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }
    
    // Cache and return successful response
    if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
      // Store in cache with current timestamp
      cache[type].set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
        lastAccessed: Date.now()
      });
      
      // Check and manage cache size
      manageCacheSize(type);
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error in ${type} request:`, error.message);
    
    // More detailed error logging
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received');
    }
    
    throw error;
  }
}

// Helper for batch geocoding requests
async function batchGeocode(addresses) {
  const results = [];
  const errors = [];
  
  // Process in batches of 5 (Google allows up to 10, but let's be conservative)
  const batchSize = 5;
  
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const promises = batch.map(async (address) => {
      try {
        const normalizedAddress = address.toLowerCase().trim();
        const cacheKey = normalizedAddress;
        const apiUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        
        const data = await handleCachedRequest('geocoding', cacheKey, apiUrl);
        return { address, data };
      } catch (error) {
        return { address, error: error.message };
      }
    });
    
    // Wait for current batch to complete before starting next batch
    const batchResults = await Promise.all(promises);
    
    // Process batch results
    for (const result of batchResults) {
      if (result.error) {
        errors.push({ address: result.address, error: result.error });
      } else {
        results.push({ address: result.address, data: result.data });
      }
    }
    
    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < addresses.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return { results, errors };
}

// Test endpoint to verify server is responsive
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// API Key verification endpoint
app.get('/api/verify-key', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  // Check if key exists
  if (!apiKey) {
    return res.status(500).json({ 
      status: 'ERROR', 
      message: 'API key not found in environment variables' 
    });
  }
  
  // Return partial key for verification (hide most of it for security)
  res.json({ 
    status: 'OK', 
    message: 'API key found', 
    keyPreview: `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` 
  });
});

// Stats endpoint for monitoring
app.get('/api/stats', (req, res) => {
  checkSessionReset();
  res.json({
    requestStats,
    cacheStats: {
      geocoding: cache.geocoding.size,
      places: cache.places.size,
      details: cache.details.size
    }
  });
});

// Reset stats endpoint (for testing or manual reset)
app.post('/api/stats/reset', (req, res) => {
  console.log('Manually resetting API stats');
  Object.keys(requestStats).forEach(key => {
    if (typeof requestStats[key] === 'number' && key !== 'limit') {
      requestStats[key] = 0;
    }
  });
  requestStats.lastReset = Date.now();
  
  // Also clear caches
  cache.geocoding.clear();
  cache.places.clear();
  cache.details.clear();
  
  res.json({ message: 'Stats reset successfully', requestStats });
});

// Endpoint for geocoding
app.get('/api/geocode', async (req, res) => {
  const address = req.query.address;
  
  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }
  
  try {
    const normalizedAddress = address.toLowerCase().trim();
    const cacheKey = normalizedAddress;
    const apiUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    const data = await handleCachedRequest('geocoding', cacheKey, apiUrl);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Batch geocoding endpoint
app.post('/api/geocode/batch', async (req, res) => {
  const { addresses } = req.body;
  
  if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ error: 'Array of addresses is required' });
  }
  
  try {
    const results = await batchGeocode(addresses);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint for nearby places with pagination
app.get('/api/places/nearby', async (req, res) => {
  const { lat, lng, radius, type, pagetoken } = req.query;
  
  if ((!lat || !lng) && !pagetoken) {
    return res.status(400).json({ error: 'Location coordinates required unless using pagetoken' });
  }
  
  try {
    // If using pagetoken, it's the only parameter needed
    if (pagetoken) {
      const cacheKey = `pagetoken:${pagetoken}`;
      const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pagetoken}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      
      // Page tokens require a delay before they're valid
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const data = await handleCachedRequest('places', cacheKey, apiUrl);
      res.json(data);
      return;
    }
    
    // Normal nearby search
    const cacheKey = `${lat},${lng},${radius || 1609.34},${type || 'restaurant'}`;
    const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius || 1609.34}&type=${type || 'restaurant'}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    const data = await handleCachedRequest('places', cacheKey, apiUrl);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint for place details
app.get('/api/places/details', async (req, res) => {
  const { placeid, fields } = req.query;
  
  if (!placeid) {
    return res.status(400).json({ error: 'Place ID is required' });
  }
  
  try {
    const cacheKey = `${placeid},${fields || ''}`;
    const fieldsParam = fields ? `&fields=${fields}` : '';
    const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeid}${fieldsParam}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    const data = await handleCachedRequest('details', cacheKey, apiUrl);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Batch place details endpoint
app.post('/api/places/details/batch', async (req, res) => {
  const { placeIds, fields } = req.body;
  
  if (!placeIds || !Array.isArray(placeIds) || placeIds.length === 0) {
    return res.status(400).json({ error: 'Array of place IDs is required' });
  }
  
  try {
    const results = [];
    const errors = [];
    
    // Process in batches of 5
    const batchSize = 5;
    const fieldsParam = fields ? fields.join(',') : '';
    
    for (let i = 0; i < placeIds.length; i += batchSize) {
      const batch = placeIds.slice(i, i + batchSize);
      const promises = batch.map(async (placeId) => {
        try {
          const cacheKey = `${placeId},${fieldsParam}`;
          const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}${fieldsParam ? `&fields=${fieldsParam}` : ''}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
          
          const data = await handleCachedRequest('details', cacheKey, apiUrl);
          return { placeId, data };
        } catch (error) {
          return { placeId, error: error.message };
        }
      });
      
      const batchResults = await Promise.all(promises);
      
      for (const result of batchResults) {
        if (result.error) {
          errors.push({ placeId: result.placeId, error: result.error });
        } else {
          results.push({ placeId: result.placeId, data: result.data });
        }
      }
      
      // Add a small delay between batches
      if (i + batchSize < placeIds.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    res.json({ results, errors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Catch-all route for SPA in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Error handling middleware (must be after all routes)
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: err.message || 'Internal server error', 
    status: 'ERROR' 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Key exists: ${!!process.env.GOOGLE_MAPS_API_KEY}`);
  
  if (process.env.GOOGLE_MAPS_API_KEY) {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    console.log(`API Key preview: ${key.substring(0, 4)}...${key.substring(key.length - 4)}`);
  }
  
  // Display memory usage
  const memoryUsage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
  });
});
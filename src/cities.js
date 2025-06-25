// Major German cities with their main station IDs
export const cities = {
  'Berlin': { id: '8011160', name: 'Berlin Hbf' },
  'Munich': { id: '8000261', name: 'München Hbf' },
  'Hamburg': { id: '8002549', name: 'Hamburg Hbf' },
  'Cologne': { id: '8000207', name: 'Köln Hbf' },
  'Frankfurt': { id: '8000105', name: 'Frankfurt(Main)Hbf' },
  'Stuttgart': { id: '8000096', name: 'Stuttgart Hbf' },
  'Düsseldorf': { id: '8000085', name: 'Düsseldorf Hbf' },
  'Dortmund': { id: '8000080', name: 'Dortmund Hbf' },
  'Essen': { id: '8000098', name: 'Essen Hbf' },
  'Leipzig': { id: '8010205', name: 'Leipzig Hbf' },
  'Bremen': { id: '8000050', name: 'Bremen Hbf' },
  'Dresden': { id: '8010085', name: 'Dresden Hbf' },
  'Hannover': { id: '8000152', name: 'Hannover Hbf' },
  'Nuremberg': { id: '8000284', name: 'Nürnberg Hbf' },
  'Duisburg': { id: '8000086', name: 'Duisburg Hbf' },
  'Mannheim': { id: '8000244', name: 'Mannheim Hbf' },
  'Karlsruhe': { id: '8000191', name: 'Karlsruhe Hbf' },
  'Augsburg': { id: '8000013', name: 'Augsburg Hbf' },
  'Bonn': { id: '8000044', name: 'Bonn Hbf' },
  'Heidelberg': { id: '8000156', name: 'Heidelberg Hbf' }
};

export function getCityNames() {
  return Object.keys(cities).sort();
}

export function getStationId(cityName) {
  const city = cities[cityName];
  return city ? city.id : null;
}

export function getStationName(cityName) {
  const city = cities[cityName];
  return city ? city.name : null;
}

// Cache for search results to avoid repeated API calls
const searchCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Search for stations matching query using db-vendo-client
export async function searchStations(client, query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  const cacheKey = `search_${normalizedQuery}`;
  
  // Check cache first
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.results;
  }

  try {
    console.log(`🔍 Searching for stations matching "${query}"...`);
    
    const results = await client.locations(query);
    
    // Filter for train stations only
    const stations = results.filter(location => {
      const isStation = location.type === 'station' || location.type === 'stop';
      const isTrainStation = location.products && (
        location.products.nationalExpress ||
        location.products.national ||
        location.products.regionalExpress ||
        location.products.regional
      );
      return isStation && isTrainStation;
    });

    // Format results for easier use
    const formattedStations = stations.map(station => ({
      id: station.id,
      name: station.name,
      location: station.location ? `${station.location.latitude},${station.location.longitude}` : null,
      products: station.products,
      distance: station.distance || null
    }));

    // Cache the results
    searchCache.set(cacheKey, {
      results: formattedStations,
      timestamp: Date.now()
    });

    return formattedStations;
    
  } catch (error) {
    console.error(`❌ Error searching for stations: ${error.message}`);
    return [];
  }
}

// Get popular cities for quick selection
export function getPopularCities() {
  const popularOrder = [
    'Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt', 
    'Stuttgart', 'Düsseldorf', 'Dortmund', 'Leipzig', 'Dresden'
  ];
  
  return popularOrder.filter(city => cities[city]).map(city => ({
    name: city,
    id: cities[city].id,
    stationName: cities[city].name,
    isPopular: true
  }));
}

// Check if a city is in our popular cities list
export function isPopularCity(cityName) {
  return cities.hasOwnProperty(cityName);
}

// Get station info by ID (for when we have the ID but need details)
export async function getStationById(client, stationId) {
  try {
    const results = await client.locations(stationId);
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error(`❌ Error getting station by ID: ${error.message}`);
    return null;
  }
}

// Clear search cache (useful for testing or memory management)
export function clearSearchCache() {
  searchCache.clear();
}
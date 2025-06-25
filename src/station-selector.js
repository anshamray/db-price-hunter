import inquirer from 'inquirer';
import { 
  getPopularCities, 
  isPopularCity, 
  getStationId, 
  getStationName,
  searchStations 
} from './cities.js';

// Station selection choices
const SELECTION_CHOICES = {
  POPULAR: 'popular',
  SEARCH: 'search',
  BACK: 'back'
};

// Select from multiple stations when search returns multiple results
export async function selectStation(searchResults, query) {
  if (searchResults.length === 0) {
    console.log(`❌ No train stations found for "${query}"`);
    return null;
  }

  if (searchResults.length === 1) {
    const station = searchResults[0];
    console.log(`✅ Found: ${station.name} (${station.id})`);
    return station;
  }

  console.log(`\n🚉 Found ${searchResults.length} stations for "${query}":`);
  
  const choices = searchResults.map((station, index) => ({
    name: `${station.name} (${station.id})`,
    value: station,
    short: station.name
  }));

  choices.push({
    name: '← Go back to search',
    value: null,
    short: 'Back'
  });

  const answer = await inquirer.prompt([{
    type: 'list',
    name: 'station',
    message: 'Select a station:',
    choices,
    pageSize: 10
  }]);

  return answer.station;
}

// Interactive station search
export async function interactiveSearch(client) {
  while (true) {
    const searchAnswer = await inquirer.prompt([{
      type: 'input',
      name: 'query',
      message: 'Enter city or station name (min 2 characters):',
      validate: (input) => {
        if (!input || input.trim().length < 2) {
          return 'Please enter at least 2 characters';
        }
        return true;
      }
    }]);

    const query = searchAnswer.query.trim();
    
    // Check if it's a popular city first
    if (isPopularCity(query)) {
      return {
        id: getStationId(query),
        name: getStationName(query),
        isPopular: true
      };
    }

    // Search for stations
    const searchResults = await searchStations(client, query);
    
    if (searchResults.length === 0) {
      console.log(`❌ No train stations found for "${query}"`);
      
      const retryAnswer = await inquirer.prompt([{
        type: 'confirm',
        name: 'retry',
        message: 'Would you like to try a different search?',
        default: true
      }]);

      if (!retryAnswer.retry) {
        return null;
      }
      continue;
    }

    const selectedStation = await selectStation(searchResults, query);
    
    if (selectedStation === null) {
      // User chose to go back, continue the search loop
      continue;
    }

    return selectedStation;
  }
}

// Main hybrid city/station selection function
export async function selectCityStation(client, promptMessage = 'Select departure city:') {
  console.log('\n🚉 Station Selection');
  console.log('You can choose from popular cities or search for any German station.\n');

  const methodAnswer = await inquirer.prompt([{
    type: 'list',
    name: 'method',
    message: promptMessage,
    choices: [
      {
        name: '⭐ Choose from popular cities',
        value: SELECTION_CHOICES.POPULAR,
        short: 'Popular'
      },
      {
        name: '🔍 Search for any station',
        value: SELECTION_CHOICES.SEARCH,
        short: 'Search'
      }
    ]
  }]);

  if (methodAnswer.method === SELECTION_CHOICES.POPULAR) {
    return await selectFromPopularCities(client);
  } else {
    return await interactiveSearch(client);
  }
}

// Select from popular cities
async function selectFromPopularCities(client) {
  const popularCities = getPopularCities();
  
  const choices = popularCities.map(city => ({
    name: `${city.name} (${city.stationName})`,
    value: {
      id: city.id,
      name: city.stationName,
      cityName: city.name,
      isPopular: true
    },
    short: city.name
  }));

  choices.push({
    name: '🔍 Search for a different station instead',
    value: 'search',
    short: 'Search'
  });

  const answer = await inquirer.prompt([{
    type: 'list',
    name: 'selection',
    message: 'Choose a popular city:',
    choices,
    pageSize: 12
  }]);

  // If user chose search, trigger interactive search
  if (answer.selection === 'search') {
    return await interactiveSearch(client);
  }

  return answer.selection;
}

// Helper function to get station details for display
export function formatStationDisplay(station) {
  if (!station) return 'Not selected';
  
  return station.name;
}

// Validate station selection
export function validateStation(station) {
  if (!station) {
    return 'Please select a station';
  }
  
  if (!station.id || !station.name) {
    return 'Invalid station data';
  }
  
  return true;
}
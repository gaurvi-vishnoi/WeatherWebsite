const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors({options:"*",
  methods:["POST", "GET", "DELETE"],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


//temp imports
const fs = require('fs');
const path = require('path');



app.use(express.json());
// Serve the static files from the Angular dist directory
//app.use(express.static(path.join(__dirname, 'dist/frontend')));
app.use(express.static("frontend/dist/frontend"));

// Handle all other routes by returning the Angular index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/frontend', 'index.html'));
});

// API keys
const TOMORROW_API_KEY = '2FIwP9UZHiHHfSNxpYzo426jrmZRvTrP';
const GOOGLE_API_KEY = 'AIzaSyAWwzeZ7EdoCpGi-8pQSF4SfiKNl5wNtmE';
const MONGODB_URI = 'mongodb+srv://gaurviivishnoi:Ishi1234@cluster0.l8ize.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'; 

// MongoDB connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
});

// Define schema and model for favorites
const favoriteSchema = new mongoose.Schema({
  city: String,
  state: String
});

const Favorite = mongoose.model('Favorite', favoriteSchema);

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Weather Search API');
});

// Weather route that includes Geocoding API to get latitude and longitude
app.get('/weather', async (req, res) => {
  const { street, city, state } = req.query;

  if (!street || !city || !state) {
    return res.status(400).json({ error: 'Missing required query parameters: street, city, and state' });
  }

  try {
    // Step 1: Get latitude and longitude from Google Geocoding API
    const address = `${street}, ${city}, ${state}`;
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
    const geocodingResponse = await axios.get(geocodingUrl);

    const location = geocodingResponse.data.results[0]?.geometry.location;

    if (!location) {
      return res.status(404).json({ error: 'Could not determine coordinates for the provided address' });
    }

    const { lat, lng } = location;

    // Step 2: Use the coordinates to fetch detailed weather data from Tomorrow.io API
    const forecastUrl = `https://api.tomorrow.io/v4/timelines?location=${lat},${lng}&fields=temperatureMax,temperatureMin,windSpeed,humidity,visibility,cloudCover,weatherCode,temperature,sunriseTime,sunsetTime&timesteps=1d&units=imperial&apikey=${TOMORROW_API_KEY}`;

    try {
      // Fetch forecast weather data
      const forecastResponse = await axios.get(forecastUrl);
      const forecastData = forecastResponse.data.data.timelines[0].intervals;

      // Extract relevant data for each day
      const dailyForecast = forecastData.map((interval) => ({
        date: interval.startTime,
        status: interval.values.weatherCode, // Map to status if needed
        tempHigh: interval.values.temperatureMax,
        tempLow: interval.values.temperatureMin,
        windSpeed: interval.values.windSpeed,
        apparentTemp: interval.values.temperatureApparent,
        sunriseTime: interval.values.sunriseTime,
        sunsetTime: interval.values.sunsetTime,
        humidity: interval.values.humidity,
        visibility: interval.values.visibility,
        cloudCover: interval.values.cloudCover,
      }));

      // Structuring the response data
      const responseData = {
        location: `${city}, ${state}`,
        dailyForecast,
      };

      // Log the extracted data in JSON format on the terminal
      console.log("Weather Data:", JSON.stringify(responseData, null, 2));

      // Send the response back to the client
      res.json(responseData);

    } catch (weatherError) {
      console.error('Error fetching weather data from Tomorrow.io:', weatherError.message);
      res.status(500).json({ error: 'Failed to fetch weather data from Tomorrow.io' });
    }

  } catch (geoError) {
    console.error('Error fetching data from Google Geocoding API:', geoError.message);
    res.status(500).json({ error: 'Failed to fetch data from Google Geocoding API' });
  }
});


app.get('/weatherHourly', async (req, res) => {
  const { street, city, state } = req.query;

  if (!street || !city || !state) {
    return res.status(400).json({ error: 'Missing required query parameters: street, city, and state' });
  }

  try {
    const address = `${street}, ${city}, ${state}`;
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
    const geocodingResponse = await axios.get(geocodingUrl);

    const location = geocodingResponse.data.results[0]?.geometry.location;

    if (!location) {
      console.error('Could not determine coordinates for the provided address');
      return res.status(404).json({ error: 'Could not determine coordinates for the provided address' });
    }

    const { lat, lng } = location;

    const forecastUrl = `https://api.tomorrow.io/v4/timelines?location=${lat},${lng}&fields=temperatureMax,temperatureMin,windSpeed,humidity,temperatureApparent,pressureSurfaceLevel,windDirection&timesteps=1h&units=imperial&apikey=${TOMORROW_API_KEY}`;
    console.log(`Requesting forecast data from Tomorrow.io with URL: ${forecastUrl}`);

    try {
      const forecastResponse = await axios.get(forecastUrl);

      // Check if the data structure is as expected
      const forecastData = forecastResponse.data?.data?.timelines?.[0]?.intervals;
      if (!forecastData) {
        console.error('Unexpected data structure from Tomorrow.io:', forecastResponse.data);
        return res.status(500).json({ error: 'Unexpected data structure from Tomorrow.io' });
      }

      const hourlyForecast = forecastData.map((interval) => ({
        date: interval.startTime,
        tempHigh: interval.values.temperatureMax,
        tempLow: interval.values.temperatureMin,
        windSpeed: interval.values.windSpeed,
        apparentTemp: interval.values.temperatureApparent,
        humidity: interval.values.humidity,
        visibility: interval.values.visibility,
        pressureSurfaceLevel: interval.values.pressureSurfaceLevel,
        windDirection: interval.values.windDirection
      }));

      const responseData = {
        location: `${city}, ${state}`,
        weatherData: hourlyForecast,
      };

      console.log("Hourly Weather Data:", JSON.stringify(responseData, null, 2));
      res.json(responseData);

    } catch (weatherError) {
      console.error('Error fetching weather data from Tomorrow.io:', weatherError.message);
      res.status(500).json({ error: 'Failed to fetch weather data from Tomorrow.io' });
    }

  } catch (geoError) {
    console.error('Error fetching data from Google Geocoding API:', geoError.message);
    res.status(500).json({ error: 'Failed to fetch data from Google Geocoding API' });
  }
});


// Autocomplete route for Google Places API
app.get('/autocomplete', async (req, res) => {
  const { input } = req.query;

  if (!input) {
    return res.status(400).json({ error: 'Missing required query parameter: input' });
  }

  try {
    const googleApiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=(cities)&key=${GOOGLE_API_KEY}`;
    const response = await axios.get(googleApiUrl);
    
    if (response.data) {
      res.json(response.data);
    } else {
      res.status(500).json({ error: 'No data received from Google Places API' });
    }
  } catch (error) {
    console.error('Error fetching autocomplete data:', error.message);
    res.status(500).json({ error: 'Failed to fetch autocomplete data' });
  }
});

// Add a favorite location
app.post('/favorites', async (req, res) => {
  const { city, state } = req.body;
  try {
    const favorite = new Favorite({ city, state });
    await favorite.save();
    res.send({ success: true, message: 'Added to favorites' });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to add to favorites' });
  }
});

// Get all favorite locations
app.get('/favorites', async (req, res) => {
  try {
    const favorites = await Favorite.find();
    res.send(favorites);
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to fetch favorites' });
  }
});

// Remove a favorite location
app.delete('/favorites/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await Favorite.findByIdAndDelete(id);
    res.send({ success: true, message: 'Removed from favorites' });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to remove from favorites' });
  }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


app.get('/dummy', (req, res)=>{
  // const fp = path.join(__dirname, 'timelines.json');
  // console.log(fp);
  // fs.readFile('timelines.json', 'utf8', (err, data) => {
  //   fdata = JSON.parse(data);
  //   res.json({weatherData:fdata});
  // })
  // const data = JSON.parse()
  res.json({weatherData:data});
});
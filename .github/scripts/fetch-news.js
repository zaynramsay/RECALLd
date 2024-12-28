const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.NEWS_API_KEY;

// Debug logging for API key
console.log('Environment variables available:', Object.keys(process.env));
console.log('API Key exists:', !!API_KEY);
console.log('API Key length:', API_KEY ? API_KEY.length : 0);
console.log('First 4 chars:', API_KEY ? API_KEY.substring(0, 4) : 'N/A');

if (!API_KEY) {
    console.error('NEWS_API_KEY environment variable is not set');
    process.exit(1);
}

if (API_KEY.length !== 32) {
    console.error(`Invalid API key length: ${API_KEY.length} (expected 32)`);
    process.exit(1);
}

const OUTPUT_FILE = path.join(__dirname, '../../data/news.json');

// Ensure data directory exists
const dataDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory');
}

console.log('Starting news fetch...');

// Get date range for the API query
function getDateRange() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30); // Last 30 days
    
    return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0]
    };
}

// Construct the API URL with date range
const query = encodeURIComponent('food recall');
const dates = getDateRange();
const url = `https://newsapi.org/v2/everything?` +
    `q=${query}&` +
    `language=en&` +
    `from=${dates.from}&` +
    `to=${dates.to}&` +
    `sortBy=publishedAt&` +
    `pageSize=100&` +
    `apiKey=${API_KEY}`;

// Log URL for debugging (with key truncated)
const debugUrl = url.replace(API_KEY, API_KEY.substring(0, 4) + '...');
console.log('Debug URL:', debugUrl);

// Create request options with User-Agent header
const options = {
    headers: {
        'User-Agent': 'GitHub-Action-Food-Recall-Monitor/1.0',
        'X-Api-Key': API_KEY
    }
};

https.get(url, options, (resp) => {
    let data = '';
    
    resp.on('data', (chunk) => {
        data += chunk;
    });
    
    resp.on('end', () => {
        try {
            // Log the raw response for debugging
            console.log('Raw API Response:', data);
            
            const news = JSON.parse(data);
            if (news.status === 'error') {
                console.error('API Error Details:', {
                    status: news.status,
                    code: news.code,
                    message: news.message
                });
                process.exit(1);
            }
            
            const timestamp = new Date().toISOString();
            const storage = {
                lastUpdated: timestamp,
                articles: news.articles,
                totalResults: news.totalResults,
                query: query
            };
            
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(storage, null, 2));
            console.log(`News data updated successfully. Found ${news.totalResults} articles.`);
        } catch (err) {
            console.error('Error processing response:', err);
            console.error('Response data:', data);
            process.exit(1);
        }
    });
}).on('error', (err) => {
    console.error('Error fetching news:', err.message);
    if (err.response) {
        console.error('Response Headers:', err.response.headers);
    }
    process.exit(1);
});

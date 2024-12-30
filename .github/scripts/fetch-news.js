const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration constants
const CONFIG = {
    API_KEY: process.env.NEWS_API_KEY,
    OUTPUT_FILE: path.join(__dirname, '../../data/news.json'),
    USER_AGENT: 'GitHub-Action-Food-Recall-Monitor/1.0',
    API_BASE_URL: 'https://newsapi.org/v2/everything',
    DAYS_TO_FETCH: 30,
    PAGE_SIZE: 100
};

// Search parameters
const SEARCH_PARAMS = {
    queries: [
        'food recall',
        'fda recall',
        'usda recall'
    ],
    language: 'en',
    sortBy: 'publishedAt'
};

/**
 * Validates the API key exists and meets length requirements
 * @throws {Error} If API key is invalid or missing
 */
function validateApiKey() {
    const expectedLength = 32;
    
    if (!CONFIG.API_KEY) {
        throw new Error('NEWS_API_KEY environment variable is not set');
    }
    
    if (CONFIG.API_KEY.length !== expectedLength) {
        throw new Error(`Invalid API key length: ${CONFIG.API_KEY.length} (expected ${expectedLength})`);
    }
}

/**
 * Ensures the output directory exists
 * @returns {void}
 */
function ensureOutputDirectory() {
    const dataDir = path.dirname(CONFIG.OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('Created data directory');
    }
}

/**
 * Calculates the date range for the API query
 * @returns {Object} Object containing from and to dates
 */
function getDateRange() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - CONFIG.DAYS_TO_FETCH);
    
    return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0]
    };
}

/**
 * Constructs the API URL with all necessary parameters
 * @returns {string} Complete API URL
 */
function buildApiUrl() {
    const dates = getDateRange();
    // Join queries with OR operator for News API
    const combinedQuery = SEARCH_PARAMS.queries.join(' OR ');
    
    const params = new URLSearchParams({
        q: combinedQuery,
        language: SEARCH_PARAMS.language,
        from: dates.from,
        to: dates.to,
        sortBy: SEARCH_PARAMS.sortBy,
        pageSize: CONFIG.PAGE_SIZE,
        apiKey: CONFIG.API_KEY
    });
    
    return `${CONFIG.API_BASE_URL}?${params.toString()}`;
}

/**
 * Creates request options with necessary headers
 * @returns {Object} Request options
 */
function getRequestOptions() {
    return {
        headers: {
            'User-Agent': CONFIG.USER_AGENT,
            'X-Api-Key': CONFIG.API_KEY
        }
    };
}

/**
 * Processes and saves the API response
 * @param {Object} news - Parsed API response
 * @throws {Error} If API returns an error status
 */
function processAndSaveResponse(news) {
    if (news.status === 'error') {
        throw new Error(`API Error: ${news.code} - ${news.message}`);
    }
    
    const storage = {
        lastUpdated: new Date().toISOString(),
        articles: news.articles,
        totalResults: news.totalResults,
        query: SEARCH_PARAMS.query
    };
    
    fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(storage, null, 2));
    console.log(`News data updated successfully. Found ${news.totalResults} articles.`);
}

/**
 * Makes the HTTP request to the News API
 * @returns {Promise} Promise that resolves when the request is complete
 */
function fetchNewsData() {
    return new Promise((resolve, reject) => {
        const url = buildApiUrl();
        const options = getRequestOptions();
        
        https.get(url, options, (resp) => {
            let data = '';
            
            resp.on('data', (chunk) => {
                data += chunk;
            });
            
            resp.on('end', () => {
                try {
                    const news = JSON.parse(data);
                    processAndSaveResponse(news);
                    resolve();
                } catch (err) {
                    reject(new Error(`Failed to process response: ${err.message}`));
                }
            });
        }).on('error', (err) => {
            reject(new Error(`Failed to fetch news: ${err.message}`));
        });
    });
}

/**
 * Main execution function
 */
async function main() {
    try {
        validateApiKey();
        ensureOutputDirectory();
        console.log('Starting news fetch...');
        await fetchNewsData();
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

// Start execution
main();

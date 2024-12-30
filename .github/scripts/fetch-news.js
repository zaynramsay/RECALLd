const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration constants
const CONFIG = {
    API_KEY: process.env.NEWS_API_KEY,
    OUTPUT_FILE: path.join(__dirname, '../../data/news.json'),
    USER_AGENT: 'GitHub-Action-Food-Recall-Monitor/1.0',
    API_BASE_URL: 'https://newsapi.org/v2/everything',
    PAGE_SIZE: 100
};

// Search parameters
const SEARCH_PARAMS = {
    query: '("food recall" OR "FDA recall" OR "USDA recall")',  // Single combined query
    language: 'en',
    sortBy: 'publishedAt',
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
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
 * Constructs the API URL
 * @returns {string} API URL
 */
function buildApiUrl() {
    const params = new URLSearchParams({
        q: SEARCH_PARAMS.query,
        language: SEARCH_PARAMS.language,
        sortBy: SEARCH_PARAMS.sortBy,
        from: SEARCH_PARAMS.from,
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
 * Makes a single HTTP request to the News API
 * @param {string} url - The API URL to fetch from
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Promise that resolves with the parsed JSON response
 */
function makeRequest(url, options) {
    return new Promise((resolve, reject) => {
        https.get(url, options, (resp) => {
            let data = '';
            
            resp.on('data', (chunk) => {
                data += chunk;
            });
            
            resp.on('end', () => {
                try {
                    const news = JSON.parse(data);
                    if (news.status === 'error') {
                        reject(new Error(`API Error: ${news.code} - ${news.message}`));
                    }
                    resolve(news);
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
 * Processes and saves the combined API responses
 * @param {Array<Object>} newsResults - Array of API responses
 */
function processAndSaveResponse(newsResults) {
    const allArticles = newsResults.flatMap(news => news.articles);
    const uniqueArticles = Array.from(new Map(
        allArticles.map(article => [article.url, article])
    ).values());
    
    const storage = {
        lastUpdated: new Date().toISOString(),
        articles: uniqueArticles,
        totalResults: uniqueArticles.length,
        query: SEARCH_PARAMS.query  // Changed from queries array
    };
    
    fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(storage, null, 2));
    console.log(`News data updated successfully. Found ${uniqueArticles.length} unique articles.`);
}

/**
 * Makes the HTTP requests to the News API
 * @returns {Promise} Promise that resolves when request is complete
 */
async function fetchNewsData() {
    const url = buildApiUrl();
    const options = getRequestOptions();
    
    try {
        const result = await makeRequest(url, options);
        processAndSaveResponse([result]); // Keep array format for compatibility
    } catch (error) {
        throw new Error(`Failed to fetch news: ${error.message}`);
    }
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

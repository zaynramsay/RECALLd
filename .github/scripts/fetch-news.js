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

// Content filtering
const CONTENT_FILTER = {
    excludedTerms: [
        'sex',
        'orgasm',
        'pornographic',
        'masturbate',
        // Add other terms to exclude
    ],
    // Case-insensitive regex pattern for excluded terms
    excludePattern: null
};

// Initialize the exclude pattern
CONTENT_FILTER.excludePattern = new RegExp(
    CONTENT_FILTER.excludedTerms.join('|'), 
    'i'
);

// Search parameters
const SEARCH_PARAMS = {
    queries: [
        // Combined optimal search query within API limits
        '("food recall" OR "FDA recall" OR "USDA recall" OR "FSIS recall") OR ' +
        '(food AND (listeria OR salmonella OR "E. coli" OR "foreign material")) OR ' +
        '(food AND ("undeclared allergen" OR contamination OR mislabeling)) ' +
        // Exclude adult content sites from results
        'AND -site:adult* -site:nsfw* -site:xxx*'
    ],
    language: 'en',
    sortBy: 'publishedAt',
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
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
 */
function ensureOutputDirectory() {
    const dataDir = path.dirname(CONFIG.OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('Created data directory');
    }
}

/**
 * Constructs the API URL with content filtering
 * @returns {string} API URL
 */
function buildApiUrl() {
    const combinedQuery = SEARCH_PARAMS.queries[0];
    
    const params = new URLSearchParams({
        q: combinedQuery,
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
 * Filters out articles containing excluded terms
 * @param {Array} articles - Array of news articles
 * @returns {Array} Filtered articles
 */
function filterArticles(articles) {
    return articles.filter(article => {
        // Check title, description, and content for excluded terms
        const contentToCheck = [
            article.title,
            article.description,
            article.content
        ].filter(Boolean).join(' ').toLowerCase();
        
        return !CONTENT_FILTER.excludePattern.test(contentToCheck);
    });
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
 * Processes and saves the combined API responses with content filtering
 * @param {Array<Object>} newsResults - Array of API responses
 */
function processAndSaveResponse(newsResults) {
    const allArticles = newsResults.flatMap(news => news.articles);
    
    // Apply content filtering
    const filteredArticles = filterArticles(allArticles);
    
    // Remove duplicates
    const uniqueArticles = Array.from(new Map(
        filteredArticles.map(article => [article.url, article])
    ).values());
    
    const storage = {
        lastUpdated: new Date().toISOString(),
        articles: uniqueArticles,
        totalResults: uniqueArticles.length,
        query: SEARCH_PARAMS.query,
        filteredCount: allArticles.length - uniqueArticles.length
    };
    
    fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(storage, null, 2));
    console.log(`News data updated successfully. Found ${uniqueArticles.length} unique articles after filtering.`);
    console.log(`Filtered out ${storage.filteredCount} articles containing excluded terms.`);
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
        processAndSaveResponse([result]);
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
        console.log('Starting news fetch with content filtering...');
        await fetchNewsData();
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

// Start execution
main();
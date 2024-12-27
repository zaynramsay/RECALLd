const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.NEWS_API_KEY;
const OUTPUT_FILE = path.join(__dirname, '../../data/news.json');

// Ensure data directory exists
const dataDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const url = `https://newsapi.org/v2/top-headlines?country=us&apiKey=${API_KEY}`;

https.get(url, (resp) => {
    let data = '';
    
    resp.on('data', (chunk) => {
        data += chunk;
    });
    
    resp.on('end', () => {
        try {
            const news = JSON.parse(data);
            const timestamp = new Date().toISOString();
            
            const storage = {
                lastUpdated: timestamp,
                articles: news.articles
            };
            
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(storage, null, 2));
            console.log('News data updated successfully');
        } catch (err) {
            console.error('Error processing response:', err);
            process.exit(1);
        }
    });
}).on('error', (err) => {
    console.error('Error fetching news:', err);
    process.exit(1);
});

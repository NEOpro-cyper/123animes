const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async function handler(req, res) {
    // Set headers first
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ message: 'OK' });
    }
    
    try {
        const { episodeUrl } = req.query;
        
        if (!episodeUrl) {
            return res.status(400).json({
                success: false,
                error: 'episodeUrl parameter required'
            });
        }
        
        // Simple test - just try to fetch the page
        const response = await axios.get(episodeUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const title = $('title').text() || 'Unknown';
        
        return res.status(200).json({
            success: true,
            message: 'Basic scraping works!',
            data: {
                url: episodeUrl,
                title: title.substring(0, 100),
                status: response.status,
                iframes_found: $('iframe').length
            }
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            type: error.constructor.name
        });
    }
};

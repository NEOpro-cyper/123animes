// Simple test endpoint to verify API routing works
export default function handler(req, res) {
    // Set proper JSON headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ message: 'CORS preflight OK' });
    }
    
    // Test response
    const testData = {
        success: true,
        message: 'API endpoint is working correctly!',
        timestamp: new Date().toISOString(),
        method: req.method,
        headers: {
            'user-agent': req.headers['user-agent'] || 'unknown',
            'content-type': req.headers['content-type'] || 'unknown'
        },
        query: req.query,
        body: req.body || null,
        environment: {
            node_version: process.version,
            platform: process.platform,
            vercel: process.env.VERCEL ? 'true' : 'false'
        }
    };
    
    return res.status(200).json(testData);
}

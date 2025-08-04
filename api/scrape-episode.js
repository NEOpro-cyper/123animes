import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed. Use POST.' 
        });
    }

    const { episodeUrl } = req.body;
    
    if (!episodeUrl) {
        return res.status(400).json({ 
            success: false, 
            error: 'Episode URL is required in request body' 
        });
    }

    let browser = null;
    const startTime = Date.now();
    
    try {
        console.log(`🚀 Starting scrape for: ${episodeUrl}`);
        
        // Launch browser with Vercel-optimized settings
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--no-zygote'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: true,
            ignoreHTTPSErrors: true,
        });
        
        const page = await browser.newPage();
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Simplified request interception for Vercel
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            const url = req.url();
            
            // Block heavy resources to save memory and time
            if (['font', 'media', 'websocket', 'manifest', 'image'].includes(resourceType) ||
                url.includes('google-analytics') ||
                url.includes('googletagmanager') ||
                url.includes('ads') ||
                url.includes('doubleclick') ||
                url.includes('.mp4') ||
                url.includes('.mp3')) {
                req.abort();
            } else {
                req.continue();
            }
        });
        
        // Navigate to page with timeout
        await page.goto(episodeUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 20000
        });
        
        // Wait for content to load
        await delay(3000);
        
        // Extract anime image with optimized selectors
        const animeImage = await page.evaluate(() => {
            const imageSelectors = [
                '.anime-poster img',
                '.poster img',
                '.anime-image img',
                '.anime-cover img',
                'img[alt*="poster" i]',
                'img[alt*="cover" i]',
                'img[class*="poster" i]',
                'img[class*="cover" i]',
                '.inner img',
                '.item img'
            ];
            
            for (const selector of imageSelectors) {
                const img = document.querySelector(selector);
                if (img) {
                    let imageSrc = img.getAttribute('data-src') ||
                                 img.getAttribute('data-original') ||
                                 img.getAttribute('src') ||
                                 img.src;
                    
                    if (imageSrc && imageSrc.startsWith('http') && 
                        !imageSrc.includes('no_poster') &&
                        !imageSrc.includes('placeholder') &&
                        !imageSrc.includes('default.jpg') &&
                        imageSrc.length > 20) {
                        
                        // Make relative URLs absolute
                        if (imageSrc.startsWith('/')) {
                            imageSrc = 'https://w1.123animes.ru' + imageSrc;
                        }
                        
                        return imageSrc;
                    }
                }
            }
            return null;
        });
        
        // Find streaming link with retry logic
        let streamingLink = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!streamingLink && attempts < maxAttempts) {
            attempts++;
            console.log(`🔍 Attempt ${attempts}/${maxAttempts} to find streaming link`);
            
            streamingLink = await page.evaluate(() => {
                const blockedDomains = [
                    'dtscout.com', 'google.com', 'googletagmanager',
                    'doubleclick.net', 'ads', 'analytics', 'facebook.com'
                ];
                
                const validStreamingPatterns = [
                    'bunnycdn', 'embed', 'play', 'stream', 'video', 
                    'player', 'vidsrc', 'vidplay', 'filemoon'
                ];
                
                const isValidStreamingLink = (src) => {
                    if (!src || !src.startsWith('http') || src.length < 25) {
                        return false;
                    }
                    
                    const isBlocked = blockedDomains.some(domain => 
                        src.toLowerCase().includes(domain.toLowerCase())
                    );
                    
                    if (isBlocked) return false;
                    
                    const isValidStreaming = validStreamingPatterns.some(pattern => 
                        src.toLowerCase().includes(pattern.toLowerCase())
                    );
                    
                    return isValidStreaming;
                };
                
                // Check priority selectors first
                const prioritySelectors = [
                    'iframe[src*="bunnycdn"]',
                    'iframe[src*="embed"]',
                    'iframe[src*="play"]',
                    'iframe[src*="stream"]'
                ];
                
                for (const selector of prioritySelectors) {
                    const iframe = document.querySelector(selector);
                    if (iframe && iframe.src && isValidStreamingLink(iframe.src)) {
                        return iframe.src;
                    }
                }
                
                // Check all iframes
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    const src = iframe.src || 
                              iframe.getAttribute('src') || 
                              iframe.getAttribute('data-src');
                    
                    if (src && isValidStreamingLink(src)) {
                        return src;
                    }
                }
                
                return null;
            });
            
            // If no streaming link found, try clicking play buttons
            if (!streamingLink && attempts < maxAttempts) {
                await page.evaluate(() => {
                    const buttons = document.querySelectorAll('button, .play-btn, .load-btn, [onclick]');
                    for (const btn of buttons) {
                        const text = btn.textContent?.toLowerCase() || '';
                        if (text.includes('play') || text.includes('load') || text.includes('watch')) {
                            try {
                                btn.click();
                                console.log(`Clicked button: ${text.substring(0, 20)}`);
                                break;
                            } catch (e) {
                                // Ignore click errors
                            }
                        }
                    }
                });
                
                await delay(2000);
            }
        }
        
        if (streamingLink) {
            // Extract episode information
            const episodePatterns = [
                /episode[\/\-]?(\d+)/i,
                /ep[\/\-]?(\d+)/i,
                /\/(\d+)\/?$/,
                /\-(\d+)\/?$/
            ];
            
            let episodeNumber = 'Unknown';
            for (const pattern of episodePatterns) {
                const match = episodeUrl.match(pattern);
                if (match) {
                    episodeNumber = match[1];
                    break;
                }
            }
            
            // Extract anime title from URL
            let animeTitle = 'Unknown Anime';
            const urlParts = episodeUrl.split('/');
            const animeIndex = urlParts.findIndex(part => part === 'anime');
            
            if (animeIndex !== -1 && urlParts[animeIndex + 1]) {
                animeTitle = urlParts[animeIndex + 1]
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
            }
            
            const streamingData = {
                title: animeTitle,
                episode_number: episodeNumber,
                episode_url: episodeUrl,
                streaming_link: streamingLink,
                image: animeImage,
                source: '123animes',
                extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3)),
                timestamp: new Date().toISOString()
            };
            
            console.log(`✅ Successfully scraped: ${animeTitle} - Episode ${episodeNumber}`);
            
            return res.status(200).json({
                success: true,
                data: streamingData
            });
            
        } else {
            console.log(`❌ No streaming link found after ${maxAttempts} attempts`);
            
            // Get debug information
            const debugInfo = await page.evaluate(() => {
                const iframes = document.querySelectorAll('iframe');
                return {
                    totalIframes: iframes.length,
                    iframeSources: Array.from(iframes).map(iframe => ({
                        src: (iframe.src || '').substring(0, 60),
                        id: iframe.id || 'no-id',
                        class: iframe.className || 'no-class'
                    })),
                    pageTitle: document.title,
                    url: window.location.href
                };
            });
            
            return res.status(404).json({
                success: false,
                error: 'No valid streaming link found',
                episode_url: episodeUrl,
                debug: debugInfo,
                extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
            });
        }
        
    } catch (error) {
        console.error('❌ Scraping error:', error.message);
        
        return res.status(500).json({
            success: false,
            error: error.message,
            episode_url: episodeUrl,
            extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
        });
        
    } finally {
        // Always close browser to prevent memory leaks
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error('Error closing browser:', e.message);
            }
        }
    }
}

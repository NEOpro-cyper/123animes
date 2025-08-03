import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
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
            error: 'episodeUrl is required in request body' 
        });
    }

    let browser = null;
    const startTime = Date.now();

    try {
        console.log('🚀 Starting browser...');
        
        browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
        
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Block unnecessary resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            const url = req.url();
            
            if (['font', 'media', 'websocket', 'manifest'].includes(resourceType) ||
                url.includes('.mp4') ||
                url.includes('.mp3') ||
                url.includes('google-analytics') ||
                url.includes('googletagmanager') ||
                url.includes('facebook.com') ||
                url.includes('twitter.com') ||
                url.includes('dtscout.com') ||
                url.includes('ads') ||
                url.includes('doubleclick') ||
                url.includes('adsystem') ||
                url.includes('googlesyndication')) {
                req.abort();
            } else {
                req.continue();
            }
        });
        
        console.log(`🔍 Loading episode: ${episodeUrl}`);
        
        await page.goto(episodeUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 20000 
        });
        
        await delay(3000);
        
        // Enhanced image extraction
        const animeImage = await page.evaluate(() => {
            const imageSelectors = [
                '.anime-poster img',
                '.poster img',
                '.anime-image img',
                '.anime-cover img',
                '.show-poster img',
                '.thumbnail img',
                '.anime-info img',
                '.series-poster img',
                '.film-poster img',
                '.movie-poster img',
                'img[alt*="poster"]',
                'img[alt*="cover"]',
                'img[class*="poster"]',
                'img[class*="cover"]',
                'img[src*="poster"]',
                'img[src*="cover"]',
                '.anime-details img',
                '.anime-meta img',
                '.series-info img',
                '.inner img',
                '.item img'
            ];
            
            // Try specific selectors first
            for (const selector of imageSelectors) {
                const img = document.querySelector(selector);
                if (img) {
                    let imageSrc = img.getAttribute('data-src') ||
                                 img.getAttribute('data-original') ||
                                 img.getAttribute('data-lazy') ||
                                 img.getAttribute('src') ||
                                 img.src;
                    
                    if (imageSrc && imageSrc.startsWith('http')) {
                        if (!imageSrc.includes('no_poster.png') &&
                            !imageSrc.includes('no_poster.jpg') &&
                            !imageSrc.includes('placeholder.') &&
                            !imageSrc.includes('default.jpg') &&
                            !imageSrc.includes('no-image.') &&
                            !imageSrc.includes('loading.') &&
                            !imageSrc.includes('lazy.') &&
                            imageSrc !== 'about:blank' &&
                            imageSrc.length > 10) {
                            return imageSrc;
                        }
                    }
                }
            }
            
            // Fallback to any valid image
            const allImages = document.querySelectorAll('img');
            for (const img of allImages) {
                let imageSrc = img.getAttribute('data-src') ||
                             img.getAttribute('data-original') ||
                             img.getAttribute('data-lazy') ||
                             img.getAttribute('src') ||
                             img.src;
                
                if (imageSrc) {
                    if (imageSrc.startsWith('/')) {
                        imageSrc = 'https://w1.123animes.ru' + imageSrc;
                    }
                    
                    if (imageSrc.startsWith('http') && 
                        (imageSrc.includes('.jpg') || imageSrc.includes('.png') || imageSrc.includes('.jpeg')) &&
                        !imageSrc.includes('no_poster') &&
                        !imageSrc.includes('placeholder') &&
                        !imageSrc.includes('default.jpg') &&
                        !imageSrc.includes('logo') &&
                        !imageSrc.includes('icon') &&
                        !imageSrc.includes('banner') &&
                        !imageSrc.includes('ad') &&
                        imageSrc.length > 10 &&
                        img.width > 80 && 
                        img.height > 80) {
                        return imageSrc;
                    }
                }
            }
            
            return null;
        });
        
        let streamingLink = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!streamingLink && attempts < maxAttempts) {
            attempts++;
            console.log(`🔍 Attempt ${attempts}/${maxAttempts} to find iframe...`);
            
            streamingLink = await page.evaluate(() => {
                const blockedDomains = [
                    'dtscout.com', 'google.com', 'googletagmanager.com',
                    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
                    'adsystem.com', 'recaptcha', 'facebook.com', 'twitter.com',
                    'instagram.com', 'tiktok.com', 'ads', 'ad-', 'analytics',
                    'tracking', 'metric', 'about:blank'
                ];
                
                const validStreamingPatterns = [
                    'bunnycdn', 'embed', 'play', 'stream', 'video', 'player',
                    'vidsrc', 'vidplay', 'filemoon', 'doodstream', 'streamtape',
                    'mp4upload', 'mixdrop', 'upstream', 'streamwish', 'vid', 'watch'
                ];
                
                const isValidStreamingLink = (src) => {
                    if (!src || src === 'about:blank' || !src.startsWith('http') || src.length < 25) {
                        return false;
                    }
                    
                    const isBlocked = blockedDomains.some(domain => 
                        src.toLowerCase().includes(domain.toLowerCase())
                    );
                    
                    if (isBlocked) return false;
                    
                    return validStreamingPatterns.some(pattern => 
                        src.toLowerCase().includes(pattern.toLowerCase())
                    );
                };
                
                const iframes = document.querySelectorAll('iframe');
                
                for (const iframe of iframes) {
                    const src = iframe.src || 
                              iframe.getAttribute('src') || 
                              iframe.getAttribute('data-src') ||
                              iframe.getAttribute('data-lazy');
                    
                    if (src && isValidStreamingLink(src)) {
                        return src;
                    }
                }
                
                return null;
            });
            
            if (!streamingLink && attempts < maxAttempts) {
                await page.evaluate(() => {
                    const buttons = document.querySelectorAll('button, .play-btn, .load-btn, [onclick], .btn');
                    for (const btn of buttons) {
                        const text = btn.textContent?.toLowerCase() || '';
                        if (text.includes('play') || text.includes('load') || text.includes('watch')) {
                            try {
                                btn.click();
                                break;
                            } catch (e) {
                                // Ignore click errors
                            }
                        }
                    }
                });
                
                await delay(2000 + (attempts * 1000));
            }
        }
        
        if (streamingLink) {
            // Extract episode info
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
                range_id: 'single-episode',
                strategy: 'single-episode',
                source: '123animes'
            };
            
            return res.status(200).json({
                success: true,
                data: streamingData,
                extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
            });
            
        } else {
            return res.status(404).json({
                success: false,
                error: 'No valid streaming iframe found after multiple attempts',
                episode_url: episodeUrl,
                extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
            });
        }
        
    } catch (error) {
        console.error('❌ Error scraping episode:', error);
        return res.status(500).json({
            success: false,
            error: `Server error: ${error.message}`,
            episode_url: episodeUrl || 'unknown',
            extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
        });
        
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error('Error closing browser:', e);
            }
        }
    }
}

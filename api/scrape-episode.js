const axios = require('axios');
const cheerio = require('cheerio');

// Enhanced user agents rotation for better success rate
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// Enhanced axios instance with better configurations
const createAxiosInstance = () => {
    return axios.create({
        timeout: 25000, // 25 second timeout for Vercel's 30s limit
        headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
        },
        validateStatus: (status) => status < 500, // Accept 4xx but not 5xx
        maxRedirects: 5,
        decompress: true
    });
};

// Enhanced image extraction function (converted from Puppeteer logic)
const extractAnimeImage = ($) => {
    console.log('🖼️ Starting enhanced image extraction...');
    
    // Enhanced image selectors based on original Puppeteer logic
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
    
    // Strategy 1: Try specific selectors first
    for (const selector of imageSelectors) {
        const img = $(selector).first();
        if (img.length) {
            console.log(`Found img element with selector: ${selector}`);
            
            // Extract image source using multiple attributes
            let imageSrc = img.attr('data-src') ||
                         img.attr('data-original') ||
                         img.attr('data-lazy') ||
                         img.attr('src');
            
            console.log(`Extracted image source: ${imageSrc}`);
            
            if (imageSrc && imageSrc.startsWith('http')) {
                // Check if it's not a placeholder/no_poster image
                if (!imageSrc.includes('no_poster.png') &&
                    !imageSrc.includes('no_poster.jpg') &&
                    !imageSrc.includes('placeholder.') &&
                    !imageSrc.includes('default.jpg') &&
                    !imageSrc.includes('no-image.') &&
                    !imageSrc.includes('loading.') &&
                    !imageSrc.includes('lazy.') &&
                    imageSrc !== 'about:blank' &&
                    imageSrc.length > 10) {
                    
                    console.log(`✅ Found valid anime image: ${imageSrc}`);
                    return imageSrc;
                } else {
                    console.log(`❌ Filtered placeholder image: ${imageSrc}`);
                }
            }
        }
    }
    
    // Strategy 2: Look for all images and find the best one
    console.log('🔍 Strategy 2: Scanning all images...');
    const allImages = $('img');
    console.log(`Found ${allImages.length} total images`);
    
    allImages.each((i, img) => {
        const $img = $(img);
        
        // Extract image source using multiple attributes
        let imageSrc = $img.attr('data-src') ||
                     $img.attr('data-original') ||
                     $img.attr('data-lazy') ||
                     $img.attr('src');
        
        if (imageSrc) {
            console.log(`Checking image: ${imageSrc.substring(0, 80)}...`);
            
            // Make relative URLs absolute
            if (imageSrc.startsWith('/')) {
                imageSrc = 'https://w1.123animes.ru' + imageSrc;
            }
            
            // Check if it's a valid anime poster
            if (imageSrc.startsWith('http') && 
                (imageSrc.includes('/poster/') || 
                 imageSrc.includes('.jpg') || 
                 imageSrc.includes('.png') ||
                 imageSrc.includes('.jpeg')) &&
                !imageSrc.includes('no_poster.png') &&
                !imageSrc.includes('no_poster.jpg') &&
                !imageSrc.includes('placeholder.') &&
                !imageSrc.includes('default.jpg') &&
                !imageSrc.includes('no-image.') &&
                !imageSrc.includes('loading.') &&
                !imageSrc.includes('lazy.') &&
                !imageSrc.includes('logo') &&
                !imageSrc.includes('icon') &&
                !imageSrc.includes('banner') &&
                !imageSrc.includes('ad') &&
                imageSrc !== 'about:blank' &&
                imageSrc.length > 10) {
                
                console.log(`✅ Found valid fallback image: ${imageSrc}`);
                return imageSrc;
            }
        }
    });
    
    // Strategy 3: Look for background images in style attributes
    console.log('🔍 Strategy 3: Scanning background images...');
    const elementsWithStyle = $('[style*="background-image"], [style*="background"]');
    
    elementsWithStyle.each((i, element) => {
        const style = $(element).attr('style') || '';
        
        if (style.includes('url(')) {
            const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (match) {
                let imageSrc = match[1];
                console.log(`Found background image: ${imageSrc}`);
                
                // Make relative URLs absolute
                if (imageSrc.startsWith('/')) {
                    imageSrc = 'https://w1.123animes.ru' + imageSrc;
                }
                
                // Check if it's a valid anime poster
                if (imageSrc.startsWith('http') && 
                    !imageSrc.includes('no_poster.png') &&
                    !imageSrc.includes('no_poster.jpg') &&
                    !imageSrc.includes('placeholder.') &&
                    !imageSrc.includes('default.jpg') &&
                    !imageSrc.includes('no-image.') &&
                    !imageSrc.includes('loading.') &&
                    !imageSrc.includes('lazy.') &&
                    !imageSrc.includes('logo') &&
                    !imageSrc.includes('icon') &&
                    !imageSrc.includes('banner') &&
                    !imageSrc.includes('ad') &&
                    imageSrc !== 'about:blank' &&
                    imageSrc.length > 10) {
                    
                    console.log(`✅ Found valid background image: ${imageSrc}`);
                    return imageSrc;
                }
            }
        }
    });
    
    // Strategy 4: Look for data attributes
    console.log('🔍 Strategy 4: Scanning data attributes...');
    const elementsWithData = $('[data-src], [data-image], [data-poster], [data-thumb]');
    
    elementsWithData.each((i, element) => {
        const $element = $(element);
        const dataAttrs = ['data-src', 'data-image', 'data-poster', 'data-thumb'];
        
        for (const attr of dataAttrs) {
            let imageSrc = $element.attr(attr);
            if (imageSrc && (imageSrc.includes('.jpg') || imageSrc.includes('.png') || imageSrc.includes('.jpeg'))) {
                console.log(`Found data attribute image: ${imageSrc}`);
                
                // Make relative URLs absolute
                if (imageSrc.startsWith('/')) {
                    imageSrc = 'https://w1.123animes.ru' + imageSrc;
                }
                
                // Check if it's a valid anime poster
                if (imageSrc.startsWith('http') && 
                    !imageSrc.includes('no_poster.png') &&
                    !imageSrc.includes('no_poster.jpg') &&
                    !imageSrc.includes('placeholder.') &&
                    !imageSrc.includes('default.jpg') &&
                    !imageSrc.includes('no-image.') &&
                    !imageSrc.includes('loading.') &&
                    !imageSrc.includes('lazy.') &&
                    !imageSrc.includes('logo') &&
                    !imageSrc.includes('icon') &&
                    !imageSrc.includes('banner') &&
                    !imageSrc.includes('ad') &&
                    imageSrc !== 'about:blank' &&
                    imageSrc.length > 10) {
                    
                    console.log(`✅ Found valid data attribute image: ${imageSrc}`);
                    return imageSrc;
                }
            }
        }
    });
    
    console.log('❌ No valid anime image found with any strategy');
    return null;
};

// Enhanced iframe extraction function
const extractStreamingLink = ($) => {
    console.log('🔍 Starting streaming link extraction...');
    
    const blockedDomains = [
        'dtscout.com',
        'google.com',
        'googletagmanager.com',
        'doubleclick.net',
        'googlesyndication.com',
        'googleadservices.com',
        'adsystem.com',
        'recaptcha',
        'facebook.com',
        'twitter.com',
        'instagram.com',
        'tiktok.com',
        'ads',
        'ad-',
        'analytics',
        'tracking',
        'metric',
        'about:blank'
    ];
    
    const validStreamingPatterns = [
        'bunnycdn',
        'embed',
        'play',
        'stream',
        'video',
        'player',
        'vidsrc',
        'vidplay',
        'filemoon',
        'doodstream',
        'streamtape',
        'mp4upload',
        'mixdrop',
        'upstream',
        'streamwish',
        'vid',
        'watch'
    ];
    
    const isValidStreamingLink = (src) => {
        if (!src || src === 'about:blank' || !src.startsWith('http') || src.length < 25) {
            return false;
        }
        
        const isBlocked = blockedDomains.some(domain => 
            src.toLowerCase().includes(domain.toLowerCase())
        );
        
        if (isBlocked) {
            return false;
        }
        
        const isValidStreaming = validStreamingPatterns.some(pattern => 
            src.toLowerCase().includes(pattern.toLowerCase())
        );
        
        return isValidStreaming;
    };
    
    // Priority selectors for iframes
    const prioritySelectors = [
        '#iframe_ext82377 iframe',
        'iframe[src*="bunnycdn"]',
        'iframe[src*="embed"]',
        'iframe[src*="play"]',
        'iframe[src*="stream"]',
        'iframe[src*="video"]',
        'iframe[src*="player"]',
        'iframe[src*="vid"]'
    ];
    
    // Try priority selectors first
    for (const selector of prioritySelectors) {
        const iframe = $(selector).first();
        if (iframe.length) {
            const src = iframe.attr('src');
            if (src && isValidStreamingLink(src)) {
                console.log(`✅ Found valid iframe with priority selector: ${selector}`);
                return src;
            }
        }
    }
    
    // Scan all iframes
    const iframes = $('iframe');
    console.log(`Scanning ${iframes.length} total iframes`);
    
    let validLink = null;
    iframes.each((i, iframe) => {
        const $iframe = $(iframe);
        const src = $iframe.attr('src') || 
                   $iframe.attr('data-src') ||
                   $iframe.attr('data-lazy') ||
                   $iframe.attr('data-original');
        
        if (src) {
            console.log(`Checking iframe: ${src.substring(0, 60)}...`);
            
            if (isValidStreamingLink(src)) {
                console.log(`✅ Valid streaming iframe found: ${src.substring(0, 60)}...`);
                validLink = src;
                return false; // Break the loop
            } else {
                console.log(`❌ Blocked/invalid iframe: ${src.substring(0, 60)}...`);
            }
        }
    });
    
    return validLink;
};

// Main scraping function
module.exports = async function handler(req, res) {
    // Set proper headers for all responses
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ message: 'CORS preflight' });
    }
    
    // Only allow GET and POST methods
    if (!['GET', 'POST'].includes(req.method)) {
        return res.status(405).json({
            success: false,
            error: `Method ${req.method} not allowed. Use GET or POST.`
        });
    }
    
    const startTime = Date.now();
    
    try {
        // Get episodeUrl from query params or body
        const { episodeUrl } = req.method === 'GET' ? req.query : req.body;
        
        // Validate input
        if (!episodeUrl) {
            return res.status(400).json({
                success: false,
                error: 'episodeUrl parameter is required',
                example: '/api/scrape-episode?episodeUrl=https://w1.123animes.ru/anime/naruto/episode-1'
            });
        }
        
        // Validate URL format
        if (!episodeUrl.startsWith('http')) {
            return res.status(400).json({
                success: false,
                error: 'episodeUrl must be a valid HTTP/HTTPS URL',
                provided: episodeUrl
            });
        }
        
        console.log(`🔍 Starting to scrape episode: ${episodeUrl}`);
        
        const axiosInstance = createAxiosInstance();
        
        // Fetch the HTML content with enhanced error handling
        let response;
        try {
            response = await axiosInstance.get(episodeUrl);
        } catch (axiosError) {
            console.error('Axios request failed:', axiosError.message);
            return res.status(500).json({
                success: false,
                error: `Failed to fetch episode page: ${axiosError.message}`,
                episode_url: episodeUrl,
                status_code: axiosError.response?.status || 'unknown',
                extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
            });
        }
        
        if (response.status !== 200) {
            return res.status(500).json({
                success: false,
                error: `HTTP ${response.status}: ${response.statusText}`,
                episode_url: episodeUrl,
                extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
            });
        }
        
        const $ = cheerio.load(response.data);
        
        // Extract anime image using enhanced logic
        const animeImage = extractAnimeImage($);
        
        // Extract streaming link
        const streamingLink = extractStreamingLink($);
        
        if (streamingLink) {
            console.log(`✅ Found valid streaming link: ${streamingLink.substring(0, 60)}...`);
            
            if (animeImage) {
                console.log(`🖼️ Found anime poster image: ${animeImage.substring(0, 60)}...`);
            } else {
                console.log(`❌ No anime poster image found`);
            }
            
            // Extract episode number from URL
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
            console.log(`❌ No valid streaming link found for episode`);
            
            // Debug information
            const debugInfo = {
                totalIframes: $('iframe').length,
                iframeSources: [],
                pageTitle: $('title').text(),
                hasPlayButtons: $('button, .play-btn, .load-btn').length
            };
            
            $('iframe').each((i, iframe) => {
                const $iframe = $(iframe);
                const src = $iframe.attr('src') || 
                           $iframe.attr('data-src') ||
                           $iframe.attr('data-lazy');
                if (src) {
                    debugInfo.iframeSources.push({
                        src: src.substring(0, 100),
                        id: $iframe.attr('id') || 'no-id',
                        class: $iframe.attr('class') || 'no-class'
                    });
                }
            });
            
            console.log(`Debug info:`, debugInfo);
            
            return res.status(200).json({
                success: false,
                error: 'No valid streaming iframe found',
                episode_url: episodeUrl,
                debug: debugInfo,
                extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
            });
        }
        
    } catch (error) {
        console.error('❌ Scraping error:', error);
        
        // Ensure we always return JSON
        return res.status(500).json({
            success: false,
            error: error.message || 'Unknown error occurred',
            episode_url: req.query.episodeUrl || req.body?.episodeUrl || 'unknown',
            extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3)),
            debug: {
                error_type: error.constructor.name,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        });
    }
}

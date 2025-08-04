import axios from 'axios';
import * as cheerio from 'cheerio';

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

    const { animeName, episodeNumber } = req.body;
    
    if (!animeName || !episodeNumber) {
        return res.status(400).json({ 
            success: false, 
            error: 'Both anime name and episode number are required' 
        });
    }

    const startTime = Date.now();
    
    try {
        console.log(`🚀 Starting scrape for: ${animeName} - Episode ${episodeNumber}`);
        
        // Convert anime name to URL slug format
        const animeSlug = animeName
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-')     // Replace spaces with hyphens
            .replace(/-+/g, '-')      // Replace multiple hyphens with single
            .trim();

        // Construct episode URL
        const episodeUrl = `https://w1.123animes.ru/anime/${animeSlug}/episode-${episodeNumber}`;
        console.log(`📍 Constructed URL: ${episodeUrl}`);
        
        // Configure axios with realistic browser headers
        const axiosConfig = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Referer': 'https://w1.123animes.ru/',
                'Cache-Control': 'max-age=0'
            },
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: (status) => status < 500 // Allow 404s to handle gracefully
        };

        // Fetch the episode page
        console.log('📥 Fetching episode page...');
        const response = await axios.get(episodeUrl, axiosConfig);
        
        if (response.status === 404) {
            return res.status(404).json({
                success: false,
                error: 'Episode not found. Please check the anime name and episode number.',
                constructed_url: episodeUrl,
                suggestions: [
                    'Try using the exact anime title as it appears on the website',
                    'Check if the episode number exists',
                    'Try removing special characters from anime name'
                ]
            });
        }

        const $ = cheerio.load(response.data);
        console.log(`✅ Page loaded successfully (${response.data.length} chars)`);

        // Extract anime image
        const extractAnimeImage = () => {
            console.log('🖼️ Extracting anime image...');
            
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
                'img[alt*="poster" i]',
                'img[alt*="cover" i]',
                'img[class*="poster" i]',
                'img[class*="cover" i]',
                '.inner img',
                '.item img',
                '.detail img'
            ];
            
            for (const selector of imageSelectors) {
                const img = $(selector).first();
                if (img.length) {
                    let imageSrc = img.attr('data-src') ||
                                 img.attr('data-original') ||
                                 img.attr('data-lazy') ||
                                 img.attr('src');
                    
                    if (imageSrc) {
                        // Make relative URLs absolute
                        if (imageSrc.startsWith('/')) {
                            imageSrc = new URL(imageSrc, episodeUrl).href;
                        }
                        
                        // Validate image URL
                        if (imageSrc.startsWith('http') && 
                            !imageSrc.includes('no_poster') &&
                            !imageSrc.includes('placeholder') &&
                            !imageSrc.includes('default.jpg') &&
                            !imageSrc.includes('no-image') &&
                            imageSrc.length > 20) {
                            
                            console.log(`✅ Valid image found: ${imageSrc.substring(0, 60)}...`);
                            return imageSrc;
                        }
                    }
                }
            }
            
            console.log('❌ No valid anime image found');
            return null;
        };

        // Extract streaming links (embed links)
        const extractStreamingLinks = () => {
            console.log('🎥 Extracting streaming links...');
            
            const streamingLinks = [];
            
            // Define patterns for valid streaming domains
            const validStreamingPatterns = [
                'bunnycdn', 'embed', 'play', 'stream', 'video', 'player',
                'vidsrc', 'vidplay', 'filemoon', 'doodstream', 'streamtape',
                'mp4upload', 'mixdrop', 'upstream', 'streamwish', 'vidhide'
            ];
            
            // Define blocked domains
            const blockedDomains = [
                'dtscout.com', 'google.com', 'googletagmanager',
                'doubleclick.net', 'googlesyndication', 'ads', 'analytics',
                'facebook.com', 'twitter.com', 'recaptcha'
            ];
            
            const isValidStreamingLink = (src) => {
                if (!src || !src.startsWith('http') || src.length < 25) {
                    return false;
                }
                
                const srcLower = src.toLowerCase();
                
                // Check if blocked
                const isBlocked = blockedDomains.some(domain => 
                    srcLower.includes(domain.toLowerCase())
                );
                
                if (isBlocked) return false;
                
                // Check if valid streaming domain
                const isValidStreaming = validStreamingPatterns.some(pattern => 
                    srcLower.includes(pattern.toLowerCase())
                );
                
                return isValidStreaming;
            };
            
            // Extract from iframes
            $('iframe').each((i, iframe) => {
                const src = $(iframe).attr('src') || 
                           $(iframe).attr('data-src') ||
                           $(iframe).attr('data-lazy');
                
                if (src && isValidStreamingLink(src)) {
                    const serverName = extractServerName(src);
                    streamingLinks.push({
                        url: src,
                        server: serverName,
                        type: 'iframe',
                        quality: 'Unknown'
                    });
                    console.log(`✅ Found iframe link: ${serverName} - ${src.substring(0, 60)}...`);
                }
            });
            
            // Also check for direct links in buttons or links
            $('a[href], button[data-url], [onclick]').each((i, element) => {
                const href = $(element).attr('href') || 
                            $(element).attr('data-url') ||
                            $(element).attr('data-src');
                
                if (href && isValidStreamingLink(href)) {
                    const serverName = extractServerName(href);
                    streamingLinks.push({
                        url: href,
                        server: serverName,
                        type: 'link',
                        quality: 'Unknown'
                    });
                    console.log(`✅ Found direct link: ${serverName} - ${href.substring(0, 60)}...`);
                }
            });
            
            // Remove duplicates
            const uniqueLinks = streamingLinks.filter((link, index, self) => 
                index === self.findIndex(l => l.url === link.url)
            );
            
            console.log(`📊 Found ${uniqueLinks.length} unique streaming links`);
            return uniqueLinks;
        };

        // Helper function to extract server name from URL
        const extractServerName = (url) => {
            try {
                const hostname = new URL(url).hostname;
                
                // Map common domains to readable names
                const serverMap = {
                    'bunnycdn': 'BunnyCDN',
                    'filemoon': 'FileMoon', 
                    'doodstream': 'DoodStream',
                    'streamtape': 'StreamTape',
                    'mp4upload': 'MP4Upload',
                    'mixdrop': 'MixDrop',
                    'vidsrc': 'VidSrc',
                    'vidplay': 'VidPlay',
                    'upstream': 'UpStream'
                };
                
                for (const [key, name] of Object.entries(serverMap)) {
                    if (hostname.includes(key)) {
                        return name;
                    }
                }
                
                // If no match, return cleaned hostname
                return hostname.replace('www.', '').split('.')[0];
            } catch (e) {
                return 'Unknown Server';
            }
        };

        // Extract anime title from page
        const extractAnimeTitle = () => {
            const titleSelectors = [
                'h1', '.anime-title', '.series-title', '.show-title',
                '.episode-title', 'title', '.main-title'
            ];
            
            for (const selector of titleSelectors) {
                const title = $(selector).first().text().trim();
                if (title && title.length > 2) {
                    // Clean up title
                    return title
                        .replace(/episode\s*\d+/i, '')
                        .replace(/ep\s*\d+/i, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                }
            }
            
            // Fallback to anime name from input
            return animeName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        };

        // Perform extractions
        const animeImage = extractAnimeImage();
        const streamingLinks = extractStreamingLinks();
        const animeTitle = extractAnimeTitle();

        if (streamingLinks.length > 0) {
            const responseData = {
                title: animeTitle,
                episode_number: episodeNumber,
                episode_url: episodeUrl,
                anime_slug: animeSlug,
                embed_links: streamingLinks,
                image: animeImage,
                total_links: streamingLinks.length,
                source: '123animes',
                extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3)),
                timestamp: new Date().toISOString()
            };
            
            console.log(`✅ Successfully extracted ${streamingLinks.length} streaming links`);
            
            return res.status(200).json({
                success: true,
                data: responseData
            });
            
        } else {
            console.log('❌ No streaming links found');
            
            // Debug information
            const debugInfo = {
                totalIframes: $('iframe').length,
                pageTitle: $('title').text() || 'No title',
                hasVideoElements: $('video').length > 0,
                hasEmbedElements: $('embed').length > 0,
                foundAnyLinks: $('a[href*="http"]').length
            };
            
            return res.status(404).json({
                success: false,
                error: 'No streaming links found on this episode page',
                anime_name: animeName,
                episode_number: episodeNumber,
                constructed_url: episodeUrl,
                debug: debugInfo,
                suggestions: [
                    'Check if the episode is available on the website',
                    'Try a different episode number',
                    'Verify the anime name is correct'
                ],
                extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
            });
        }
        
    } catch (error) {
        console.error('❌ Scraping error:', error.message);
        
        // Handle specific error types
        let errorMessage = error.message;
        let statusCode = 500;
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorMessage = 'Unable to connect to the anime website. Please try again later.';
            statusCode = 503;
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage = 'Request timed out. The website might be slow or unavailable.';
            statusCode = 408;
        } else if (error.response?.status === 404) {
            errorMessage = 'Episode not found. Please check the anime name and episode number.';
            statusCode = 404;
        }
        
        return res.status(statusCode).json({
            success: false,
            error: errorMessage,
            anime_name: animeName,
            episode_number: episodeNumber,
            extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
        });
    }
}

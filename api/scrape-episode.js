// api/scrape-episode.js
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
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

    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
    });
    
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
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
        
        const startTime = Date.now();
        
        await page.goto(episodeUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 15000 
        });
        
        await delay(3000);
        
        // Enhanced image extraction
        console.log('🖼️ Waiting for images to load...');
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const images = document.querySelectorAll('img');
                let loadedCount = 0;
                const totalImages = images.length;

                console.log(`Found ${totalImages} images to load`);

                if (totalImages === 0) {
                    resolve();
                    return;
                }

                const checkComplete = () => {
                    loadedCount++;
                    if (loadedCount >= totalImages) {
                        resolve();
                    }
                };

                images.forEach(img => {
                    if (img.complete && img.naturalWidth > 0) {
                        checkComplete();
                    } else {
                        img.addEventListener('load', checkComplete);
                        img.addEventListener('error', checkComplete);
                    }
                });

                setTimeout(() => {
                    console.log(`Image loading timeout reached, continuing with ${loadedCount}/${totalImages} loaded`);
                    resolve();
                }, 3000);
            });
        });

        const animeImage = await page.evaluate(() => {
            const findAnimeImage = () => {
                console.log('🔍 Starting enhanced image extraction...');
                
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
                    const img = document.querySelector(selector);
                    if (img) {
                        console.log(`Found img element with selector: ${selector}`);
                        
                        let imageSrc = img.getAttribute('data-src') ||
                                     img.getAttribute('data-original') ||
                                     img.getAttribute('data-lazy') ||
                                     img.getAttribute('src') ||
                                     img.src;
                        
                        console.log(`Extracted image source: ${imageSrc}`);
                        
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
                const allImages = document.querySelectorAll('img');
                console.log(`Found ${allImages.length} total images`);
                
                for (const img of allImages) {
                    let imageSrc = img.getAttribute('data-src') ||
                                 img.getAttribute('data-original') ||
                                 img.getAttribute('data-lazy') ||
                                 img.getAttribute('src') ||
                                 img.src;
                    
                    if (imageSrc) {
                        console.log(`Checking image: ${imageSrc.substring(0, 80)}...`);
                        
                        if (imageSrc.startsWith('/')) {
                            imageSrc = 'https://w1.123animes.ru' + imageSrc;
                        }
                        
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
                            imageSrc.length > 10 &&
                            img.width > 80 && 
                            img.height > 80) {
                            
                            console.log(`✅ Found valid fallback image: ${imageSrc}`);
                            return imageSrc;
                        }
                    }
                }
                
                console.log('❌ No valid anime image found with any strategy');
                return null;
            };
            
            return findAnimeImage();
        });
        
        let streamingLink = null;
        let attempts = 0;
        const maxAttempts = 4; 
        
        while (!streamingLink && attempts < maxAttempts) {
            attempts++;
            console.log(`🔍 Attempt ${attempts}/${maxAttempts} to find iframe...`);
            
            streamingLink = await page.evaluate(() => {
                const findValidIframeSource = () => {
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
                    
                    for (const selector of prioritySelectors) {
                        const iframe = document.querySelector(selector);
                        if (iframe && iframe.src && isValidStreamingLink(iframe.src)) {
                            console.log(`Found valid iframe with priority selector: ${selector}`);
                            return iframe.src;
                        }
                    }
                    
                    const iframes = document.querySelectorAll('iframe');
                    console.log(`Scanning ${iframes.length} total iframes`);
                    
                    for (const iframe of iframes) {
                        const src = iframe.src || 
                                  iframe.getAttribute('src') || 
                                  iframe.getAttribute('data-src') ||
                                  iframe.getAttribute('data-lazy') ||
                                  iframe.getAttribute('data-original');
                        
                        if (src) {
                            console.log(`Checking iframe: ${src.substring(0, 60)}...`);
                            
                            if (isValidStreamingLink(src)) {
                                console.log(`✅ Valid streaming iframe found: ${src.substring(0, 60)}...`);
                                return src;
                            } else {
                                console.log(`❌ Blocked/invalid iframe: ${src.substring(0, 60)}...`);
                            }
                        }
                    }
                    
                    return null;
                };
                
                return findValidIframeSource();
            });
            
            if (!streamingLink && attempts < maxAttempts) {
                await page.evaluate(() => {
                    const buttons = document.querySelectorAll('button, .play-btn, .load-btn, [onclick], .btn');
                    for (const btn of buttons) {
                        const text = btn.textContent?.toLowerCase() || '';
                        if (text.includes('play') || text.includes('load') || text.includes('watch')) {
                            try {
                                btn.click();
                                console.log(`Clicked button: ${text.substring(0, 20)}`);
                                break;
                            } catch (e) {
                            }
                        }
                    }
                });
                
                await delay(3000 + (attempts * 1000));
            }
        }
        
        if (streamingLink) {
            console.log(`✅ Found valid streaming link: ${streamingLink.substring(0, 60)}...`);
            
            if (animeImage) {
                console.log(`🖼️ Found anime poster image: ${animeImage.substring(0, 60)}...`);
            } else {
                console.log(`❌ No anime poster image found`);
            }
            
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
            console.log(`❌ No valid streaming link found for episode after ${maxAttempts} attempts`);
            
            const debugInfo = await page.evaluate(() => {
                const iframes = document.querySelectorAll('iframe');
                const found = [];
                
                for (const iframe of iframes) {
                    const src = iframe.src || 
                              iframe.getAttribute('src') || 
                              iframe.getAttribute('data-src') ||
                              iframe.getAttribute('data-lazy');
                    if (src) {
                        found.push({
                            src: src.substring(0, 100),
                            id: iframe.id || 'no-id',
                            class: iframe.className || 'no-class'
                        });
                    }
                }
                
                return {
                    totalIframes: iframes.length,
                    iframeSources: found,
                    pageTitle: document.title,
                    hasPlayButtons: document.querySelectorAll('button, .play-btn, .load-btn').length
                };
            });
            
            console.log(`Debug info:`, debugInfo);
            
            return res.status(404).json({
                success: false,
                error: 'No valid streaming iframe found after multiple attempts',
                episode_url: episodeUrl,
                debug: debugInfo,
                extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
            });
        }
        
    } catch (error) {
        console.error('❌ Error scraping single episode:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
            episode_url: episodeUrl,
            extraction_time_seconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(3))
        });
    } finally {
        await browser.close();
    }
}

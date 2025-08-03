# Anime Scraper API - Vercel Deployment

## 📁 Project Structure
```
anime-scraper-api/
├── api/
│   └── scrape-episode.js    # Main API endpoint
├── package.json             # Dependencies
├── vercel.json             # Vercel configuration
└── README.md               # This file
```

## 🚀 Deployment Steps

### 1. Create Project Structure
Create a new folder and add the files:
- `api/scrape-episode.js` (the main API code)
- `package.json` (dependencies)
- `vercel.json` (Vercel config)

### 2. Install Vercel CLI
```bash
npm i -g vercel
```

### 3. Deploy to Vercel
```bash
# Navigate to your project folder
cd anime-scraper-api

# Login to Vercel (first time only)
vercel login

# Deploy
vercel --prod
```

### 4. Alternative: Deploy via GitHub
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Deploy automatically

## 🔌 API Endpoints

### POST `/api/scrape-episode`

**Description:** Scrapes anime episode data including streaming links and poster images.

**Request:**
```bash
curl -X POST https://your-domain.vercel.app/api/scrape-episode \
  -H "Content-Type: application/json" \
  -d '{
    "episodeUrl": "https://w1.123animes.ru/anime/attack-on-titan/episode-1"
  }'
```

**Request Body:**
```json
{
  "episodeUrl": "https://w1.123animes.ru/anime/your-anime/episode-1"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "title": "Attack On Titan",
    "episode_number": "1",
    "episode_url": "https://w1.123animes.ru/anime/attack-on-titan/episode-1",
    "streaming_link": "https://example-stream.com/embed/xyz123",
    "image": "https://example.com/poster.jpg",
    "range_id": "single-episode",
    "strategy": "single-episode",
    "source": "123animes"
  },
  "extraction_time_seconds": 5.234
}
```

**Error Response (404/500):**
```json
{
  "success": false,
  "error": "No valid streaming iframe found after multiple attempts",
  "episode_url": "https://w1.123animes.ru/anime/example/episode-1",
  "debug": {
    "totalIframes": 3,
    "iframeSources": [],
    "pageTitle": "Episode Title",
    "hasPlayButtons": 2
  },
  "extraction_time_seconds": 8.123
}
```

## 📝 Usage Examples

### JavaScript/Node.js
```javascript
const response = await fetch('https://your-domain.vercel.app/api/scrape-episode', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    episodeUrl: 'https://w1.123animes.ru/anime/naruto/episode-1'
  })
});

const data = await response.json();
console.log(data);
```

### Python
```python
import requests

url = "https://your-domain.vercel.app/api/scrape-episode"
payload = {
    "episodeUrl": "https://w1.123animes.ru/anime/naruto/episode-1"
}

response = requests.post(url, json=payload)
data = response.json()
print(data)
```

### cURL
```bash
curl -X POST https://your-domain.vercel.app/api/scrape-episode \
  -H "Content-Type: application/json" \
  -d '{
    "episodeUrl": "https://w1.123animes.ru/anime/naruto/episode-1"
  }'
```

## ⚠️ Important Notes

1. **Rate Limiting:** Vercel has execution time limits (30 seconds max)
2. **Cold Starts:** First request might be slower due to serverless cold starts
3. **No Database:** This version doesn't save data - returns response directly
4. **Error Handling:** Check the `success` field in responses
5. **CORS:** Add CORS headers if calling from browser applications

## 🔧 Environment Variables (Optional)

If you need to configure anything, add to Vercel dashboard:
- No special environment variables required for basic functionality

## 📊 Response Times

- **Typical:** 3-8 seconds per episode
- **Cold Start:** +2-3 seconds additional
- **Complex Pages:** Up to 15 seconds

## 🚨 Troubleshooting

1. **Deployment fails:** Check that all files are in correct structure
2. **API timeout:** Increase maxDuration in vercel.json (max 30s on free plan)
3. **No streaming link found:** Check if the episode URL is valid and accessible
4. **Rate limits:** Vercel free plan has usage limits

## 🎯 Features

- ✅ Extracts streaming links from anime episodes
- ✅ Finds poster/cover images
- ✅ Handles multiple iframe sources
- ✅ Blocks ads and unwanted content
- ✅ Retry mechanism for finding streaming links
- ✅ Detailed error reporting and debug info
- ✅ Fast serverless deployment

Your API will be available at: `https://your-project-name.vercel.app/api/scrape-episode`

/**
 * Fetch positive news from RSS feeds and NewsAPI
 * Target: ~100 raw articles for curation
 * Outputs to data/raw-articles.json
 */

import 'dotenv/config';
import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

// Load previously published articles to avoid duplicates
function loadPublishedArticles() {
  const archivePath = path.join(DATA_DIR, 'article-archive.json');
  const publishedTitles = new Set();
  const publishedUrls = new Set();

  if (fs.existsSync(archivePath)) {
    try {
      const archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
      for (const article of archive.articles || []) {
        // Normalize and store titles for comparison
        if (article.headline) {
          publishedTitles.add(normalizeTitle(article.headline));
        }
        // Also track source URLs
        if (article.sourceUrl) {
          publishedUrls.add(article.sourceUrl);
        }
      }
      console.log(`Loaded ${publishedTitles.size} previously published articles for deduplication\n`);
    } catch (e) {
      console.log('Could not load article archive, skipping deduplication');
    }
  }

  return { publishedTitles, publishedUrls };
}

// Normalize a title for comparison (lowercase, remove punctuation, collapse spaces)
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80); // Compare first 80 chars to catch slight variations
}

// Check if an article was previously published
function wasPublished(article, publishedTitles, publishedUrls) {
  // Check by URL first (most reliable)
  if (article.link && publishedUrls.has(article.link)) {
    return true;
  }

  // Check by normalized title
  const normalizedTitle = normalizeTitle(article.title);
  if (publishedTitles.has(normalizedTitle)) {
    return true;
  }

  // Check for partial title match (catches rephrased headlines)
  // If 70% of words match, consider it a duplicate
  const titleWords = normalizedTitle.split(' ').filter(w => w.length > 3);
  for (const pubTitle of publishedTitles) {
    const pubWords = pubTitle.split(' ').filter(w => w.length > 3);
    if (titleWords.length >= 4 && pubWords.length >= 4) {
      const matchingWords = titleWords.filter(w => pubWords.includes(w));
      const matchRatio = matchingWords.length / Math.min(titleWords.length, pubWords.length);
      if (matchRatio >= 0.7) {
        return true;
      }
    }
  }

  return false;
}

// Positive news RSS feeds - expanded for better coverage
const RSS_FEEDS = [
  // Dedicated positive news sources (high trust)
  { url: 'https://www.positive.news/feed/', source: 'Positive News', category: 'general' },
  { url: 'https://www.goodnewsnetwork.org/feed/', source: 'Good News Network', category: 'general' },
  { url: 'https://reasonstobecheerful.world/feed/', source: 'Reasons to be Cheerful', category: 'general' },

  // Climate & Environment
  { url: 'https://www.theguardian.com/environment/rss', source: 'The Guardian Environment', category: 'climate' },
  { url: 'https://www.sciencedaily.com/rss/top/environment.xml', source: 'Science Daily Environment', category: 'climate' },
  { url: 'https://www.sciencedaily.com/rss/earth_climate.xml', source: 'Science Daily Climate', category: 'climate' },

  // Health & Medicine
  { url: 'https://www.sciencedaily.com/rss/health_medicine.xml', source: 'Science Daily Health', category: 'health' },
  { url: 'https://www.sciencedaily.com/rss/mind_brain.xml', source: 'Science Daily Mind', category: 'health' },

  // Science & Technology
  { url: 'https://www.nature.com/nature.rss', source: 'Nature', category: 'science' },
  { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC Science', category: 'science' },
  { url: 'https://www.sciencedaily.com/rss/top/science.xml', source: 'Science Daily Top', category: 'science' },

  // Wildlife & Animals
  { url: 'https://www.sciencedaily.com/rss/plants_animals.xml', source: 'Science Daily Animals', category: 'wildlife' },
];

// Keywords that indicate positive/constructive news
const POSITIVE_KEYWORDS = [
  'breakthrough', 'success', 'achieve', 'discover', 'cure', 'solve', 'improve',
  'record', 'first', 'milestone', 'victory', 'win', 'protect', 'save', 'restore',
  'recover', 'grow', 'increase', 'reduce pollution', 'clean energy', 'renewable',
  'conservation', 'preserved', 'thriving', 'hope', 'progress', 'advance',
  'treatment', 'vaccine', 'therapy', 'innovation', 'solution', 'rescued',
  'recovery', 'healing', 'sustainable', 'green', 'solar', 'wind power',
  'electric', 'recycling', 'biodiversity', 'reforestation', 'rewilding'
];

// Keywords that indicate negative news we want to filter out
const NEGATIVE_KEYWORDS = [
  'death', 'dies', 'killed', 'murder', 'attack', 'terror', 'war', 'crisis',
  'disaster', 'catastrophe', 'collapse', 'crash', 'fear', 'threat', 'danger',
  'scandal', 'corruption', 'fraud', 'violence', 'victim', 'tragedy', 'worst',
  'devastating', 'alarming', 'warning', 'extinct', 'failed', 'failure'
];

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
  }
});

async function fetchRSSFeeds() {
  const articles = [];

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`Fetching ${feed.source}...`);
      const result = await parser.parseURL(feed.url);

      // Get up to 20 articles per feed
      for (const item of result.items.slice(0, 20)) {
        const article = {
          title: item.title || '',
          link: item.link || '',
          description: item.contentSnippet || item.content || item.description || '',
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
          source: feed.source,
          sourceUrl: item.link,
          category: feed.category,
        };

        // Score the article for positivity
        article.positivityScore = scorePositivity(article);

        // Include articles with positive score, or from trusted positive news sources
        if (article.positivityScore > 0 || ['Positive News', 'Good News Network', 'Reasons to be Cheerful'].includes(feed.source)) {
          articles.push(article);
        }
      }
    } catch (error) {
      console.error(`Error fetching ${feed.source}: ${error.message}`);
    }
  }

  return articles;
}

async function fetchNewsAPI() {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.log('NEWS_API_KEY not set, skipping NewsAPI');
    return [];
  }

  const articles = [];

  // Expanded queries for better coverage across categories
  const queries = [
    // Science & breakthroughs
    { q: 'scientific breakthrough', category: 'science' },
    { q: 'medical breakthrough', category: 'health' },
    { q: 'new treatment approved', category: 'health' },
    { q: 'disease cure', category: 'health' },

    // Climate & environment
    { q: 'renewable energy record', category: 'climate' },
    { q: 'climate solution', category: 'climate' },
    { q: 'solar power milestone', category: 'climate' },
    { q: 'wind energy record', category: 'climate' },

    // Wildlife & conservation
    { q: 'conservation success', category: 'wildlife' },
    { q: 'species recovery', category: 'wildlife' },
    { q: 'wildlife protection', category: 'wildlife' },
    { q: 'endangered species saved', category: 'wildlife' },

    // People & community
    { q: 'community success story', category: 'people' },
    { q: 'humanitarian achievement', category: 'people' },
  ];

  for (const { q, category } of queries) {
    try {
      console.log(`Fetching NewsAPI: ${q}...`);
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=10&language=en&apiKey=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.articles) {
        for (const item of data.articles) {
          // Skip articles with [Removed] content (NewsAPI limitation)
          if (item.title === '[Removed]' || item.description === '[Removed]') continue;

          const article = {
            title: item.title || '',
            link: item.url || '',
            description: item.description || '',
            pubDate: item.publishedAt || new Date().toISOString(),
            source: item.source?.name || 'NewsAPI',
            sourceUrl: item.url,
            category: category,
            author: item.author,
          };

          article.positivityScore = scorePositivity(article);

          if (article.positivityScore > 0) {
            articles.push(article);
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching NewsAPI (${q}): ${error.message}`);
    }
  }

  return articles;
}

function scorePositivity(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  let score = 0;

  // Check for negative keywords (disqualify)
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      score -= 10;
    }
  }

  // Check for positive keywords
  for (const keyword of POSITIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      score += 2;
    }
  }

  // Bonus for coming from dedicated positive news sources
  if (['Positive News', 'Good News Network', 'Reasons to be Cheerful'].includes(article.source)) {
    score += 5;
  }

  return score;
}

// Export for use as module
export async function fetchAllNews() {
  console.log('=== Fetching positive news ===\n');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Load previously published articles for deduplication
  const { publishedTitles, publishedUrls } = loadPublishedArticles();

  // Fetch from all sources
  const rssArticles = await fetchRSSFeeds();
  const newsApiArticles = await fetchNewsAPI();

  // Combine all articles
  const allArticles = [...rssArticles, ...newsApiArticles];

  // Deduplicate within current batch
  const seen = new Set();
  const uniqueArticles = allArticles.filter(article => {
    const key = article.title.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Filter out previously published articles
  const freshArticles = uniqueArticles.filter(article => {
    const isDuplicate = wasPublished(article, publishedTitles, publishedUrls);
    if (isDuplicate) {
      console.log(`  Skipping duplicate: ${article.title.slice(0, 50)}...`);
    }
    return !isDuplicate;
  });

  const skippedCount = uniqueArticles.length - freshArticles.length;
  if (skippedCount > 0) {
    console.log(`\n📋 Filtered out ${skippedCount} previously published articles`);
  }

  // Sort by positivity score
  freshArticles.sort((a, b) => b.positivityScore - a.positivityScore);

  // Take top 100 articles
  const topArticles = freshArticles.slice(0, 100);

  console.log(`\n✅ Found ${topArticles.length} fresh positive articles (from ${allArticles.length} total fetched)\n`);

  // Save to file
  const outputPath = path.join(DATA_DIR, 'raw-articles.json');
  fs.writeFileSync(outputPath, JSON.stringify(topArticles, null, 2));
  console.log(`Saved to ${outputPath}`);

  return topArticles;
}

// Run if called directly
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  fetchAllNews().catch(console.error);
}

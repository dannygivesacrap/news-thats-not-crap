/**
 * Use Claude to curate and rewrite articles in WGAC style
 *
 * CRITICAL RULES:
 * - Only use facts explicitly stated in the original source
 * - Never fabricate statistics, quotes, names, or details
 * - Tone is playful and warm, but facts are sacred
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const anthropic = new Anthropic();

// Category configuration
const CATEGORIES = ['climate', 'health', 'science', 'wildlife', 'people'];

// Punny author names by category
const AUTHORS = {
  climate: ['Sunny Bright', 'Gusty Winds', 'Ray Solar', 'Marina Waters', 'Forrest Green', 'Coral Reef', 'River Stone'],
  health: ['Liv Long', 'Hope Springs', 'Vi Tality', 'Will Power', 'Grace Recovery', 'Faith Healer', 'Joy Fuller'],
  science: ['Al Gorithm', 'Ella Ment', 'Gene Pool', 'Adam Atom', 'Crystal Clear', 'Nova Star', 'Flora Fauna'],
  wildlife: ['Fauna Flora', 'Robin Nest', 'Finn Waters', 'Bear Lee', 'Dawn Chorus', 'Buck Wild', 'Coral Bay'],
  people: ['Hope Rising', 'Joy Fuller', 'Will Prosper', 'Faith Forward', 'Sol Idarity', 'Pat Ontheback', 'Charity Case']
};

function getAuthor(category) {
  const authors = AUTHORS[category] || AUTHORS.people;
  return authors[Math.floor(Math.random() * authors.length)];
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');
}

// Fallback images by category
const FALLBACK_IMAGES = {
  climate: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=1200&q=80',
  health: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=1200&q=80',
  science: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=1200&q=80',
  wildlife: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=1200&q=80',
  people: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80'
};

async function fetchUnsplashImage(searchTerm, category) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    console.log('  (No UNSPLASH_ACCESS_KEY, using fallback image)');
    return FALLBACK_IMAGES[category] || FALLBACK_IMAGES.people;
  }

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm)}&per_page=1&orientation=landscape`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Client-ID ${accessKey}` }
    });

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const photo = data.results[0];
      return `${photo.urls.regular}&w=1200&q=80`;
    }

    return FALLBACK_IMAGES[category] || FALLBACK_IMAGES.people;
  } catch (error) {
    console.log(`  (Image search failed: ${error.message}, using fallback)`);
    return FALLBACK_IMAGES[category] || FALLBACK_IMAGES.people;
  }
}

// System prompt for consistent WGAC voice
const WGAC_SYSTEM_PROMPT = `You are a writer for "News That's Not Crap" - a positive news site.

YOUR VOICE:
- Warm and conversational, like a smart friend sharing good news
- Playful with puns and wordplay when natural
- Optimistic without being naive or preachy
- Accessible - explain complex topics simply
- Light self-deprecation is fine occasionally, but NOT in every article

CRITICAL - VARIETY IN OPENINGS:
- Every article should start differently
- DO NOT reference toilet paper, TP, or being a toilet paper company
- DO NOT start every article with self-deprecating humor
- Mix up your approaches: sometimes start with the key fact, sometimes with a question, sometimes with a surprising angle, sometimes with humor
- Each article should feel fresh and unique while maintaining consistent warmth

ABSOLUTE RULES FOR FACTS:
- ONLY use facts explicitly stated in the source material provided
- NEVER invent statistics, percentages, or numbers
- NEVER fabricate quotes or attribute words to anyone
- NEVER make up researcher names, expert names, or organizations
- When uncertain, use phrases like "according to the report"
- Better to write less than to fabricate details

Remember: The tone is playful, but the facts are sacred.`;

// Batch size for processing (to stay under token limits)
const BATCH_SIZE = 20;

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// API call with retry logic
async function callWithRetry(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        // Rate limited - wait and retry
        const waitTime = Math.min(60000 * attempt, 120000); // 1-2 minutes
        console.log(`  Rate limited. Waiting ${waitTime / 1000}s before retry ${attempt + 1}/${maxRetries}...`);
        await sleep(waitTime);
      } else {
        throw error;
      }
    }
  }
}

// Process a single batch of articles
async function curateBatch(articles, batchNum, totalBatches) {
  console.log(`  Processing batch ${batchNum}/${totalBatches} (${articles.length} articles)...`);

  const prompt = `Review these ${articles.length} articles and select the BEST stories for a positive news site.

SELECTION CRITERIA:
1. Genuinely positive/constructive (not just "less bad" news)
2. Significant and newsworthy
3. Categorize into: climate, health, science, wildlife, or people

For EACH good article, provide:
- originalTitle: exact title from source
- headline: rewritten in WGAC voice (punchy, playful, can include puns)
- excerpt: 2-3 sentence summary using ONLY facts from the source
- category: one of [climate, health, science, wildlife, people]
- sourceUrl: exact URL from source
- sourceName: publication name
- readTime: estimated minutes (3-6)
- imageSearch: 2-3 word Unsplash search term for a relevant photo

SOURCE ARTICLES:
${JSON.stringify(articles, null, 2)}

Return valid JSON:
{
  "articles": [
    {
      "originalTitle": "...",
      "headline": "...",
      "excerpt": "...",
      "category": "climate|health|science|wildlife|people",
      "sourceUrl": "...",
      "sourceName": "...",
      "readTime": 4,
      "imageSearch": "relevant search term"
    }
  ]
}`;

  const response = await callWithRetry(() =>
    anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: WGAC_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    })
  );

  const content = response.content[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.log(`  Warning: No JSON in batch ${batchNum} response`);
    return [];
  }

  const result = JSON.parse(jsonMatch[0]);
  console.log(`  ✓ Batch ${batchNum}: ${result.articles?.length || 0} articles selected`);

  return result.articles || [];
}

async function curateAndCategorize(rawArticles) {
  console.log('Curating and categorizing articles with Claude...\n');

  // Split into batches
  const batches = [];
  for (let i = 0; i < rawArticles.length; i += BATCH_SIZE) {
    batches.push(rawArticles.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing ${rawArticles.length} articles in ${batches.length} batches...\n`);

  // Process each batch with delays between them
  const allCurated = [];
  for (let i = 0; i < batches.length; i++) {
    try {
      const batchResults = await curateBatch(batches[i], i + 1, batches.length);
      allCurated.push(...batchResults);

      // Wait between batches to respect rate limits
      if (i < batches.length - 1) {
        console.log('  Waiting 30s before next batch...\n');
        await sleep(30000);
      }
    } catch (error) {
      console.error(`  Error in batch ${i + 1}: ${error.message}`);
      // Continue with other batches
    }
  }

  console.log(`\n✅ Curated ${allCurated.length} articles total`);

  // Select hero and featured
  if (allCurated.length > 0) {
    allCurated[0].isHomepageHero = true;
    allCurated.slice(1, 15).forEach(a => a.isHomepageFeatured = true);
  }

  // Add slugs, authors, and images
  for (const article of allCurated) {
    article.slug = generateSlug(article.headline);
    article.author = getAuthor(article.category);

    // Fetch relevant image from Unsplash
    if (article.imageSearch) {
      article.imageUrl = await fetchUnsplashImage(article.imageSearch, article.category);
    } else {
      article.imageUrl = FALLBACK_IMAGES[article.category] || FALLBACK_IMAGES.people;
    }
  }

  // Log category breakdown
  const categoryCount = {};
  CATEGORIES.forEach(cat => {
    categoryCount[cat] = allCurated.filter(a => a.category === cat).length;
  });
  console.log('Category breakdown:', categoryCount);

  return allCurated;
}

async function generateFullArticle(article) {
  console.log(`  Writing: ${article.headline}`);

  const prompt = `Write a full article for "News That's Not Crap" based on this story.

ORIGINAL SOURCE:
Title: ${article.originalTitle}
Excerpt: ${article.excerpt}
Source: ${article.sourceName}
URL: ${article.sourceUrl}

WRITE IN WGAC VOICE:
- Open with a hook that's warm and engaging
- Explain the story like you're telling a friend
- Use puns or wordplay if they fit naturally
- Be optimistic but grounded
- Keep it accessible - no jargon without explanation

IMPORTANT - VARIETY:
- DO NOT start with self-deprecating humor about toilet paper or being a TP company
- DO NOT use the same opening structure for every article
- Mix it up: lead with the key fact, a question, a surprising angle, or gentle humor
- Each article should feel fresh and unique

STRICT FACT RULES:
- ONLY use facts from the source excerpt above
- Do NOT invent statistics or numbers
- Do NOT fabricate quotes
- Do NOT make up names of researchers/experts
- If the source is light on details, write shorter rather than padding with made-up info
- Use "according to the report" when summarizing

STRUCTURE:
- Lead: 2-3 sentences, hook the reader with personality
- Body: 3-4 paragraphs, explain the story with warmth
- Keep total length reasonable (matches ${article.readTime} min read time)

Return JSON:
{
  "lead": "Opening paragraph...",
  "body": ["Paragraph 1...", "Paragraph 2...", "Paragraph 3..."],
  "pullQuote": "A striking quote or fact from the source (ONLY if actually in source, otherwise null)"
}`;

  try {
    const response = await callWithRetry(() =>
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: WGAC_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }]
      })
    );

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { lead: article.excerpt, body: [], pullQuote: null };
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error(`  Error generating article: ${error.message}`);
    return { lead: article.excerpt, body: [], pullQuote: null };
  }
}

// Export for use as module
export async function runCuration() {
  console.log('=== Curating positive news with AI ===\n');

  // Load raw articles
  const rawPath = path.join(DATA_DIR, 'raw-articles.json');
  if (!fs.existsSync(rawPath)) {
    console.error('No raw articles found. Run fetch-news.js first.');
    process.exit(1);
  }

  const rawArticles = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  console.log(`Loaded ${rawArticles.length} raw articles\n`);

  // Step 1: Curate and categorize
  const curatedArticles = await curateAndCategorize(rawArticles);

  // Step 2: Generate full content for all articles
  console.log('\nGenerating full article content...\n');

  for (let i = 0; i < curatedArticles.length; i++) {
    const article = curatedArticles[i];
    const fullContent = await generateFullArticle(article);
    article.fullContent = fullContent;

    // Longer delay to respect rate limits (10k tokens/minute)
    if (i < curatedArticles.length - 1) {
      await sleep(15000); // 15 seconds between articles
    }
  }

  // Step 3: Organize output
  const output = {
    generatedAt: new Date().toISOString(),
    homepage: {
      hero: curatedArticles.find(a => a.isHomepageHero) || curatedArticles[0],
      featured: curatedArticles.filter(a => a.isHomepageFeatured).slice(0, 14)
    },
    sections: {},
    allArticles: curatedArticles
  };

  // Organize by section
  CATEGORIES.forEach(category => {
    output.sections[category] = curatedArticles
      .filter(a => a.category === category)
      .sort((a, b) => {
        // Homepage articles first, then by position
        if (a.isHomepageHero || a.isHomepageFeatured) return -1;
        if (b.isHomepageHero || b.isHomepageFeatured) return 1;
        return 0;
      });
  });

  // Save output
  const outputPath = path.join(DATA_DIR, 'curated-articles.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Saved ${curatedArticles.length} curated articles to ${outputPath}`);

  // Save timestamp
  const metaPath = path.join(DATA_DIR, 'last-update.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    updatedAt: new Date().toISOString(),
    articleCount: curatedArticles.length,
    categoryCounts: Object.fromEntries(
      CATEGORIES.map(cat => [cat, output.sections[cat].length])
    )
  }, null, 2));

  return output;
}

// Run if called directly
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  runCuration().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

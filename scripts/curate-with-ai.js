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
import { getNextImage, resetImageIndices, getRandomImage } from './image-pool.js';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

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

// Images are now imported from image-pool.js (100 per category)

// Validate that an image URL is accessible
async function validateImageUrl(url, maxRetries = 2) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
      if (response.ok) return true;
    } catch (error) {
      // Try again
    }
  }
  return false;
}

// Extract search keywords from an article
function extractKeywords(article) {
  // Start with the headline, remove common words
  const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'between',
    'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
    'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'how', 'why',
    'new', 'now', 'way', 'ways', 'get', 'got', 'gets', 'make', 'makes', 'made',
    'first', 'good', 'great', 'big', 'small', 'old', 'young', 'long', 'little',
    'world', 'year', 'years', 'day', 'days', 'time', 'life', 'people', 'thing'];

  const headline = article.headline || article.originalTitle || '';
  const words = headline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));

  // Take top 3-4 meaningful words + category
  const keywords = words.slice(0, 4);

  // Add category-specific context
  const categoryContext = {
    climate: 'nature environment',
    health: 'wellness medical',
    science: 'research discovery',
    wildlife: 'animals nature',
    people: 'community helping'
  };

  if (categoryContext[article.category]) {
    keywords.push(...categoryContext[article.category].split(' '));
  }

  return keywords.slice(0, 5).join(' ');
}

// Search Pexels for a relevant image
async function searchPexelsImage(article) {
  if (!PEXELS_API_KEY) {
    return null;
  }

  const query = extractKeywords(article);
  console.log(`    Searching Pexels for: "${query}"`);

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
    const response = await fetch(url, {
      headers: {
        'Authorization': PEXELS_API_KEY
      }
    });

    if (!response.ok) {
      console.log(`    Pexels API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.photos && data.photos.length > 0) {
      // Pick a random photo from top results for variety
      const photo = data.photos[Math.floor(Math.random() * Math.min(3, data.photos.length))];
      // Use the large2x size (1920px wide)
      const imageUrl = photo.src.large2x || photo.src.large || photo.src.original;
      console.log(`    ✓ Found Pexels image by ${photo.photographer}`);
      return imageUrl;
    }

    console.log(`    No Pexels results for "${query}"`);
    return null;

  } catch (error) {
    console.log(`    Pexels search failed: ${error.message}`);
    return null;
  }
}

// Get a valid image for an article - tries Pexels first, falls back to curated pool
async function getValidImage(article) {
  const category = article.category || 'people';

  // Try Pexels search first for content-relevant images
  const pexelsImage = await searchPexelsImage(article);
  if (pexelsImage) {
    const isValid = await validateImageUrl(pexelsImage);
    if (isValid) {
      return pexelsImage;
    }
    console.log(`    Pexels image failed validation, trying pool...`);
  }

  // Fall back to curated pool
  for (let i = 0; i < 5; i++) {
    const imageUrl = getNextImage(category);
    const isValid = await validateImageUrl(imageUrl);
    if (isValid) {
      return imageUrl;
    }
    console.log(`    Pool image failed validation, trying another...`);
  }

  // Last resort fallback
  console.log(`    Using random fallback for ${category}`);
  return getRandomImage(category);
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
      "readTime": 4
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
  // Reset image indices for variety across the batch
  resetImageIndices();

  console.log('\nAssigning and validating images...\n');
  for (const article of allCurated) {
    article.slug = generateSlug(article.headline);
    article.author = getAuthor(article.category);
    // Search for content-relevant image (Pexels first, then curated pool fallback)
    article.imageUrl = await getValidImage(article);
    console.log(`  ✓ ${article.headline.slice(0, 50)}...`);
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

// Fact-check an article against its source
async function factCheckArticle(article) {
  console.log(`  Fact-checking: ${article.headline}`);

  const generatedContent = article.fullContent;
  const allGeneratedText = [
    generatedContent.lead,
    ...(generatedContent.body || []),
    generatedContent.pullQuote
  ].filter(Boolean).join('\n\n');

  const prompt = `You are a fact-checker. Compare the generated article against the original source information.

ORIGINAL SOURCE:
Title: ${article.originalTitle}
Source: ${article.sourceName}
Original excerpt: ${article.excerpt}

GENERATED ARTICLE:
${allGeneratedText}

VERIFY:
1. Are all facts, statistics, and numbers accurate to the source?
2. Are all quotes attributed correctly (or not fabricated)?
3. Are there any claims not supported by the source material?
4. Are names of people, organizations, or places accurate?

Respond with JSON:
{
  "passed": true/false,
  "issues": ["list of specific factual issues found, if any"],
  "confidence": "high/medium/low",
  "summary": "brief explanation"
}`;

  try {
    const response = await callWithRetry(() =>
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    );

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { passed: true, issues: [], confidence: 'low', summary: 'Could not parse fact-check response' };
    }

    const result = JSON.parse(jsonMatch[0]);
    if (!result.passed) {
      console.log(`    ⚠️ Fact-check issues: ${result.issues.join(', ')}`);
    } else {
      console.log(`    ✓ Fact-check passed (${result.confidence} confidence)`);
    }
    return result;

  } catch (error) {
    console.error(`  Error fact-checking: ${error.message}`);
    return { passed: true, issues: [], confidence: 'low', summary: 'Fact-check failed, defaulting to pass' };
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

  // Step 3: Fact-check all articles
  console.log('\nFact-checking articles...\n');

  for (let i = 0; i < curatedArticles.length; i++) {
    const article = curatedArticles[i];
    const factCheck = await factCheckArticle(article);
    article.factCheck = factCheck;

    // Flag articles that failed fact-check
    if (!factCheck.passed) {
      article.factCheckFailed = true;
      console.log(`    Article "${article.headline}" flagged for review`);
    }

    // Delay between fact-checks
    if (i < curatedArticles.length - 1) {
      await sleep(5000); // 5 seconds between fact-checks
    }
  }

  // Log fact-check summary
  const passedCount = curatedArticles.filter(a => a.factCheck?.passed).length;
  const failedCount = curatedArticles.filter(a => a.factCheckFailed).length;
  console.log(`\n✅ Fact-check complete: ${passedCount} passed, ${failedCount} flagged for review`);

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

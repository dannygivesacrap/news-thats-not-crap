/**
 * Use Claude to curate and rewrite articles in WGAC style
 * CRITICAL: Only uses facts from the original source - no fabrication
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const anthropic = new Anthropic();

// Category assignments for homepage sections
const CATEGORIES = {
  climate: ['climate', 'environment', 'renewable', 'energy', 'conservation'],
  health: ['health', 'medical', 'medicine', 'therapy', 'vaccine', 'disease', 'treatment'],
  science: ['science', 'research', 'discovery', 'space', 'technology', 'physics'],
  wildlife: ['wildlife', 'animal', 'species', 'conservation', 'marine', 'bird'],
  people: ['community', 'social', 'education', 'rights', 'humanitarian']
};

// Punny author names by category
const AUTHORS = {
  climate: ['Sunny Bright', 'Gusty Winds', 'Ray Solar', 'Marina Waters', 'Forrest Green'],
  health: ['Liv Long', 'Hope Springs', 'Vi Tality', 'Will Power', 'Grace Recovery'],
  science: ['Al Gorithm', 'Ella Ment', 'Gene Pool', 'Adam Atom', 'Crystal Clear'],
  wildlife: ['Fauna Flora', 'Robin Nest', 'Finn Waters', 'Bear Lee', 'Dawn Chorus'],
  people: ['Hope Rising', 'Joy Fuller', 'Will Prosper', 'Faith Forward', 'Sol Idarity']
};

function categorizeArticle(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }
  return 'people'; // default
}

function getAuthor(category) {
  const authors = AUTHORS[category] || AUTHORS.people;
  return authors[Math.floor(Math.random() * authors.length)];
}

async function curateArticles(rawArticles) {
  console.log('Curating articles with Claude...\n');

  const prompt = `You are a news curator for "News That's Not Crap" - a positive news site.

From the following articles, select the 12 best stories that are:
1. Genuinely positive/constructive (not just "less bad" news)
2. Significant and newsworthy
3. Diverse across categories (aim for mix of climate, health, science, wildlife, people stories)

CRITICAL RULES FOR FACTUAL ACCURACY:
- ONLY use facts that are explicitly stated in the source article
- Do NOT invent statistics, quotes, or details
- Do NOT fabricate expert names or organizations
- If the source doesn't provide specific numbers, don't make them up
- Keep the source URL - it will be linked prominently

For each selected article, provide:
1. A rewritten headline (punchy, engaging, WGAC voice - slightly irreverent but factual)
2. A short excerpt (2-3 sentences summarizing the key point - ONLY facts from the source)
3. The category (climate/health/science/wildlife/people)
4. Estimated read time (3-6 min)

Here are the source articles:

${JSON.stringify(rawArticles.slice(0, 30), null, 2)}

Respond in JSON format:
{
  "hero": {
    "originalTitle": "...",
    "headline": "...",
    "excerpt": "...",
    "category": "...",
    "sourceUrl": "...",
    "sourceName": "...",
    "readTime": 5
  },
  "featured": [
    { same structure, 3 articles }
  ],
  "more": [
    { same structure, 8 articles }
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const curated = JSON.parse(jsonMatch[0]);

    // Add authors and format
    curated.hero.author = getAuthor(curated.hero.category);
    curated.featured.forEach(a => a.author = getAuthor(a.category));
    curated.more.forEach(a => a.author = getAuthor(a.category));

    return curated;

  } catch (error) {
    console.error('Error curating with Claude:', error.message);
    throw error;
  }
}

async function generateArticleContent(article) {
  console.log(`Generating full article: ${article.headline}`);

  const prompt = `Write a full article for "News That's Not Crap" based on this story.

ORIGINAL SOURCE:
Title: ${article.originalTitle}
Excerpt: ${article.excerpt}
Source: ${article.sourceName}
URL: ${article.sourceUrl}

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY use facts from the source article - do not invent ANY details
2. Do NOT make up statistics, percentages, or numbers not in the source
3. Do NOT fabricate quotes or expert names
4. Do NOT create fictional research studies or organizations
5. If you need more context, say "according to the report" rather than inventing specifics
6. The tone should be optimistic and slightly irreverent (WGAC style) but FACTUALLY ACCURATE

STRUCTURE:
- Lead paragraph (2-3 sentences, hook the reader)
- Body (3-4 paragraphs explaining the story using ONLY source facts)
- Keep it concise - this is a summary article, not investigative journalism
- End on an optimistic but grounded note

Write in a warm, accessible, slightly cheeky tone - like a smart friend telling you good news.

Return as JSON:
{
  "lead": "...",
  "body": ["paragraph1", "paragraph2", "paragraph3"],
  "pullQuote": "A key quote or striking fact from the article (ONLY if in source, otherwise null)"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { lead: article.excerpt, body: [], pullQuote: null };
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error(`Error generating article content: ${error.message}`);
    return { lead: article.excerpt, body: [], pullQuote: null };
  }
}

async function main() {
  console.log('=== Curating positive news with AI ===\n');

  // Load raw articles
  const rawPath = path.join(DATA_DIR, 'raw-articles.json');
  if (!fs.existsSync(rawPath)) {
    console.error('No raw articles found. Run fetch-news.js first.');
    process.exit(1);
  }

  const rawArticles = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  console.log(`Loaded ${rawArticles.length} raw articles\n`);

  // Curate top stories
  const curated = await curateArticles(rawArticles);

  // Generate full content for hero and featured
  const allArticles = [curated.hero, ...curated.featured, ...curated.more];

  for (const article of allArticles.slice(0, 6)) { // Full content for top 6
    const content = await generateArticleContent(article);
    article.fullContent = content;

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // Save curated articles
  const outputPath = path.join(DATA_DIR, 'curated-articles.json');
  fs.writeFileSync(outputPath, JSON.stringify(curated, null, 2));
  console.log(`\nSaved curated articles to ${outputPath}`);

  // Also save timestamp
  const metaPath = path.join(DATA_DIR, 'last-update.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    updatedAt: new Date().toISOString(),
    articleCount: allArticles.length
  }, null, 2));
}

main().catch(console.error);

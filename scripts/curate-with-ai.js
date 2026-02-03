/**
 * Use Claude to curate and rewrite articles in WGAC style
 * CRITICAL: Only uses facts from the original source - no fabrication
 */

import 'dotenv/config';
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

  const systemPrompt = `You are a fact-obsessed news curator. Your #1 rule: NEVER invent, fabricate, or embellish ANY details. You can only use information explicitly stated in the source material. If in doubt, leave it out. This is non-negotiable.`;

  const prompt = `You are a news curator for "News That's Not Crap" - a positive news site by Who Gives A Crap.

From the following articles, select the 12 best stories that are:
1. Genuinely positive/constructive (not just "less bad" news)
2. Significant and newsworthy
3. Diverse across categories (aim for mix of climate, health, science, wildlife, people stories)

⚠️ ABSOLUTE RULES FOR FACTUAL ACCURACY - VIOLATION IS UNACCEPTABLE:
- ONLY use facts EXPLICITLY stated in the source article text provided
- Do NOT invent statistics, percentages, numbers, or figures
- Do NOT fabricate quotes from anyone
- Do NOT make up expert names, researcher names, or organization names
- Do NOT add details that "seem likely" but aren't stated
- If the source doesn't provide specific numbers, DO NOT guess or estimate
- When uncertain, use phrases like "according to the report"
- The sourceUrl MUST be copied exactly from the source - it will be the primary link

For each selected article, provide:
1. A rewritten headline (punchy, engaging, WGAC voice - slightly irreverent but FACTUALLY GROUNDED)
2. A short excerpt (2-3 sentences summarizing ONLY facts from the source)
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
      system: systemPrompt,
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

  const systemPrompt = `You are a writer who is obsessively committed to factual accuracy. You NEVER invent details, statistics, quotes, names, or any information not explicitly provided in the source. If information isn't in the source, you don't include it - no exceptions. Your writing is engaging and warm, but every single fact must come directly from the source material.`;

  const prompt = `Write a full article for "News That's Not Crap" (by Who Gives A Crap) based on this story.

ORIGINAL SOURCE:
Title: ${article.originalTitle}
Excerpt: ${article.excerpt}
Source: ${article.sourceName}
URL: ${article.sourceUrl}

⚠️ ABSOLUTE RULES - THESE ARE NON-NEGOTIABLE:
1. ONLY use facts from the source excerpt above - do not invent ANY details
2. Do NOT make up statistics, percentages, or numbers - if they're not in the source, don't include them
3. Do NOT fabricate quotes - if there's no quote in the source, don't create one
4. Do NOT invent researcher names, expert names, or organization names
5. Do NOT add "likely" or "probably" details that aren't stated
6. Use phrases like "according to the report" or "the source states" when summarizing
7. If the source is light on details, write a shorter article rather than padding with invented info
8. The tone should be warm, optimistic, and slightly cheeky (WGAC brand voice) but EVERY FACT must be verifiable from the source

STRUCTURE:
- Lead paragraph (2-3 sentences, hook the reader)
- Body (2-3 paragraphs explaining the story using ONLY source facts)
- Keep it concise - better to be short and accurate than long and fabricated
- End on an optimistic but grounded note

Write in a warm, accessible, slightly self-deprecating tone - like a smart friend sharing good news.

Return as JSON:
{
  "lead": "...",
  "body": ["paragraph1", "paragraph2", "paragraph3"],
  "pullQuote": "A key quote or striking fact from the article (ONLY if explicitly in source, otherwise null)"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
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
  console.log(`\n✅ Saved curated articles to ${outputPath}`);

  // Also save timestamp
  const metaPath = path.join(DATA_DIR, 'last-update.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    updatedAt: new Date().toISOString(),
    articleCount: allArticles.length
  }, null, 2));

  return curated;
}

// Run if called directly
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  runCuration().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

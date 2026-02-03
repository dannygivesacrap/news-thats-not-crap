/**
 * Daily Pipeline - Run this each morning to fetch, curate, and review articles
 *
 * Usage: node scripts/daily-pipeline.js
 *
 * This will:
 * 1. Fetch ~100 raw articles from news sources
 * 2. Curate to 60-80 articles with AI, write full content
 * 3. Open review interface at http://localhost:3000/review
 */

import { fetchAllNews } from './fetch-news.js';
import { runCuration } from './curate-with-ai.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runPipeline() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🗞️  News That\'s Not Crap - Daily Pipeline');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Fetch news
    console.log('STEP 1: Fetching news from sources...\n');
    const rawArticles = await fetchAllNews();
    console.log(`\n✅ Fetched ${rawArticles.length} raw articles\n`);

    // Step 2: Curate with AI
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 2: Curating articles with AI...\n');
    const curated = await runCuration();
    console.log(`\n✅ Curated ${curated.allArticles?.length || 0} articles\n`);

    // Step 3: Start review server
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 3: Starting review interface...\n');

    const reviewServer = spawn('node', [path.join(__dirname, 'review-server.js')], {
      stdio: 'inherit',
      detached: false
    });

    // Open browser after a short delay
    setTimeout(() => {
      const openCmd = process.platform === 'darwin' ? 'open' :
                      process.platform === 'win32' ? 'start' : 'xdg-open';
      spawn(openCmd, ['http://localhost:3000/review'], { stdio: 'ignore', detached: true });
    }, 1000);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  Pipeline complete! Review articles at http://localhost:3000/review');
    console.log('  Press Ctrl+C to stop the server when done.');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Pipeline error:', error.message);
    process.exit(1);
  }
}

runPipeline();

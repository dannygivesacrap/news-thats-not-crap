import 'dotenv/config';
import { fetchAllNews } from './fetch-news.js';
import { runCuration } from './curate-with-ai.js';
import { generateSite } from './generate-site.js';

async function runDailyUpdate() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         NEWS THAT\'S NOT CRAP - DAILY UPDATE               ║');
  console.log('║                                                            ║');
  console.log(`║  ${new Date().toISOString()}                    ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Step 1: Fetch news from all sources
    console.log('\n📰 Step 1/3: Fetching news from sources...');
    await fetchAllNews();

    // Step 2: Curate with AI
    console.log('\n🤖 Step 2/3: Curating with Claude AI...');
    await runCuration();

    // Step 3: Generate HTML
    console.log('\n🔨 Step 3/3: Generating site...');
    await generateSite();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ DAILY UPDATE COMPLETE!                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Daily update failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runDailyUpdate();

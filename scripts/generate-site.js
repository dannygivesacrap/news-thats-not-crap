/**
 * Generate/update site HTML with curated articles
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Category tag colors
const TAG_CLASSES = {
  climate: 'tag-climate',
  health: 'tag-health',
  science: 'tag-science',
  wildlife: 'tag-wildlife',
  people: 'tag-people'
};

// Unsplash images by category (fallbacks)
const CATEGORY_IMAGES = {
  climate: [
    'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&q=80',
    'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80',
    'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&q=80'
  ],
  health: [
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&q=80',
    'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
    'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&q=80'
  ],
  science: [
    'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&q=80',
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80'
  ],
  wildlife: [
    'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=800&q=80',
    'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=800&q=80',
    'https://images.unsplash.com/photo-1534759926787-89fa60f35b87?w=800&q=80'
  ],
  people: [
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
    'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=800&q=80',
    'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&q=80'
  ]
};

function getImage(category, index = 0) {
  const images = CATEGORY_IMAGES[category] || CATEGORY_IMAGES.people;
  return images[index % images.length];
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function generateTickerContent(articles) {
  const items = articles.slice(0, 8).map(a => a.headline);
  const ticker = items.map(item =>
    `${item} <span class="ticker-divider"></span>`
  ).join('\n            ');

  // Duplicate for seamless loop
  return ticker + '\n            ' + ticker;
}

function generateHeroHTML(article) {
  const tagClass = TAG_CLASSES[article.category] || 'tag-people';

  return `    <a href="${article.sourceUrl}" target="_blank" class="hero">
        <div class="hero-image">
            <img src="${getImage(article.category, 0)}" alt="${article.headline}">
        </div>
        <div class="hero-overlay"></div>
        <div class="hero-content">
            <span class="hero-tag">${article.category.charAt(0).toUpperCase() + article.category.slice(1)}</span>
            <h1 class="hero-title">${article.headline}</h1>
            <p class="hero-excerpt">${article.excerpt}</p>
            <div class="hero-meta">
                <span>By ${article.author}</span>
                <span>${article.readTime} min read</span>
                <span>Source: ${article.sourceName}</span>
            </div>
        </div>
    </a>`;
}

function generateFeaturedCardHTML(article, index, isFeatured = false) {
  const tagClass = TAG_CLASSES[article.category] || 'tag-people';
  const cardClass = isFeatured ? 'article-card featured' : 'article-card regular';

  return `            <a href="${article.sourceUrl}" target="_blank" class="${cardClass}">
                <div class="card-inner">
                    <div class="card-image">
                        <img src="${getImage(article.category, index)}" alt="${article.headline}">
                    </div>
                    <div class="card-content">
                        <div class="card-tag ${tagClass}">${article.category.charAt(0).toUpperCase() + article.category.slice(1)}</div>
                        <h3 class="card-title">${article.headline}</h3>
                        <p class="card-excerpt">${article.excerpt}</p>
                        <div class="card-meta">By ${article.author} · ${article.readTime} min read · ${article.sourceName}</div>
                    </div>
                </div>
            </a>`;
}

function generateVerticalCardHTML(article, index) {
  const tagClass = TAG_CLASSES[article.category] || 'tag-people';

  return `            <a href="${article.sourceUrl}" target="_blank" class="vertical-card">
                <div class="card-image">
                    <img src="${getImage(article.category, index)}" alt="${article.headline}">
                </div>
                <div class="card-content">
                    <div class="card-tag ${tagClass}">${article.category.charAt(0).toUpperCase() + article.category.slice(1)}</div>
                    <h3 class="card-title">${article.headline}</h3>
                    <p class="card-excerpt">${article.excerpt}</p>
                    <div class="card-meta">By ${article.author} · ${article.readTime} min read</div>
                </div>
            </a>`;
}

function generateListItemHTML(article, number) {
  return `                <a href="${article.sourceUrl}" target="_blank" class="list-item">
                    <div class="list-number">${String(number).padStart(2, '0')}</div>
                    <div class="list-content">
                        <div class="list-tag">${article.category.charAt(0).toUpperCase() + article.category.slice(1)}</div>
                        <h4 class="list-title">${article.headline}</h4>
                    </div>
                </a>`;
}

function updateIndexHTML(curated) {
  const indexPath = path.join(ROOT_DIR, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  const today = formatDate(new Date());

  // Update date
  html = html.replace(
    /<div class="header-date">.*?<\/div>/,
    `<div class="header-date">${today}</div>`
  );

  // Update ticker
  const allArticles = [curated.hero, ...curated.featured, ...curated.more];
  const tickerContent = generateTickerContent(allArticles);
  html = html.replace(
    /<div class="ticker-content">[\s\S]*?<\/div>/,
    `<div class="ticker-content">\n            ${tickerContent}\n        </div>`
  );

  // Update hero
  const heroHTML = generateHeroHTML(curated.hero);
  html = html.replace(
    /<a href="articles\/.*?" class="hero">[\s\S]*?<\/a>\s*(?=\s*<!-- Stats -->|<\!-- Stats)|<a href="[^"]*" target="_blank" class="hero">[\s\S]*?<\/a>\s*(?=\s*<!-- Stats -->)/,
    heroHTML + '\n\n    '
  );

  // Update featured grid
  const featuredHTML = curated.featured.map((a, i) =>
    generateFeaturedCardHTML(a, i, i === 0)
  ).join('\n\n');

  html = html.replace(
    /<div class="featured-grid">[\s\S]*?<\/div>\s*(?=\s*<!-- Three Column Grid -->|<\!-- Three|<div class="section-header">)/,
    `<div class="featured-grid">\n${featuredHTML}\n        </div>\n\n        `
  );

  // Update three-column grid (first 3 of "more")
  const threeColHTML = curated.more.slice(0, 3).map((a, i) =>
    generateVerticalCardHTML(a, i)
  ).join('\n\n');

  html = html.replace(
    /<div class="three-col-grid">[\s\S]*?<\/div>\s*(?=\s*<!-- Data Section -->|<\!-- Data)/,
    `<div class="three-col-grid">\n${threeColHTML}\n        </div>\n\n        `
  );

  // Update list section (remaining articles)
  const listHTML = curated.more.slice(3, 9).map((a, i) =>
    generateListItemHTML(a, i + 1)
  ).join('\n\n');

  html = html.replace(
    /<div class="list-grid">[\s\S]*?<\/div>\s*(?=\s*<\/div>\s*<!-- Newsletter -->|<\!-- Newsletter)/,
    `<div class="list-grid">\n${listHTML}\n            </div>\n        `
  );

  fs.writeFileSync(indexPath, html);
  console.log('Updated index.html');
}

async function main() {
  console.log('=== Generating site HTML ===\n');

  // Load curated articles
  const curatedPath = path.join(DATA_DIR, 'curated-articles.json');
  if (!fs.existsSync(curatedPath)) {
    console.error('No curated articles found. Run curate-with-ai.js first.');
    process.exit(1);
  }

  const curated = JSON.parse(fs.readFileSync(curatedPath, 'utf8'));
  console.log('Loaded curated articles\n');

  // Update main index page
  updateIndexHTML(curated);

  console.log('\nSite generation complete!');
}

main().catch(console.error);

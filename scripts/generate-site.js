/**
 * Generate/update site HTML with curated articles
 *
 * This script:
 * 1. Generates full article HTML pages in /articles/[slug].html
 * 2. Updates homepage with 10-15 featured stories linking to internal pages
 * 3. Updates section pages (climate, health, science, wildlife, people) with 10-20 stories each
 * 4. Maintains permanent article URLs - articles stay at same URL forever
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const ARTICLES_DIR = path.join(ROOT_DIR, 'articles');

// Category configuration
const CATEGORIES = ['climate', 'health', 'science', 'wildlife', 'people'];

// Category tag classes and colors
const TAG_CLASSES = {
  climate: 'tag-climate',
  health: 'tag-health',
  science: 'tag-science',
  wildlife: 'tag-wildlife',
  people: 'tag-people'
};

// Category accent colors (for article pages)
const CATEGORY_COLORS = {
  climate: '#2dcb98',
  health: '#e85d4c',
  science: '#4368ff',
  wildlife: '#e84393',
  people: '#7b68ee'
};

// Section descriptions
const SECTION_DESCRIPTIONS = {
  climate: "The planet is warming. But humans are finally getting their act together. These are the wins worth celebrating.",
  health: "Medical breakthroughs, mental health wins, and reasons to feel good about feeling good.",
  science: "Discoveries, innovations, and 'wait, that's actually real?' moments from labs around the world.",
  wildlife: "Conservation wins, animal comebacks, and proof that nature is more resilient than we thought.",
  people: "Humans doing good things for other humans. Yes, they exist. Here's the proof."
};

// Category emojis for ticker
const CATEGORY_EMOJIS = {
  climate: ['🌍', '🌱', '⚡', '🌊', '☀️', '💨'],
  health: ['🔬', '💊', '🩺', '🧬', '💉', '❤️'],
  science: ['🔭', '🧪', '🚀', '🔬', '🕷️', '⚛️'],
  wildlife: ['🐦', '🦁', '🐋', '🦋', '🐘', '🐢'],
  people: ['👥', '🏠', '❄️', '🎓', '🤝', '💪']
};

// Large pool of curated Unsplash images by category (verified working URLs)
// Using stable, high-quality images that won't break
const CATEGORY_IMAGES = {
  climate: [
    // Solar/renewable energy
    'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80',
    'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=800&q=80',
    'https://images.unsplash.com/photo-1497440001374-f26997328c1b?w=800&q=80',
    // Wind energy
    'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=800&q=80',
    'https://images.unsplash.com/photo-1548337138-e87d889cc369?w=800&q=80',
    // Nature/forests
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
    'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=800&q=80',
    'https://images.unsplash.com/photo-1425913397330-cf8af2ff40a1?w=800&q=80',
    // Ocean/water
    'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80',
    'https://images.unsplash.com/photo-1484291470158-b8f8d608850d?w=800&q=80',
    // Green landscapes
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80'
  ],
  health: [
    // Medical/research
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80',
    'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=800&q=80',
    'https://images.unsplash.com/photo-1551076805-e1869033e561?w=800&q=80',
    // Wellness/fitness
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80',
    // Mental health/nature
    'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&q=80',
    'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&q=80',
    // Healthcare
    'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800&q=80',
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&q=80',
    // Healthy food
    'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'
  ],
  science: [
    // Space/astronomy
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80',
    'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80',
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&q=80',
    // Lab/research
    'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&q=80',
    'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&q=80',
    'https://images.unsplash.com/photo-1518152006812-edab29b069ac?w=800&q=80',
    // Technology
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80',
    // Innovation
    'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=800&q=80',
    'https://images.unsplash.com/photo-1517976487492-5750f3195933?w=800&q=80',
    // Nature science
    'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800&q=80',
    'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?w=800&q=80'
  ],
  wildlife: [
    // Birds
    'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800&q=80',
    'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=800&q=80',
    'https://images.unsplash.com/photo-1480044965905-02098d419e96?w=800&q=80',
    // Marine life
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80',
    'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&q=80',
    'https://images.unsplash.com/photo-1590673846749-e2fb8f655df8?w=800&q=80',
    // Large mammals
    'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=800&q=80',
    'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=800&q=80',
    'https://images.unsplash.com/photo-1549366021-9f761d450615?w=800&q=80',
    // Insects/butterflies
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    'https://images.unsplash.com/photo-1470165301023-58dab8118cc9?w=800&q=80',
    // Forest animals
    'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=800&q=80'
  ],
  people: [
    // Community/teamwork
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
    'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=800&q=80',
    'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&q=80',
    // Volunteering/helping
    'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80',
    // Celebration/joy
    'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800&q=80',
    'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80',
    // Education
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
    'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&q=80',
    // Family/connection
    'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&q=80',
    'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=800&q=80'
  ]
};

function getImage(article, index = 0) {
  // Use article-specific image if available
  if (article && article.imageUrl) {
    return article.imageUrl;
  }
  // Fall back to category-based images
  const category = article?.category || 'people';
  const images = CATEGORY_IMAGES[category] || CATEGORY_IMAGES.people;
  return images[index % images.length];
}

function getEmoji(category) {
  const emojis = CATEGORY_EMOJIS[category] || CATEGORY_EMOJIS.people;
  return emojis[Math.floor(Math.random() * emojis.length)];
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatUpdateTimestamp(date) {
  const d = new Date(date);
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const dateStr = d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  return `Updated at ${time} on ${dateStr}`;
}

function getTimezoneScript() {
  return `
    <script data-timestamp-script>
      document.querySelectorAll('[data-timestamp]').forEach(function(el) {
        var iso = el.getAttribute('data-timestamp');
        if (iso) {
          var d = new Date(iso);
          var time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
          var dateStr = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
          el.textContent = 'Updated at ' + time + ' on ' + dateStr;
        }
      });
    </script>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Generate full article HTML page
function generateArticleHTML(article) {
  const category = article.category || 'people';
  const categoryColor = CATEGORY_COLORS[category];
  const today = formatDate(new Date());
  const now = new Date();
  const isoTimestamp = now.toISOString();
  const fallbackTimestamp = formatUpdateTimestamp(now);
  const imageUrl = getImage(article, 0).replace('w=800', 'w=1920');

  // Get related articles (we'll populate this later)
  const fullContent = article.fullContent || { lead: article.excerpt, body: [], pullQuote: null };

  // Build body paragraphs
  const bodyParagraphs = (fullContent.body || [])
    .map(p => `            <p>${escapeHtml(p)}</p>`)
    .join('\n\n');

  // Build pull quote if exists
  const pullQuoteHtml = fullContent.pullQuote
    ? `\n            <blockquote>${escapeHtml(fullContent.pullQuote)}</blockquote>\n`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="../favicon.svg" type="image/svg+xml">
    <title>${escapeHtml(article.headline)} | News That's Not Crap</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
    <style>
        :root {
            --wgac-green: #1B873F;
            --wgac-green-light: #d7f6a4;
            --wgac-blue: #4368ff;
            --wgac-teal: #2dcb98;
            --wgac-coral: #e85d4c;
            --wgac-yellow: #f0c808;
            --wgac-purple: #7b68ee;
            --wgac-pink: #e84393;
            --wgac-brown: #a1512e;
            --white: #ffffff;
            --cream: #faf9f6;
            --dark: #1a1a1a;
            --gray-100: #f5f4f2;
            --gray-200: #e8e6e3;
            --gray-400: #a09d98;
            --gray-600: #6b6761;
            --font-display: 'Nunito', -apple-system, sans-serif;
            --font-body: 'Nunito', -apple-system, sans-serif;
            --font-serif: 'Instrument Serif', Georgia, serif;
            --radius-sm: 0.5rem;
            --radius-md: 1rem;
            --radius-lg: 1.5rem;
            --radius-pill: 100px;
            --category-color: ${categoryColor};
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: var(--font-body);
            background: var(--cream);
            color: var(--dark);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }

        a { color: inherit; text-decoration: none; }

        /* Header */
        .site-header { position: sticky; top: 0; z-index: 1000; }
        .header-top-bar { background: var(--dark); display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 2rem; }
        .header-tagline, .header-date { font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.5); }
        .header-main { background: var(--wgac-blue); display: flex; align-items: center; justify-content: space-between; padding: 1rem 2rem; }
        .logo { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; }
        .logo-text { font-size: 1.4rem; font-weight: 900; color: var(--white); text-transform: uppercase; letter-spacing: -0.03em; }
        .crap-box { background: var(--white); padding: 0.4rem 0.6rem; border-radius: 0.3rem; }
        .crap-box img { height: 1.3rem; display: block; filter: brightness(0) saturate(100%) invert(29%) sepia(98%) saturate(1654%) hue-rotate(221deg) brightness(101%) contrast(102%); }
        .main-nav { display: flex; gap: 0.35rem; }
        .nav-link { color: var(--white); font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 0.5rem 1rem; border-radius: var(--radius-pill); background: rgba(255,255,255,0.15); transition: all 0.2s ease; }
        .nav-link:hover { background: rgba(255,255,255,0.3); }
        .nav-link.active { background: var(--white); color: var(--wgac-blue); }

        /* Article Hero */
        .article-hero { position: relative; height: 70vh; min-height: 500px; max-height: 700px; overflow: hidden; }
        .article-hero img { width: 100%; height: 100%; object-fit: cover; }
        .article-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%); }
        .article-hero-content { position: absolute; bottom: 0; left: 0; right: 0; padding: 4rem; max-width: 900px; margin: 0 auto; text-align: center; }
        .article-tag { display: inline-block; background: var(--category-color); color: white; padding: 0.4rem 1rem; font-weight: 800; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1.5rem; border-radius: var(--radius-pill); }
        .article-hero h1 { font-family: var(--font-serif); font-size: clamp(2.5rem, 5vw, 3.5rem); font-weight: 400; line-height: 1.15; color: white; margin-bottom: 1.5rem; }
        .article-meta { color: rgba(255,255,255,0.7); font-size: 0.9rem; font-weight: 600; }
        .article-meta span { margin: 0 0.75rem; }

        /* Article Content */
        .article-content { max-width: 700px; margin: 0 auto; padding: 4rem 2rem; }
        .article-lead { font-size: 1.35rem; line-height: 1.7; color: var(--dark); margin-bottom: 2rem; font-weight: 500; }
        .article-body p { font-size: 1.1rem; line-height: 1.8; margin-bottom: 1.5rem; color: var(--gray-600); }
        .article-body h2 { font-family: var(--font-display); font-size: 1.75rem; font-weight: 900; margin: 3rem 0 1.5rem; color: var(--dark); }
        .article-body blockquote { border-left: 4px solid var(--category-color); padding-left: 1.5rem; margin: 2rem 0; font-family: var(--font-serif); font-size: 1.4rem; font-style: italic; color: var(--dark); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }

        .sources-box { margin-top: 3rem; padding: 2rem; background: var(--gray-100); border-left: 4px solid var(--category-color); border-radius: 0 var(--radius-md) var(--radius-md) 0; }
        .sources-box h3 { font-family: var(--font-body); font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--gray-600); margin-bottom: 1rem; }
        .sources-box ul { list-style: none; }
        .sources-box li { margin-bottom: 0.5rem; }
        .sources-box a { color: var(--category-color); font-size: 0.9rem; font-weight: 600; text-decoration: none; border-bottom: 1px solid transparent; transition: border-color 0.2s ease; }
        .sources-box a:hover { border-bottom-color: var(--category-color); }

        /* Related Articles */
        .related-section { background: var(--gray-100); padding: 4rem 2rem; margin-top: 4rem; }
        .related-inner { max-width: 1200px; margin: 0 auto; }
        .related-title { font-family: var(--font-display); font-size: 1.5rem; font-weight: 900; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 3px solid var(--dark); }
        .related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
        .related-card { background: white; border-radius: var(--radius-lg); overflow: hidden; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .related-card:hover { transform: translateY(-4px); box-shadow: 0 8px 30px rgba(0,0,0,0.1); }
        .related-card:hover h4 { color: var(--wgac-blue); }
        .related-card img { width: 100%; height: 180px; object-fit: cover; display: block; }
        .related-card-content { padding: 1.25rem; }
        .related-card h4 { font-family: var(--font-display); font-size: 1.1rem; font-weight: 800; line-height: 1.35; transition: color 0.2s ease; }

        /* Footer */
        .site-footer { background: var(--dark); color: var(--white); padding: 4rem 2rem; }
        .footer-content { max-width: 1400px; margin: 0 auto; display: flex; justify-content: space-between; align-items: flex-start; }
        .footer-brand { max-width: 320px; }
        .footer-logo { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 1rem; }
        .footer-logo .logo-text { font-size: 1rem; font-weight: 900; color: var(--white); text-transform: uppercase; letter-spacing: -0.03em; }
        .footer-logo .crap-box { background: var(--white); padding: 0.3rem 0.5rem; border-radius: 0.25rem; }
        .footer-logo .crap-box img { height: 0.9rem; filter: brightness(0) saturate(100%) invert(29%) sepia(98%) saturate(1654%) hue-rotate(221deg) brightness(101%) contrast(102%); }
        .footer-tagline { font-size: 0.9rem; color: var(--gray-400); }
        .footer-nav { display: flex; gap: 4rem; }
        .footer-col h4 { font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--gray-400); margin-bottom: 1rem; }
        .footer-col ul { list-style: none; }
        .footer-col li { margin-bottom: 0.5rem; }
        .footer-col a { font-size: 0.9rem; color: var(--white); opacity: 0.7; transition: opacity 0.2s; }
        .footer-col a:hover { opacity: 1; }
        .footer-attribution { max-width: 1400px; margin: 2rem auto 0; text-align: center; font-size: 0.85rem; color: var(--gray-400); display: flex; align-items: center; justify-content: center; gap: 0.75rem; }
        .wgac-footer-logo { height: 1.5rem; filter: brightness(0) invert(1); opacity: 0.7; transition: opacity 0.2s; }
        .wgac-footer-logo:hover { opacity: 1; }

        /* Responsive */
        @media (max-width: 1024px) {
            .related-grid { grid-template-columns: 1fr; }
            .footer-content { flex-direction: column; gap: 3rem; }
        }
        @media (max-width: 768px) {
            .header-top-bar { padding: 0.5rem 1rem; }
            .header-main { padding: 1rem; flex-direction: column; gap: 1rem; }
            .main-nav { flex-wrap: wrap; justify-content: center; }
            .article-hero-content { padding: 2rem 1.5rem; }
            .article-content { padding: 2rem 1.5rem; }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="site-header">
        <div class="header-top-bar">
            <span class="header-tagline">The antidote to doom-scrolling</span>
            <span class="header-date" data-timestamp="${isoTimestamp}">${fallbackTimestamp}</span>
        </div>
        <div class="header-main">
            <a href="../index.html" class="logo">
                <span class="logo-text">News That's Not</span>
                <div class="crap-box"><img src="../crap-logo-white.png" alt="crap"></div>
            </a>
            <nav class="main-nav">
                <a href="../index.html" class="nav-link">Today</a>
                <a href="../climate.html" class="nav-link${category === 'climate' ? ' active' : ''}">Climate</a>
                <a href="../health.html" class="nav-link${category === 'health' ? ' active' : ''}">Health</a>
                <a href="../science.html" class="nav-link${category === 'science' ? ' active' : ''}">Science</a>
                <a href="../people.html" class="nav-link${category === 'people' ? ' active' : ''}">People</a>
                <a href="../wildlife.html" class="nav-link${category === 'wildlife' ? ' active' : ''}">Wildlife</a>
                <a href="../cats.html" class="nav-link">Cats</a>
            </nav>
        </div>
    </header>

    <!-- Article Hero -->
    <div class="article-hero">
        <img src="${imageUrl}" alt="${escapeHtml(article.headline)}">
        <div class="article-hero-overlay"></div>
        <div class="article-hero-content">
            <span class="article-tag">${capitalize(category)}</span>
            <h1>${escapeHtml(article.headline)}</h1>
            <div class="article-meta">
                <span>By ${escapeHtml(article.author)}</span>
                <span>·</span>
                <span>${today}</span>
                <span>·</span>
                <span>${article.readTime} min read</span>
            </div>
        </div>
    </div>

    <!-- Article Content -->
    <article class="article-content">
        <p class="article-lead">
            ${escapeHtml(fullContent.lead)}
        </p>

        <div class="article-body">
${bodyParagraphs}
${pullQuoteHtml}
            <div class="sources-box">
                <h3>Original Source</h3>
                <ul>
                    <li><a href="${escapeHtml(article.sourceUrl)}" target="_blank">${escapeHtml(article.sourceName)}: ${escapeHtml(article.originalTitle)}</a></li>
                </ul>
            </div>
        </div>
    </article>

    <!-- Footer -->
    <footer class="site-footer">
        <div class="footer-content">
            <div class="footer-brand">
                <div class="footer-logo">
                    <span class="logo-text">News That's Not</span>
                    <div class="crap-box"><img src="../crap-logo-white.png" alt="crap"></div>
                </div>
                <p class="footer-tagline">The antidote to doom scrolling.</p>
            </div>
            <nav class="footer-nav">
                <div class="footer-col">
                    <h4>Sections</h4>
                    <ul>
                        <li><a href="../climate.html">Climate</a></li>
                        <li><a href="../health.html">Health</a></li>
                        <li><a href="../science.html">Science</a></li>
                        <li><a href="../people.html">People</a></li>
                        <li><a href="../wildlife.html">Wildlife</a></li>
                        <li><a href="../cats.html">Cats</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>About</h4>
                    <ul>
                        <li><a href="../mission.html">Our Mission</a></li>
                        <li><a href="../team.html">Team</a></li>
                        <li><a href="../contact.html">Contact</a></li>
                    </ul>
                </div>
            </nav>
        </div>
        <div class="footer-attribution">
            <span>Proudly produced by the very handsome people at</span>
            <a href="https://whogivesacrap.org" target="_blank">
                <img src="../WGAC-Logo-White.png" alt="Who Gives A Crap" class="wgac-footer-logo">
            </a>
        </div>
    </footer>
    <script data-timestamp-script>
      document.querySelectorAll('[data-timestamp]').forEach(function(el) {
        var iso = el.getAttribute('data-timestamp');
        if (iso) {
          var d = new Date(iso);
          var time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
          var dateStr = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
          el.textContent = 'Updated at ' + time + ' on ' + dateStr;
        }
      });
    </script>
</body>
</html>`;
}

// Generate all article pages
function generateArticlePages(articles) {
  console.log('Generating article pages...\n');

  // Ensure articles directory exists
  if (!fs.existsSync(ARTICLES_DIR)) {
    fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  }

  let generated = 0;
  for (const article of articles) {
    if (!article.slug) continue;

    const articlePath = path.join(ARTICLES_DIR, `${article.slug}.html`);
    const html = generateArticleHTML(article);
    fs.writeFileSync(articlePath, html);
    generated++;
    console.log(`  ✓ ${article.slug}.html`);
  }

  console.log(`\n✅ Generated ${generated} article pages`);
  return generated;
}

// Generate ticker content
function generateTickerContent(articles) {
  const items = articles.slice(0, 8).map(a => {
    const emoji = getEmoji(a.category);
    return `${emoji} ${escapeHtml(a.headline)}`;
  });
  const spacing = ' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ';
  const tickerText = items.join(spacing);
  return tickerText + spacing + tickerText;
}

// Generate hero HTML for homepage
function generateHeroHTML(article) {
  const tagClass = TAG_CLASSES[article.category] || 'tag-people';
  return `        <a href="articles/${article.slug}.html" class="hero">
        <div class="hero-image">
            <img src="${getImage(article, 0)}" alt="${escapeHtml(article.headline)}">
        </div>
        <div class="hero-overlay"></div>
        <div class="hero-content">
            <span class="hero-tag">${capitalize(article.category)}</span>
            <h1 class="hero-title">${escapeHtml(article.headline)}</h1>
            <p class="hero-excerpt">${escapeHtml(article.excerpt)}</p>
            <div class="hero-meta">
                <span>By ${escapeHtml(article.author)}</span>
                <span>${article.readTime} min read</span>
                <span>Source: ${escapeHtml(article.sourceName)}</span>
            </div>
        </div>
    </a>`;
}

// Generate featured card HTML for homepage
function generateFeaturedCardHTML(article, index) {
  const tagClass = TAG_CLASSES[article.category] || 'tag-people';
  const cardClass = index === 0 ? 'article-card featured' : 'article-card regular';

  return `            <a href="articles/${article.slug}.html" class="${cardClass}">
                <div class="card-inner">
                    <div class="card-image">
                        <img src="${getImage(article, index)}" alt="${escapeHtml(article.headline)}">
                    </div>
                    <div class="card-content">
                        <div class="card-tag ${tagClass}">${capitalize(article.category)}</div>
                        <h3 class="card-title">${escapeHtml(article.headline)}</h3>
                        <p class="card-excerpt">${escapeHtml(article.excerpt)}</p>
                        <div class="card-meta">By ${escapeHtml(article.author)} · ${article.readTime} min read · ${escapeHtml(article.sourceName)}</div>
                    </div>
                </div>
            </a>`;
}

// Generate vertical card HTML
function generateVerticalCardHTML(article, index) {
  const tagClass = TAG_CLASSES[article.category] || 'tag-people';

  return `            <a href="articles/${article.slug}.html" class="vertical-card">
                <div class="card-image">
                    <img src="${getImage(article, index)}" alt="${escapeHtml(article.headline)}">
                </div>
                <div class="card-content">
                    <div class="card-tag ${tagClass}">${capitalize(article.category)}</div>
                    <h3 class="card-title">${escapeHtml(article.headline)}</h3>
                    <p class="card-excerpt">${escapeHtml(article.excerpt)}</p>
                    <div class="card-meta">By ${escapeHtml(article.author)} · ${article.readTime} min read</div>
                </div>
            </a>`;
}

// Generate list item HTML
function generateListItemHTML(article, number) {
  return `                <a href="articles/${article.slug}.html" class="list-item">
                    <div class="list-number">${String(number).padStart(2, '0')}</div>
                    <div class="list-content">
                        <div class="list-tag">${capitalize(article.category)}</div>
                        <h4 class="list-title">${escapeHtml(article.headline)}</h4>
                    </div>
                </a>`;
}

// Update index.html with curated articles
function updateIndexHTML(curated) {
  const indexPath = path.join(ROOT_DIR, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  const today = formatDate(new Date());

  // Build allArticles from various possible structures
  let allArticles = curated.allArticles || [];
  if (allArticles.length === 0 && curated.homepage) {
    const h = curated.homepage.hero;
    const f = curated.homepage.featured || [];
    allArticles = [h, ...f].filter(Boolean);
  }
  if (allArticles.length === 0) {
    allArticles = [curated.hero, ...(curated.featured || []), ...(curated.more || [])].filter(Boolean);
  }

  // Get articles for homepage
  const hero = curated.homepage?.hero || curated.hero || allArticles[0];
  const featured = curated.homepage?.featured || curated.featured || allArticles.slice(1, 15);
  const more = curated.more || allArticles.slice(featured.length + 1, featured.length + 10);

  // If no hero, skip update
  if (!hero) {
    console.log('No hero article found, skipping homepage update');
    return;
  }

  // Update date in header with timestamp (stored as ISO for client-side timezone conversion)
  const now = new Date();
  const isoTimestamp = now.toISOString();
  const fallbackTimestamp = formatUpdateTimestamp(now);
  html = html.replace(
    /<span class="header-date"[^>]*>.*?<\/span>/,
    `<span class="header-date" data-timestamp="${isoTimestamp}">${fallbackTimestamp}</span>`
  );

  // Add timezone conversion script if not already present
  if (!html.includes('data-timestamp-script')) {
    html = html.replace('</body>', `${getTimezoneScript()}</body>`);
  }

  // Update ticker content
  const tickerArticles = [hero, ...featured, ...more].filter(Boolean);
  const tickerContent = generateTickerContent(tickerArticles);
  html = html.replace(
    /<div class="ticker-content">[\s\S]*?<\/div>/,
    `<div class="ticker-content">\n            ${tickerContent}\n        </div>`
  );

  // Update hero section
  const heroHTML = generateHeroHTML(hero);
  html = html.replace(
    /<!-- Hero -->\s*<a href="[^"]*"[^>]*class="hero">[\s\S]*?<\/a>/,
    `<!-- Hero -->\n    ${heroHTML}`
  );

  // Update featured grid (first 3 featured)
  const featuredHTML = featured.slice(0, 3).map((a, i) =>
    generateFeaturedCardHTML(a, i)
  ).join('\n\n');

  html = html.replace(
    /<div class="featured-grid">[\s\S]*?<\/div>\s*(?=\s*<!-- Three Column Grid -->)/,
    `<div class="featured-grid">\n${featuredHTML}\n        </div>\n\n        `
  );

  // Update three-column grid
  const threeColArticles = featured.slice(3, 6);
  const threeColHTML = threeColArticles.map((a, i) =>
    generateVerticalCardHTML(a, i)
  ).join('\n\n');

  html = html.replace(
    /<div class="three-col-grid">[\s\S]*?<\/div>\s*(?=\s*<!-- Data Section -->)/,
    `<div class="three-col-grid">\n${threeColHTML}\n        </div>\n\n        `
  );

  // Update list section (next 5 articles)
  const listArticles = [...featured.slice(6), ...more].slice(0, 5);
  const listHTML = listArticles.map((a, i) =>
    generateListItemHTML(a, i + 1)
  ).join('\n\n');

  html = html.replace(
    /<div class="list-grid">[\s\S]*?<\/div>\s*(?=\s*<\/div>\s*(?:<!-- Newsletter -->|<section class="newsletter"))/,
    `<div class="list-grid">\n${listHTML}\n            </div>\n        `
  );

  fs.writeFileSync(indexPath, html);
  console.log('✅ Updated index.html');
}

// Generate section card for section pages (featured style)
function generateSectionFeaturedCardHTML(article, index, isFirst = false) {
  const tagClass = TAG_CLASSES[article.category] || 'tag-people';
  const cardClass = isFirst ? 'article-card featured' : 'article-card regular';

  return `            <a href="articles/${article.slug}.html" class="${cardClass}">
                <div class="card-inner">
                    <div class="card-image">
                        <img src="${getImage(article, index)}" alt="${escapeHtml(article.headline)}">
                    </div>
                    <div class="card-content">
                        <div class="card-tag">${capitalize(article.category)}</div>
                        <h3 class="card-title">${escapeHtml(article.headline)}</h3>
                        <p class="card-excerpt">${escapeHtml(article.excerpt)}</p>
                        <div class="card-meta">By ${escapeHtml(article.author)} · ${article.readTime} min read</div>
                    </div>
                </div>
            </a>`;
}

// Generate section vertical card
function generateSectionVerticalCardHTML(article, index) {
  const tagClass = TAG_CLASSES[article.category] || 'tag-people';

  return `            <a href="articles/${article.slug}.html" class="vertical-card">
                <div class="card-image">
                    <img src="${getImage(article, index)}" alt="${escapeHtml(article.headline)}">
                </div>
                <div class="card-content">
                    <div class="card-tag">${capitalize(article.category)}</div>
                    <h3 class="card-title">${escapeHtml(article.headline)}</h3>
                    <p class="card-excerpt">${escapeHtml(article.excerpt)}</p>
                    <div class="card-meta">By ${escapeHtml(article.author)} · ${article.readTime} min read</div>
                </div>
            </a>`;
}

// Update a section page
function updateSectionPage(category, articles) {
  const sectionPath = path.join(ROOT_DIR, `${category}.html`);

  if (!fs.existsSync(sectionPath)) {
    console.log(`  ⚠️ ${category}.html not found, skipping`);
    return;
  }

  let html = fs.readFileSync(sectionPath, 'utf8');

  // Update date with timestamp (stored as ISO for client-side timezone conversion)
  const now = new Date();
  const isoTimestamp = now.toISOString();
  const fallbackTimestamp = formatUpdateTimestamp(now);
  html = html.replace(
    /<span class="header-date"[^>]*>.*?<\/span>/,
    `<span class="header-date" data-timestamp="${isoTimestamp}">${fallbackTimestamp}</span>`
  );

  // Add timezone conversion script if not already present
  if (!html.includes('data-timestamp-script')) {
    html = html.replace('</body>', `${getTimezoneScript()}</body>`);
  }

  // Take first 20 articles for this section
  const sectionArticles = articles.slice(0, 20);

  if (sectionArticles.length === 0) {
    console.log(`  ⚠️ No articles for ${category}`);
    return;
  }

  // Featured grid: first article (featured) + next 2 (regular)
  const featuredGridHTML = sectionArticles.slice(0, 3).map((a, i) =>
    generateSectionFeaturedCardHTML(a, i, i === 0)
  ).join('\n\n');

  html = html.replace(
    /<div class="featured-grid">[\s\S]*?<\/div>\s*(?=\s*<div class="section-header">)/,
    `<div class="featured-grid">\n${featuredGridHTML}\n        </div>\n\n        `
  );

  // Three-column grid: remaining articles
  const threeColArticles = sectionArticles.slice(3, 9);
  if (threeColArticles.length > 0) {
    const threeColHTML = threeColArticles.map((a, i) =>
      generateSectionVerticalCardHTML(a, i)
    ).join('\n\n');

    html = html.replace(
      /<div class="three-col-grid">[\s\S]*?<\/div>\s*(?=\s*<\/main>)/,
      `<div class="three-col-grid">\n${threeColHTML}\n        </div>\n    `
    );
  }

  fs.writeFileSync(sectionPath, html);
  console.log(`  ✓ Updated ${category}.html with ${sectionArticles.length} articles`);
}

// Update all section pages
function updateSectionPages(curated) {
  console.log('\nUpdating section pages...\n');

  // Build allArticles from various possible structures
  let allArticles = curated.allArticles || [];
  if (allArticles.length === 0 && curated.homepage) {
    const h = curated.homepage.hero;
    const f = curated.homepage.featured || [];
    allArticles = [h, ...f].filter(Boolean);
  }
  if (allArticles.length === 0) {
    allArticles = [curated.hero, ...(curated.featured || []), ...(curated.more || [])].filter(Boolean);
  }

  for (const category of CATEGORIES) {
    // Get articles for this category from sections or filter from allArticles
    const categoryArticles = curated.sections?.[category] ||
      allArticles.filter(a => a.category === category);

    updateSectionPage(category, categoryArticles);
  }

  console.log('\n✅ Updated all section pages');
}

// Update timestamps on all static pages (cats, archive, mission, team, contact)
function updateAllPageTimestamps() {
  console.log('\nUpdating timestamps on all pages...\n');

  const staticPages = ['cats.html', 'archive.html', 'mission.html', 'team.html', 'contact.html'];
  const now = new Date();
  const isoTimestamp = now.toISOString();
  const fallbackTimestamp = formatUpdateTimestamp(now);

  for (const pageName of staticPages) {
    const pagePath = path.join(ROOT_DIR, pageName);

    if (!fs.existsSync(pagePath)) {
      continue;
    }

    let html = fs.readFileSync(pagePath, 'utf8');

    // Update the header-date span with timestamp
    const hasHeaderDate = html.includes('header-date');
    if (hasHeaderDate) {
      html = html.replace(
        /<span class="header-date"[^>]*>.*?<\/span>/,
        `<span class="header-date" data-timestamp="${isoTimestamp}">${fallbackTimestamp}</span>`
      );

      // Add timezone conversion script if not already present
      if (!html.includes('data-timestamp-script')) {
        html = html.replace('</body>', `${getTimezoneScript()}</body>`);
      }

      fs.writeFileSync(pagePath, html);
      console.log(`  ✓ Updated ${pageName}`);
    }
  }
}

// Maintain article archive - NEVER delete old articles
function updateArticleArchive(articles) {
  const archivePath = path.join(DATA_DIR, 'article-archive.json');

  // Load existing archive or create new one
  let archive = { articles: [], lastUpdated: null };
  if (fs.existsSync(archivePath)) {
    try {
      archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
    } catch (e) {
      console.log('  Creating new archive...');
    }
  }

  // Get existing slugs to avoid duplicates
  const existingSlugs = new Set(archive.articles.map(a => a.slug));
  const today = new Date().toISOString().split('T')[0];

  // Add new articles to archive
  let addedCount = 0;
  for (const article of articles) {
    if (!article.slug) continue;
    if (existingSlugs.has(article.slug)) continue;

    // Add to archive with metadata
    archive.articles.push({
      slug: article.slug,
      headline: article.headline,
      excerpt: article.excerpt,
      category: article.category,
      author: article.author,
      readTime: article.readTime,
      imageUrl: article.imageUrl,
      sourceUrl: article.sourceUrl,
      sourceName: article.sourceName,
      publishedDate: today,
      archivedAt: new Date().toISOString()
    });
    addedCount++;
  }

  // Sort by date descending
  archive.articles.sort((a, b) =>
    new Date(b.archivedAt || b.publishedDate) - new Date(a.archivedAt || a.publishedDate)
  );

  archive.lastUpdated = new Date().toISOString();
  archive.totalArticles = archive.articles.length;

  // Save archive
  fs.writeFileSync(archivePath, JSON.stringify(archive, null, 2));
  console.log(`\n✅ Archive updated: ${addedCount} new articles added (${archive.totalArticles} total)`);

  return archive;
}

// Main function
export async function generateSite() {
  console.log('=== Generating site HTML ===\n');

  // Load curated articles
  const curatedPath = path.join(DATA_DIR, 'curated-articles.json');
  if (!fs.existsSync(curatedPath)) {
    console.error('No curated articles found. Run curate-with-ai.js first.');
    process.exit(1);
  }

  const curated = JSON.parse(fs.readFileSync(curatedPath, 'utf8'));

  // Check if articles have been published (reviewed and approved)
  // Skip generation if articles are still pending review
  if (!curated.publishedAt && !curated.autoPublished && !process.env.FORCE_GENERATE) {
    console.log('Articles pending review - skipping site generation.');
    console.log('Use review.html to approve articles, or set FORCE_GENERATE=1 to override.');
    return { articlesGenerated: 0, skipped: true };
  }

  console.log(curated.autoPublished ? '(Auto-published)' : `(Published at ${curated.publishedAt})`);

  // Build allArticles from various possible structures
  let allArticles = curated.allArticles || [];

  // If no allArticles, try to build from homepage structure
  if (allArticles.length === 0 && curated.homepage) {
    const hero = curated.homepage.hero;
    const featured = curated.homepage.featured || [];
    allArticles = [hero, ...featured].filter(Boolean);
  }

  // Fall back to old root-level structure
  if (allArticles.length === 0) {
    allArticles = [curated.hero, ...(curated.featured || []), ...(curated.more || [])].filter(Boolean);
  }

  // If still no articles, exit gracefully
  if (allArticles.length === 0) {
    console.log('No articles found in curated-articles.json. Skipping generation.');
    return { articlesGenerated: 0 };
  }

  console.log(`Loaded ${allArticles.length} curated articles\n`);

  // Step 1: Generate article pages (NEVER deletes old files)
  generateArticlePages(allArticles);

  // Step 2: Add to article archive (preserves all historical articles)
  updateArticleArchive(allArticles);

  // Step 3: Update main index page
  console.log('\nUpdating homepage...\n');
  updateIndexHTML(curated);

  // Step 4: Update section pages
  updateSectionPages(curated);

  // Step 5: Update timestamps on all other pages
  updateAllPageTimestamps();

  // Step 6: Save generation metadata
  const metaPath = path.join(DATA_DIR, 'last-update.json');
  const existingMeta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    : {};

  fs.writeFileSync(metaPath, JSON.stringify({
    ...existingMeta,
    siteGeneratedAt: new Date().toISOString(),
    articlePagesGenerated: allArticles.length,
    categoryCounts: Object.fromEntries(
      CATEGORIES.map(cat => [
        cat,
        (curated.sections?.[cat] || allArticles.filter(a => a.category === cat)).length
      ])
    )
  }, null, 2));

  console.log('\n🎉 Site generation complete!');
  return { articlesGenerated: allArticles.length };
}

// Run if called directly
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  generateSite().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

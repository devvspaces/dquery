import axios from 'axios';

async function scrapeSpaceship() {
  const url =
    'https://www.spaceship.com/domain-search/?query=zioncostinghomes.com&beast=false&tab=domains';
  console.log('Fetching Spaceship search page...');

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    console.log('Response Status:', response.status);
    const html = response.data;
    console.log('HTML Length:', html.length);

    // Let's search if there are any inline script tags containing JSON data or pricing
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let count = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
      const scriptContent = match[1];
      if (
        scriptContent.includes('window.__') ||
        scriptContent.includes('bootstrap') ||
        scriptContent.includes('pricing') ||
        scriptContent.includes('initialState')
      ) {
        console.log(`\nScript #${++count} snippet:`);
        console.log(scriptContent.slice(0, 500));
      }
    }

    // Let's also check if there are any meta tags or link tags with pricing
    if (html.includes('pricing') || html.includes('price')) {
      console.log('HTML contains the word "pricing" or "price".');
    }
  } catch (error: any) {
    console.error('Error fetching page:', error.message);
  }
}

scrapeSpaceship();

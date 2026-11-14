import puppeteer from 'puppeteer-core';

async function testPuppeteer() {
  const chromePath =
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  console.log('Launching Google Chrome with stealth arguments...');

  try {
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true, // We can run headless or headful. Let's test headless first with stealth args.
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled', // Evade webdriver check
        '--window-size=1280,800',
        '--lang=en-US,en;q=0.9',
      ],
    });

    const page = await browser.newPage();

    // Set custom user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    const targetUrl =
      'https://www.spaceship.com/domain-search/?query=zioncostinghomes.com&beast=false&tab=domains';
    console.log('Navigating to:', targetUrl);

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    console.log(
      'Navigation settled. Waiting 5s for search results to render...',
    );

    await new Promise((r) => setTimeout(r, 5000));

    // Let's print page title and check if Cloudflare blocked us
    const title = await page.title();
    console.log('Page Title:', title);

    if (title.includes('Just a moment')) {
      console.log('❌ Cloudflare challenge page is still present. Blocked!');
      // Dump body HTML for debug
      const bodyHTML = await page.evaluate(() => document.body.innerHTML);
      console.log('Body HTML length:', bodyHTML.length);
    } else {
      console.log('✅ Bypassed Cloudflare Turnstile successfully!');

      // Let's dump text on the page containing '$' to see what prices are rendered
      const prices = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        return elements
          .map((el) => (el.textContent || '').trim())
          .filter((txt) => txt.includes('$') && txt.length < 50)
          .filter((v, i, a) => a.indexOf(v) === i); // Unique
      });

      console.log('Found prices on page:', prices);

      // Let's search for elements containing zioncostinghomes.com
      const elementsWithQuery = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        return elements
          .filter(
            (el) =>
              (el.textContent || '').includes('zioncostinghomes.com') &&
              el.children.length === 0,
          )
          .map((el) => ({
            tagName: el.tagName,
            className: el.className,
            text: el.textContent?.trim(),
            html: el.outerHTML,
          }));
      });

      console.log(
        'Elements with query:',
        JSON.stringify(elementsWithQuery, null, 2),
      );

      // Dump a snippet of the page HTML around domain check container
      const containerHTML = await page.evaluate(() => {
        const container = document.querySelector(
          '[class*="search"], [class*="result"], [id*="search"]',
        );
        return container
          ? container.outerHTML.slice(0, 1000)
          : 'No container found';
      });
      console.log('Container snippet:', containerHTML);
    }

    await browser.close();
  } catch (error: any) {
    console.error('Puppeteer scraper error:', error.message);
  }
}

testPuppeteer();

import puppeteer from 'puppeteer-core';

async function testPuppeteerDom() {
  const chromePath =
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  console.log('Launching Chrome to inspect DOM structure...');

  try {
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800',
        '--lang=en-US,en;q=0.9',
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    await page.setViewport({ width: 1280, height: 800 });

    const targetUrl =
      'https://www.spaceship.com/domain-search/?query=zioncostinghomes.com&beast=false&tab=domains';
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    console.log('Page loaded. Waiting 6 seconds...');
    await new Promise((r) => setTimeout(r, 6000));

    const data = await page.evaluate(() => {
      // Find all elements that look like domain names (e.g. zioncostinghomes.com, zioncostinghomes.net, etc.)
      const elements = Array.from(document.querySelectorAll('*'));
      const domainMatches = elements.filter((el) => {
        const text = (el.textContent || '').trim();
        return (
          el.children.length === 0 && /^[a-z0-9-]+\.[a-z]{2,10}$/i.test(text)
        );
      });

      const cards: any[] = [];
      for (const el of domainMatches) {
        const domainName = el.textContent?.trim() || '';

        // Go up to find the card container that contains the price
        let current = el.parentElement as any;
        let cardContainer = null as any;

        // Let's traverse up to 8 levels
        for (let i = 0; i < 8; i++) {
          if (!current) break;
          // Check if this container contains a dollar sign
          if (current.textContent && current.textContent.includes('$')) {
            cardContainer = current;
            break;
          }
          current = current.parentElement;
        }

        if (cardContainer) {
          // Let's get all nested text elements under this card container
          const allTextElements = Array.from(
            cardContainer.querySelectorAll('*'),
          )
            .filter(
              (child: any) =>
                child.children.length === 0 && child.textContent?.trim(),
            )
            .map((child: any) => ({
              tag: child.tagName,
              class: child.className,
              text: child.textContent?.trim(),
            }));

          cards.push({
            domainName,
            cardText: cardContainer.textContent?.replace(/\s+/g, ' ').trim(),
            textElements: allTextElements,
            outerHTML: cardContainer.outerHTML.slice(0, 1500),
          });
        }
      }
      return cards;
    });

    console.log(`Found ${data.length} domain cards:`);
    for (const card of data.slice(0, 5)) {
      console.log('\n----------------------------------------');
      console.log('Domain:', card.domainName);
      console.log('Text Content:', card.cardText);
      console.log('Key text elements:');
      console.log(
        card.textElements.filter(
          (t: any) => t.text.includes('$') || t.text.includes('yr'),
        ),
      );
    }

    await browser.close();
  } catch (error: any) {
    console.error('Puppeteer DOM test error:', error.message);
  }
}

testPuppeteerDom();

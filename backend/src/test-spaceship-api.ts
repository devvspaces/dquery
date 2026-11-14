import axios from 'axios';

async function testSpaceshipApi() {
  console.log('Testing Spaceship pricing BFF API...');

  const url =
    'https://www.spaceship.com/gateway/api/v1/pricing-bff/price/getPrices';

  const payload = {
    currencies: ['USD'],
    products: [
      {
        priceTypes: ['purchase', 'renewal'],
        product: {
          productSlug: 'com',
          plan: {
            pricingPlanParams: {
              transfer: 0,
              sld: 'zioncostinghomes',
            },
            pricingPlanSlug: 'regular',
            period: 'P1Y',
          },
        },
      },
      {
        priceTypes: ['purchase', 'renewal'],
        product: {
          productSlug: 'net',
          plan: {
            pricingPlanParams: {
              transfer: 0,
              sld: 'zioncostinghomes',
            },
            pricingPlanSlug: 'regular',
            period: 'P1Y',
          },
        },
      },
      {
        priceTypes: ['purchase', 'renewal'],
        product: {
          productSlug: 'io',
          plan: {
            pricingPlanParams: {
              transfer: 0,
              sld: 'zioncostinghomes',
            },
            pricingPlanSlug: 'regular',
            period: 'P1Y',
          },
        },
      },
    ],
    includeFields: [
      'components',
      'modifiers',
      'params',
      'discount',
      'pricePerPeriod',
      'outputValues',
      'reducers',
    ],
    includeBasePrice: true,
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        origin: 'https://www.spaceship.com',
        referer:
          'https://www.spaceship.com/domain-search/?query=zioncostinghomes.com&beast=false&tab=domains',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'z-currency': 'USD',
      },
    });

    console.log('Success! Status:', response.status);
    console.log('Response keys:', Object.keys(response.data));

    // Let's print out the exact structure of the pricing response
    console.log('Data:', JSON.stringify(response.data, null, 2).slice(0, 2000));
  } catch (error: any) {
    console.error('Failed to query Spaceship API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Body:', JSON.stringify(error.response.data));
    }
  }
}

testSpaceshipApi();

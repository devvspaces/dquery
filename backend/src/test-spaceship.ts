import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testSpaceshipPricing() {
  const apiKey = process.env.SPACESHIP_API_KEY || '';
  const apiSecret = process.env.SPACESHIP_API_SECRET || '';
  const baseUrl =
    process.env.SPACESHIP_API_URL || 'https://spaceship.dev/api/v1';

  console.log('Spaceship Config:', {
    apiKey: apiKey.slice(0, 5) + '...',
    baseUrl,
  });

  const client = axios.create({
    baseURL: baseUrl,
    headers: {
      'X-API-Key': apiKey,
      'X-API-Secret': apiSecret,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  const endpoints = [
    '/products/prices?productType=domain',
    '/products/prices',
    '/tld/prices',
    '/tlds/prices',
    '/tlds',
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\nTesting endpoint: ${endpoint}`);
      const response = await client.get(endpoint);
      console.log(`Success! Status: ${response.status}`);
      console.log('Keys:', Object.keys(response.data));
      console.log(
        'Sample data:',
        JSON.stringify(response.data, null, 2).slice(0, 1000),
      );
      break; // stop at first working one
    } catch (error: any) {
      console.error(`Failed: ${error.message}`);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data));
      }
    }
  }
}

testSpaceshipPricing();

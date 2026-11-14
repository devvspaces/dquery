import { parseStringPromise } from 'xml2js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testPricing() {
  const apiUser = process.env.NAMECHEAP_API_USER || '';
  const apiKey = process.env.NAMECHEAP_API_KEY || '';
  const username = process.env.NAMECHEAP_USERNAME || '';
  const clientIp = process.env.NAMECHEAP_CLIENT_IP || '127.0.0.1';
  const baseUrl =
    process.env.NAMECHEAP_API_URL || 'https://api.namecheap.com/xml.response';

  console.log('Namecheap Config:', { apiUser, username, clientIp, baseUrl });

  const buildUrl = (command: string, params: Record<string, string> = {}) => {
    const baseParams = {
      ApiUser: apiUser,
      ApiKey: apiKey,
      UserName: username,
      ClientIp: clientIp,
      Command: command,
    };
    const allParams = { ...baseParams, ...params };
    const queryString = Object.entries(allParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    return `${baseUrl}?${queryString}`;
  };

  try {
    const url = buildUrl('namecheap.users.getPricing', {
      ProductType: 'DOMAIN',
    });
    console.log('Requesting Namecheap Pricing API...');
    const response = await axios.get(url);
    console.log('Response status:', response.status);

    const parsed = await parseStringPromise(response.data, {
      explicitArray: false,
      mergeAttrs: true,
    });

    console.log('Parsed API Status:', parsed.ApiResponse?.Status);
    if (parsed.ApiResponse?.Status === 'ERROR') {
      console.error('API Error:', JSON.stringify(parsed.ApiResponse.Errors));
      return;
    }

    const commandResponse = parsed.ApiResponse?.CommandResponse;
    const pricingResult = commandResponse?.UserGetPricingResult;
    console.log(
      'Found UserGetPricingResult keys:',
      Object.keys(pricingResult || {}),
    );

    const productType = pricingResult?.ProductType;
    console.log(
      'ProductType name:',
      productType?.Name || productType?.['Name'],
    );

    // Let's dump a slice of it to see
    console.log(
      'Sample data:',
      JSON.stringify(productType, null, 2).slice(0, 1000),
    );
  } catch (error) {
    console.error('Error fetching Namecheap pricing:', error);
  }
}

testPricing();

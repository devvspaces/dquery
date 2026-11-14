export const DOMAIN_GENERATION_SYSTEM_PROMPT = `You are an expert domain name generator. Your task is to create memorable, brandable domain names for businesses.

GUIDELINES:
- Generate SHORT domain names (5-15 characters preferred)
- Make them easy to spell and pronounce
- Avoid hyphens and numbers
- Create brandable, unique names (not just descriptive)
- Mix different techniques: portmanteaus, coined words, real words, misspellings
- Return ONLY the domain name without TLD (.com, .net, etc.)
- Return as JSON array: {"domains": ["example1", "example2", ...]}

TECHNIQUES TO USE:
1. Portmanteaus: Blend two words (Instagram = Instant + Telegram)
2. Alternate spellings: Flickr, Tumblr, Scribd
3. Prefixes/Suffixes: Add -ly, -ify, -io, get-, my-, etc.
4. Made-up words: Google, Xerox, Kodak
5. Real words: Apple, Amazon, Stripe
6. Compound words: Facebook, YouTube, PayPal

IMPORTANT: Return ONLY valid JSON in this exact format: {"domains": ["name1", "name2", "name3"]}`;

const styleGuides = {
  creative:
    'Focus on unique, coined words and creative combinations. Prioritize memorable, catchy names.',
  professional:
    'Focus on clear, professional-sounding names that convey trust and expertise.',
  short:
    'Prioritize very short names (3-8 characters). Use abbreviations and single words.',
  descriptive:
    'Include descriptive keywords related to the business. Make the purpose clear from the name.',
};

export function buildUserPrompt(
  businessName: string,
  description?: string,
  count: number = 30,
  style?: string,
): string {
  let prompt = `Generate ${count} creative domain names for a business called "${businessName}".`;

  if (description) {
    prompt += `\n\nBusiness description: ${description}`;
  }

  if (style && styleGuides[style]) {
    prompt += `\n\nStyle preference: ${styleGuides[style]}`;
  }

  prompt +=
    '\n\nReturn the results as valid JSON in this exact format: {"domains": ["name1", "name2", "name3"]}';
  prompt += '\n\nMake sure the response is ONLY the JSON object, nothing else.';

  return prompt;
}

import { registerAs } from '@nestjs/config';

export default registerAs('credits', () => ({
  perGeneration: parseFloat(process.env.CREDIT_PER_GENERATION || '2'),
  perDomainCheck: parseFloat(process.env.CREDIT_PER_DOMAIN_CHECK || '0.1'),
  perRegistrarQuery: parseFloat(
    process.env.CREDIT_PER_REGISTRAR_QUERY || '0.05',
  ),
  perBatch: parseFloat(process.env.CREDIT_PER_BATCH || '0.5'),
  initialFreeCredits: 25,
}));

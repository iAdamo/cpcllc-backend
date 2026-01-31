import { Model } from 'mongoose';
import { Terms } from '@users/schemas/terms.schema';
import { TermsType } from '@users/schemas/terms.schema';

export async function seedTerms(termsModel: Model<Terms>) {
  const now = new Date();

  const termsToSeed = [
    {
      termsType: TermsType.SERVICE,
      version: 'v1.0',
      contentUrl: 'https://companiescenter.com/terms-of-service',
      isActive: true,
      effectiveFrom: now,
    },
    {
      termsType: TermsType.PRIVACY,
      version: 'v1.0',
      contentUrl: 'https://companiescenter.com/privacy-policy',
      isActive: true,
      effectiveFrom: now,
    },
  ];

  for (const terms of termsToSeed) {
    const exists = await termsModel.findOne({
      termsType: terms.termsType,
      isActive: true,
    });

    if (exists) {
      console.log(
        `[TERMS SEED] ${terms.termsType} already exists (v${exists.version})`,
      );
      continue;
    }

    await termsModel.create(terms);
    console.log(`[TERMS SEED] Created ${terms.termsType} terms`);
  }
}

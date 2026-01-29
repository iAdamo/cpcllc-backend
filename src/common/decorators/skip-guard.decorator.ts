import { SetMetadata } from '@nestjs/common';

export const SKIP_TERMS_KEY = 'skipTerms';
export const SkipTerms = () => SetMetadata(SKIP_TERMS_KEY, true);


export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

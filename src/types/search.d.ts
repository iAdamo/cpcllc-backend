// interface SearchParams {
//   page: string;
//   limit: string;
//   model: string;
//   radius: string;
//   engine: string;
//   searchInput?: string;
//   lat?: string;
//   long?: string;
//   address?: string;
//   sortBy?: string[];
//   categories?: string[];
// }

// interface SearchResult {
//   providers?: Provider[];
//   services?: Service[];
//   jobs?: JobPost[];
//   totalPages: number;
//   page: number;
//   hasExactResults: boolean;
// }

// src/types/search.ts

export interface SearchParams {
  page: string;
  limit: string;
  model: string;
  engine?: string;
  searchInput?: string;
  lat?: string;
  long?: string;
  address?: string;
  radius?: string;
  sortBy?: string[];
  categories?: string[];
  featured?: string; // Add featured parameter
  state?: string;    // Add state parameter
  country?: string;  // Add country parameter
}

export interface SearchResult {
  providers?: any[];
  services?: any[];
  jobs?: any[];
  totalPages: number;
  page: number;
  hasExactResults: boolean;
  featuredRatio?: number; // Add featured ratio to response
}

interface PaginationConfig {
  page: number;
  limit: number;
  skip: number;
}

// Media feed response interfaces
export interface MediaVideoItem {
  type: 'video';
  video: {
    type: string;
    url: string;
    thumbnail?: string | null;
    index?: number;
    [key: string]: any;
  };
  provider: {
    _id: any;
    providerName: string;
    providerLogo?: any;
    isVerified?: boolean;
    isFeatured?: boolean;
    averageRating?: number;
    reviewCount?: number;
    location?: any;
    [key: string]: any;
  };
}

export interface MediaAdItem {
  type: 'ad';
  provider: {
    _id: any;
    providerName: string;
    providerLogo?: any;
    isFeatured?: boolean;
    [key: string]: any;
  };
}

export type MediaFeedItem = MediaVideoItem | MediaAdItem;

export interface MediaFeedResponse {
  items: MediaFeedItem[];
  page: number;
  hasMore: boolean;
}

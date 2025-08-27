export const SEARCH_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  DEFAULT_SORT_BY: 'popularity' as const,
  DEFAULT_SORT_ORDER: 'desc' as const,
  DEBOUNCE_DELAY: 300,
  MAX_SEARCH_RESULTS: 1000
} as const;

export const PRODUCT_CATEGORIES = [
  { value: 'booster-packs', label: 'Booster Packs' },
  { value: 'theme-decks', label: 'Theme Decks' },
  { value: 'collection-boxes', label: 'Collection Boxes' },
  { value: 'tins', label: 'Tins' },
  { value: 'accessories', label: 'Accessories' }
] as const;

export const SUPPORTED_RETAILERS = [
  { value: 'bestbuy', label: 'Best Buy' },
  { value: 'walmart', label: 'Walmart' },
  { value: 'costco', label: 'Costco' },
  { value: 'samsclub', label: 'Sam\'s Club' }
] as const;

export const SORT_OPTIONS = [
  { value: 'popularity', label: 'Popularity' },
  { value: 'price', label: 'Price' },
  { value: 'name', label: 'Name' },
  { value: 'releaseDate', label: 'Release Date' }
] as const;
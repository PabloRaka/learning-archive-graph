// Curated palette of premium accent colors optimized for dark theme
export const CURATED_ACCENTS = [
  '#76b900', // Sleek green (default)
  '#60a5fa', // Soft Blue
  '#c084fc', // Bright Purple
  '#f472b6', // Pink
  '#fb923c', // Orange
  '#2dd4bf', // Teal
  '#facc15', // Yellow
  '#38bdf8', // Sky
  '#fb7185', // Rose
  '#a3e635', // Lime
];

/**
 * Returns a stable accent color from the curated palette based on a hash of the category name.
 * Falls back to a default soft blue if name is unknown or missing.
 */
export const getCategoryColor = (categoryName?: string | null): string => {
  if (!categoryName || categoryName === 'Unknown') {
    return '#60a5fa'; // soft blue fallback
  }
  
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % CURATED_ACCENTS.length;
  return CURATED_ACCENTS[index];
};

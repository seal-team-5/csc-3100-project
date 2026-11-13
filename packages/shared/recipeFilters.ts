export type RecipeFilter = { name: string; type: string };

// Only explicit source labels are used; ingredients do not establish dietary safety.
export const FILTER_GROUPS = [
  { type: 'cuisine', label: 'Cuisine' },
  { type: 'protein', label: 'Main ingredient' },
  { type: 'meal', label: 'Meal type' },
  { type: 'diet', label: 'Dietary preference' },
  { type: 'life_stage', label: 'Life stage' },
  { type: 'method', label: 'Cooking method' },
  { type: 'dish', label: 'Dish type' },
] as const;

export const PREGNANCY_FILTER: RecipeFilter = {
  type: 'life_stage',
  name: 'Pregnancy',
};

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const cuisines = [
  'Afghan',
  'Albanian',
  'Algerian',
  'American',
  'Argentinian',
  'Australian',
  'Austrian',
  'Bangladeshi',
  'Belgian',
  'Brazilian',
  'British',
  'Canadian',
  'Chinese',
  'Croatian',
  'Cypriot',
  'Czech',
  'Danish',
  'Dutch',
  'Egyptian',
  'Filipino',
  'Finnish',
  'French',
  'German',
  'Greek',
  'Hungarian',
  'Indian',
  'Indonesian',
  'Iranian',
  'Irish',
  'Israeli',
  'Italian',
  'Jamaican',
  'Japanese',
  'Kenyan',
  'Korean',
  'Lebanese',
  'Malaysian',
  'Maltese',
  'Mexican',
  'Moroccan',
  'New Zealand',
  'Nigerian',
  'Norwegian',
  'Pakistani',
  'Palestinian',
  'Peruvian',
  'Polish',
  'Portuguese',
  'Romanian',
  'Russian',
  'Saudi Arabian',
  'Scottish',
  'Slovakian',
  'South African',
  'Spanish',
  'Sri Lankan',
  'Swedish',
  'Swiss',
  'Syrian',
  'Thai',
  'Tunisian',
  'Turkish',
  'Ukrainian',
  'Uruguayan',
  'Venezuelan',
  'Vietnamese',
  'Welsh',
];
const cuisineNames = new Map(cuisines.map((name) => [key(name), name]));
const labels = new Map<string, RecipeFilter>();

function define(type: string, name: string, ...aliases: string[]) {
  for (const label of [name, ...aliases])
    labels.set(key(label), { name, type });
}

define('protein', 'Beef');
define('protein', 'Chicken');
define('protein', 'Lamb');
define('protein', 'Pork');
define('protein', 'Goat');
define('protein', 'Fish');
define('meal', 'Breakfast');
define('meal', 'Starter', 'Starters', 'Appetizer', 'Appetizers');
define('meal', 'Side dish', 'Side', 'Sides', 'Side dishes');
define('meal', 'Dessert', 'Desserts', 'Pudding');
define('meal', 'Snack', 'Snacks');
define('diet', 'Vegetarian');
define('diet', 'Vegan');
define(
  PREGNANCY_FILTER.type,
  PREGNANCY_FILTER.name,
  'Pregnant',
  'Pregnancy friendly'
);
define('method', 'Baking', 'Baked', 'Bake');
define('method', 'Grilling', 'Grilled', 'BBQ', 'Barbecue');
define('method', 'Roasting', 'Roast', 'Roasted');
define('method', 'Frying', 'Fried', 'Deep fried', 'DeepFry');
define('method', 'Stir-frying', 'Stir fry', 'Stir-fried');
define('method', 'Steaming', 'Steamed');
define('method', 'Slow cooking', 'Slow cooked', 'Slow cooker');
define('dish', 'Pasta');
define('dish', 'Soup', 'Soups');
define('dish', 'Salad', 'Salads');
define('dish', 'Curry', 'Curries');
define('dish', 'Stew', 'Stews');
define('dish', 'Casserole', 'Casseroles');
define('dish', 'Sandwich', 'Sandwiches');
define('dish', 'Pizza');
define('dish', 'Pie', 'Pies');
define('dish', 'Bread');
define('dish', 'Cake', 'Cakes');
define('protein', 'Seafood', 'Sea food', 'Shellfish');

/** Normalize both legacy database filters and newly imported API labels. */
export function normalizeRecipeFilters(filters: unknown): RecipeFilter[] {
  if (!Array.isArray(filters)) return [];
  const result = new Map<string, RecipeFilter>();
  for (const filter of filters) {
    if (
      !filter ||
      typeof filter.name !== 'string' ||
      typeof filter.type !== 'string'
    )
      continue;
    const sourceType = filter.type.trim().toLowerCase();
    if (
      ![
        'cuisine',
        'category',
        'tag',
        ...FILTER_GROUPS.map((group) => group.type),
      ].includes(sourceType)
    )
      continue;
    for (const part of filter.name.split(',')) {
      const normalized = key(part);
      const cuisine = cuisineNames.get(normalized);
      const canonical = cuisine
        ? { name: cuisine, type: 'cuisine' }
        : sourceType === 'cuisine'
          ? undefined
          : labels.get(normalized);
      if (canonical)
        result.set(`${canonical.type}:${canonical.name}`, canonical);
    }
  }
  return [...result.values()].sort(
    (a, b) =>
      FILTER_GROUPS.findIndex((group) => group.type === a.type) -
        FILTER_GROUPS.findIndex((group) => group.type === b.type) ||
      a.name.localeCompare(b.name)
  );
}

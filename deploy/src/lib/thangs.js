const THANGS_CATEGORY_SOURCE = [
  ['3D Printer Parts & Accessories', ['Enclosures & Racks', 'Filament Management', 'Maintenance Tools', 'Print Bed Accessories', 'Printer Upgrades', 'Test Prints & Calibration']],
  ['Art & Decor', ['Busts', 'Hueforge', 'Lamps & Lighting', 'Lithophanes', 'Sculptures & Statues', 'Textured & Patterned', 'Trophies & Awards', 'Vases & Planters', 'Wall Art']],
  ['Costumes & Cosplay', ['Accessories', 'Armor & Props', 'Character Specific', 'Full Outfits', 'Masks & Helmets']],
  ['Educational & Scientific', ['Astronomy', 'Biology', 'Chemistry', 'Geology', 'Human Anatomy & Medical', 'Physics']],
  ['Fashion & Jewelry', ['Accessories', 'Bags', 'Bracelets', 'Clothing', 'Earrings', 'Jewelry Storage', 'Necklaces', 'Rings']],
  ['Functional Prints', ['Customizable', 'Jigs & Fixtures', 'Mechanical Parts', 'Replacement Parts', 'Tools']],
  ['Health & Fitness', ['Accessibility', 'Sports', 'Wellness']],
  ['Hobby & DIY', ['Automotive', 'Baking and Cooking', 'Electronics', 'Music & Audio', 'Outdoor', 'Photography & Video', 'RC', 'Robotics']],
  ['Home & Garden', ['Bathroom', 'Bedroom', 'Home Decor & Accessories', 'Kitchen & Dining', 'Living Room', 'Outdoor & Garden', 'Pet Accessories']],
  ['Miniatures & Tabletop', ['Accessories', 'Airplanes', 'Dioramas & Scenery', 'Fantasy Miniatures', 'Naval', 'Sci-Fi Miniatures', 'Trains', 'Vehicles', 'War & Tactics']],
  ['Seasonal', ['Beach & Summer', 'Easter & Spring', 'Halloween & Fall', 'Holidays & Winter']],
  ['Tools & Organizers', ['Gridfinity', 'Multiboard', 'Office & Desk', 'Shop & Garage', 'Storage Solutions', 'Utility & Tools']],
  ['Toys & Games', ['Action Figures & Collectibles', 'Articulated', 'Board Game Accessories', 'Educational Toys', 'Fidget Toys', 'Keychains', 'Outdoor Toys', 'Puzzles', 'Video Games']],
];

export function flattenThangsCategories(values = THANGS_CATEGORY_SOURCE) {
  return values.flatMap((category) => {
    const name = String(Array.isArray(category) ? category[0] : category.name || '');
    const children = Array.isArray(category) ? category[1] : category.subcategories || [];
    return [{ value: name, label: name }, ...children.filter((item) => item !== 'All').map((item) => ({ value: `${name}/${item}`, label: `${name} › ${item}` }))];
  });
}

export const THANGS_CATEGORIES = flattenThangsCategories();

const SINGLE_PART_ONLY_EXTENSIONS = new Set(['3mf', 'fbx', 'glb']);
const extension = (name) => String(name || '').split('.').pop().toLowerCase();

export function selectThangsSourceFiles(files = [], { structure = 'single', primaryFileId = '' } = {}) {
  const candidates = files.filter((file) => file?.blob && file.size <= 250 * 1024 * 1024);
  let models;
  if (structure === 'single') {
    models = [candidates.find((file) => file.id === primaryFileId) || candidates[0]].filter(Boolean);
  } else {
    models = candidates.filter((file) => !SINGLE_PART_ONLY_EXTENSIONS.has(extension(file.name)));
  }
  const references = files.filter((file) => file?.blob && !models.includes(file) && file.size <= 500 * 1024 * 1024);
  return { models, references };
}

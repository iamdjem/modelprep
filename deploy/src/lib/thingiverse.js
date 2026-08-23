export const THINGIVERSE_LICENSES = ['cc', 'cc-sa', 'cc-nd', 'cc-nc', 'cc-nc-sa', 'cc-nc-nd', 'pd0', 'gpl', 'lgpl', 'bsd', 'cern-ohl-s', 'cern-ohl-w', 'cern-ohl-p'];

// Extracted from Thingiverse's current production category bundle on 2026-08-01.
// IDs are kept for edit and readback requests. The final label segment is the
// native category name required by POST /api/things.
export const THINGIVERSE_CATEGORIES = [
  ['3D Printing', 73], ['3D Printing › Accessories', 127], ['3D Printing › Extruders', 152], ['3D Printing › Parts', 128], ['3D Printing › Printers', 126], ['3D Printing › Tests', 129],
  ['Art', 63], ['Art › 2D Art', 144], ['Art › Art Tools', 75], ['Art › Coins & Badges', 143], ['Art › Interactive Art', 78], ['Art › Math Art', 79], ['Art › Scans & Replicas', 145], ['Art › Sculptures', 80], ['Art › Signs & Logos', 76],
  ['Fashion', 64], ['Fashion › Accessories', 81], ['Fashion › Bracelets', 82], ['Fashion › Costume', 142], ['Fashion › Earrings', 139], ['Fashion › Glasses', 83], ['Fashion › Jewelry', 84], ['Fashion › Keychains', 130], ['Fashion › Rings', 85],
  ['Gadgets', 65], ['Gadgets › Audio', 141], ['Gadgets › Camera', 86], ['Gadgets › Computer', 87], ['Gadgets › Mobile Phone', 88], ['Gadgets › Tablet', 90], ['Gadgets › Video Games', 91],
  ['Hobby', 66], ['Hobby › Automotive', 155], ['Hobby › DIY', 93], ['Hobby › Electronics', 92], ['Hobby › Music', 94], ['Hobby › R/C Vehicles', 95], ['Hobby › Robotics', 96], ['Hobby › Sport & Outdoors', 140],
  ['Household', 67], ['Household › Bathroom', 147], ['Household › Containers', 146], ['Household › Decor', 97], ['Household › Household Supplies', 99], ['Household › Kitchen & Dining', 100], ['Household › Office', 101], ['Household › Organization', 102], ['Household › Outdoor & Garden', 98], ['Household › Pets', 103], ['Household › Replacement Parts', 153],
  ['Learning', 69], ['Learning › Biology', 106], ['Learning › Engineering', 104], ['Learning › Math', 105], ['Learning › Physics & Astronomy', 148],
  ['Models', 70], ['Models › Animals', 107], ['Models › Buildings & Structures', 108], ['Models › Creatures', 109], ['Models › Food & Drink', 110], ['Models › Model Furniture', 111], ['Models › Model Robots', 115], ['Models › People', 112], ['Models › Props', 114], ['Models › Vehicles', 116],
  ['Tools', 71], ['Tools › Hand Tools', 118], ['Tools › Machine Tools', 117], ['Tools › Tool Holders & boxes', 120], ['Tools › Parts', 119],
  ['Toys & Games', 72], ['Toys & Games › Chess', 151], ['Toys & Games › Construction Toys', 121], ['Toys & Games › Dice', 122], ['Toys & Games › Games', 123], ['Toys & Games › Mechanical Toys', 124], ['Toys & Games › Playsets', 113], ['Toys & Games › Puzzles', 125], ['Toys & Games › Toy & Game Accessories', 149],
  ['Other', 0],
].map(([label, id]) => ({ id: String(id), label }));

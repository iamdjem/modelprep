export const MAKERONLINE_MODEL_FORMATS = [
  'stl', 'obj', '3mf', '3ds', 'amf', 'blend', 'dwg', 'dxf', 'f3d', 'f3z',
  'factory', 'fcstd', 'iges', 'ipt', 'ply', 'py', 'rsdoc', 'scad', 'shape',
  'shapr', 'skp', 'sldasm', 'sldprt', 'slvs', 'step', 'stp', 'studio3',
  '123dx', 'thing',
];

export const MAKERONLINE_DOCUMENT_FORMATS = [
  'pdf', 'txt', 'xls', 'xlsx', 'doc', 'ppt', 'pptx', 'png', 'jpg', 'gif', 'svg',
];

export const MAKERONLINE_LICENSES = [
  { value: 1, label: 'CC BY' },
  { value: 2, label: 'CC BY-SA' },
  { value: 3, label: 'CC BY-NC' },
  { value: 4, label: 'CC BY-NC-SA' },
  { value: 5, label: 'CC BY-ND' },
  { value: 6, label: 'CC BY-NC-ND' },
  { value: 7, label: 'CC0' },
  { value: 8, label: 'Standard Digital File License' },
];

export const MAKERONLINE_LICENSE_MAP = {
  ccby: 1,
  ccbysa: 2,
  ccbync: 3,
  ccbyncsa: 4,
  ccbynd: 5,
  ccbyncnd: 6,
  cc0: 7,
  standard: 8,
};

export function flattenMakerOnlineCategories(nodes, parent = '') {
  const output = [];
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const id = node.id ?? node.category_id ?? node.value;
    const label = node.name_en ?? node.nameEn ?? node.category_name_en
      ?? node.categoryNameEn ?? node.category_name ?? node.categoryName
      ?? node.name ?? node.label;
    const path = label ? (parent ? `${parent} › ${label}` : String(label)) : parent;
    const children = node.children ?? node.child ?? node.child_list
      ?? node.category_list ?? node.options ?? node.list ?? [];
    if (id != null && label && (!Array.isArray(children) || children.length === 0)) {
      output.push({ id: String(id), label: path });
    }
    output.push(...flattenMakerOnlineCategories(children, path));
  }
  return output;
}

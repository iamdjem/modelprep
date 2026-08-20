// Slicer-style preview plate sizing. This is deliberately an auto-fit preview,
// not a claim about the user's printer: ModelPrep does not know which physical
// machine an ordinary STL will be printed on.

const COMMON_PREVIEW_PLATES = [50, 80, 100, 120, 150, 180, 220, 256, 300, 350];

const span = (min, max) => {
  const value = Number(max) - Number(min);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

export function buildPlatePreviewMetrics(bounds) {
  if (!bounds) return null;
  const x = span(bounds.minX, bounds.maxX);
  const y = span(bounds.minY, bounds.maxY);
  const z = span(bounds.minZ, bounds.maxZ);
  if (x == null || y == null || z == null) return null;

  const footprint = Math.max(x, y, 1);
  const target = footprint * 1.32;
  const plateSize = COMMON_PREVIEW_PLATES.find((size) => size >= target)
    || Math.ceil(target / 50) * 50;
  const majorStep = plateSize <= 100 ? 10 : plateSize <= 220 ? 20 : 25;
  const minorStep = majorStep / 5;

  // The STL raster has about 11% transparent padding on each side. Scale that
  // image so the visible mesh occupies its honest share of the auto-fit plate.
  const modelPercent = Math.max(18, Math.min(90, (footprint / plateSize) * 100 / 0.78));

  return {
    dimensions: { x, y, z },
    plateSize,
    majorStep,
    minorStep,
    majorPercent: (majorStep / plateSize) * 100,
    minorPercent: (minorStep / plateSize) * 100,
    modelPercent,
  };
}

export function formatModelDimension(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number >= 100 ? number.toFixed(0) : number >= 10 ? number.toFixed(1) : number.toFixed(2);
}


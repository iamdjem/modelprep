import {
  mwFetchOriginalRef,
  type LaserCutPublishInput,
  type MakerWorldPublishInput,
  type MakerWorldSession,
} from './adapters/makerworld-web.ts';

const MW_REMIX_FORBIDDEN_LICENSES = new Set([
  'BY-ND', 'BY-NC-ND', 'Standard Digital File License', 'MakerWorld Exclusive License',
  'Standard Digital File License - Community Use',
  'Standard Digital File License - Platform Print Only (SDFL-PPO)',
]);
const MW_REGULAR_FORMATS = new Set([
  '3mf', 'stl', 'step', 'stp', 'obj', '3ds', 'amf', 'dwg', 'dxf', 'f3d', 'factory',
  'fcstd', 'iges', 'ipt', 'ply', 'rsdoc', 'scad', 'shape', 'shapr', 'skp', 'sldasm',
  'sldprt', 'slvs', 'studio3', 'stpz', 'zip',
]);
const MW_LASER_FORMATS = new Set(['lac', 'svg', 'dxf', 'jpg', 'jpeg', 'png', 'bmp', 'webp', 'ai']);

function makerWorldRemixLicenseAllowsDerivatives(license?: string): boolean {
  return !!license && !MW_REMIX_FORBIDDEN_LICENSES.has(license);
}

export function validateMakerWorldPublish(input: MakerWorldPublishInput): string[] {
  const errors: string[] = [];
  const MB = 1024 * 1024;
  if (!input.title?.trim()) errors.push('title is required');
  if (input.title?.length > 50) errors.push('title must be 50 characters or fewer');
  if (!input.coverUrl) errors.push('coverUrl is required');
  if (!input.coverPortraitUrl) errors.push('coverPortraitUrl is required');
  if (!input.description?.trim()) errors.push('description is required');
  if (!(input.categoryId > 0)) errors.push('categoryId is required');
  if (!input.model3mf && !(input.modelFiles?.length)) errors.push('at least one model file is required');
  for (const file of input.modelFiles ?? []) {
    if (!MW_REGULAR_FORMATS.has(file.modelType.toLowerCase())) errors.push(`${file.modelName} has unsupported format .${file.modelType}`);
    if (file.modelSize > 200 * MB) errors.push(`${file.modelName} exceeds the 200MB per-file limit`);
  }
  if (input.model3mf && input.model3mf.size > 150 * MB) errors.push(`${input.model3mf.name} exceeds the 150MB 3MF limit`);
  const totalBytes = (input.modelFiles ?? []).reduce((sum, file) => sum + file.modelSize, input.model3mf?.size ?? 0);
  if (totalBytes > 250 * MB) errors.push('model files exceed the 250MB total limit');
  if ((input.tags?.length ?? 0) > 50) errors.push('at most 50 tags are allowed');
  if ((input.galleryUrls?.length ?? 0) > 16) errors.push('at most 16 model pictures are allowed');
  if ((input.designVideo?.length ?? 0) > 1) errors.push('at most one model video is allowed');
  for (const video of input.designVideo ?? []) {
    if (!video.url) errors.push('model video url is required');
    if (!/\.(mp4|mov)(?:$|[?#])/i.test(video.name || '')) errors.push('model video must be MP4 or MOV');
  }
  if (input.model3mf) {
    if (!input.printProfile) errors.push('a 3MF upload requires printProfile');
    else {
      if (!input.printProfile.title?.trim()) errors.push('printProfile.title is required');
      if (input.printProfile.title?.length > 60) errors.push('printProfile.title must be 60 characters or fewer');
      if (!input.printProfile.pictureUrls?.length) errors.push('printProfile.pictureUrls requires at least one photo');
      if (!input.printProfile.realPhotoConfirmed) errors.push('printProfile must confirm a real printed-model photo');
      if (!input.printProfile.isPrinterTested) errors.push('print-profile guidelines must be accepted');
    }
  }
  if (input.cyberBrick && !input.cyberBrick.controlConfig?.length) errors.push('CyberBrick requires at least one control configuration');
  if (input.exclusive && !input.exclusiveTermsAccepted) errors.push('MakerWorld Exclusive terms must be accepted');
  if (input.exclusive && input.modelSource === 'remix') errors.push('remixes are not eligible for MakerWorld Exclusive');
  if (input.modelSource === 'remix' && !input.remixDescription?.trim()) errors.push('remixDescription is required');
  return errors;
}

export function validateLaserCutPublish(input: LaserCutPublishInput): string[] {
  const errors: string[] = [];
  const MB = 1024 * 1024;
  if (!input.title?.trim()) errors.push('title is required');
  if (input.title?.length > 50) errors.push('title must be 50 characters or fewer');
  if (!input.pictures?.length) errors.push('at least one cover picture is required');
  if (!input.lacFile && !(input.modelFiles?.length)) errors.push('provide one .lac file or at least one raw Laser & Cut file');
  if (input.lacFile) {
    if (!/\.lac$/i.test(input.lacFile.name)) errors.push('lacFile must be a .lac file');
    if (input.lacFile.size > 200 * MB) errors.push(`${input.lacFile.name} exceeds the 200MB per-file limit`);
    if (!input.lacInfo?.plates?.length) errors.push('lacInfo.plates is required for .lac uploads');
    if (!input.lacInfo?.machineName?.trim()) errors.push('lacInfo.machineName is required for .lac uploads');
    if (!input.lacInfo?.processTypes?.length) errors.push('lacInfo.processTypes is required for .lac uploads');
    if (!input.profileTitle?.trim()) errors.push('profileTitle is required for .lac uploads');
    if ((input.profileTitle?.length ?? 0) > 60) errors.push('profileTitle must be 60 characters or fewer');
    if (!input.profilePictures?.length) errors.push('profilePictures requires at least one picture for .lac uploads');
    if ((input.profilePictures?.length ?? 0) > 37) errors.push('at most 37 profilePictures are allowed');
  }
  for (const file of input.modelFiles ?? []) {
    if (!MW_LASER_FORMATS.has(file.modelType.toLowerCase())) errors.push(`${file.modelName} has unsupported Laser & Cut format .${file.modelType}`);
    if (file.modelSize > 200 * MB) errors.push(`${file.modelName} exceeds the 200MB per-file limit`);
  }
  const totalBytes = (input.modelFiles ?? []).reduce((sum, file) => sum + file.modelSize, input.lacFile?.size ?? 0);
  if (totalBytes > 250 * MB) errors.push('Laser & Cut files exceed the 250MB total limit');
  if ((input.tags?.length ?? 0) > 50) errors.push('at most 50 tags are allowed');
  if (input.cyberBrick && !input.cyberBrick.controlConfig?.length) errors.push('CyberBrick requires at least one control configuration');
  if (input.modelSource === 'remix' && !input.remixDescription?.trim()) errors.push('remixDescription is required');
  return errors;
}

export async function resolveMakerWorldRemix(session: MakerWorldSession, input: MakerWorldPublishInput | LaserCutPublishInput): Promise<string[]> {
  if (input.modelSource !== 'remix') return [];
  if (!input.resolvedOriginals?.length && input.remixOriginalIds?.length) {
    input.resolvedOriginals = await Promise.all(input.remixOriginalIds.map((id) => mwFetchOriginalRef(session, id, input.remixOriginalDesignType ?? 0)));
  }
  if (!input.resolvedOriginals?.length && input.remixSourceUrl?.trim()) {
    let sourceUrl: URL;
    try { sourceUrl = new URL(input.remixSourceUrl); }
    catch { return ['remixSourceUrl must be a valid URL']; }
    if (!['http:', 'https:'].includes(sourceUrl.protocol)) return ['remixSourceUrl must use http or https'];
    const internalId = /makerworld\.com\/(?:[a-z]{2}\/)?models\/(\d+)/i.exec(sourceUrl.href)?.[1];
    input.resolvedOriginals = internalId
      ? [await mwFetchOriginalRef(session, Number(internalId), input.remixOriginalDesignType ?? 0)]
      : [{ link: sourceUrl.href, designId: 0, designType: input.remixOriginalDesignType ?? 0, license: input.remixSourceLicense ?? '' }];
  }
  if (!input.resolvedOriginals?.length) return ['a remix source URL or MakerWorld model is required'];
  const forbidden = input.resolvedOriginals.filter((original) => !makerWorldRemixLicenseAllowsDerivatives(original.license || input.remixSourceLicense));
  return forbidden.length ? ['the original model license does not allow derivative uploads'] : [];
}

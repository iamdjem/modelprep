// Platform-native outcomes and evidence are deliberately centralized here so
// Package, Destinations, Review, and upload receipts cannot tell four different
// stories about the same action.

export const PLATFORM_WORKFLOW = {
  makerworld: {
    safeOutcome: 'Private object',
    evidence: 'Retained API fields matched',
    evidenceLevel: 'api',
    unsupported: ['Specialist profile, public, video, and program branches are not fully certified'],
  },
  printables: {
    safeOutcome: 'Unpublished draft',
    evidence: 'Retained API fields and source bytes matched',
    evidenceLevel: 'api',
    unsupported: ['Public, paid, Club, and approval branches are not fully certified'],
  },
  cults: {
    safeOutcome: 'Secret unlisted publication',
    evidence: 'Retained canonical listing matched',
    evidenceLevel: 'api',
    unsupported: ['Public, paid, subcategory, and non-3D-print usage branches are not fully certified'],
  },
  mmf: {
    safeOutcome: 'Private object',
    evidence: 'Retained API fields matched',
    evidenceLevel: 'api',
    unsupported: ['Public review, Store, archive, and premium-size branches are not fully certified'],
  },
  thingiverse: {
    safeOutcome: 'Unpublished draft',
    evidence: 'Retained assets matched; category persistence remains partial',
    evidenceLevel: 'partial',
    unsupported: ['Public, education, rich-section, and full category branches are not fully certified'],
  },
  thangs: {
    safeOutcome: 'Private object',
    evidence: 'Earlier retained core; latest corrected flow is not freshly confirmed',
    evidenceLevel: 'partial',
    unsupported: ['Multi-structure, audience, and paid-access branches are not certified'],
  },
  nexprint: {
    safeOutcome: 'Unpublished draft',
    evidence: 'Retained API fields and source bytes matched',
    evidenceLevel: 'api',
    unsupported: ['Native Print Profile blocks, public, and rendered-editor branches are not certified'],
  },
  creality: {
    safeOutcome: 'Private object',
    evidence: 'Retained API fields, bytes, and geometry matched',
    evidenceLevel: 'api',
    unsupported: ['Parsed Print Configuration, public, remix, and paid branches are not certified'],
  },
  makeronline: {
    safeOutcome: 'Unpublished draft',
    evidence: 'Retained raw-model core matched',
    evidenceLevel: 'partial',
    unsupported: ['Dual-role 3MF and parsed profile retention are not certified'],
  },
  makeroad: {
    safeOutcome: 'Review submission',
    evidence: 'Transport retained; all tested saves entered review and were rejected',
    evidenceLevel: 'review-rejected',
    unsupported: ['No accepted private, draft, review, or public listing is certified'],
  },
};

export const EVIDENCE_LEVEL_LABELS = {
  api: 'API fields matched',
  ui: 'Native UI confirmed',
  accepted: 'Review/live accepted',
  partial: 'Partial retained evidence',
  'review-rejected': 'Review reached · rejected',
};

// UI disclosure is metadata, not storage. Collapsing an automatic or advanced
// value must never delete it or remove it from adapter preflight. Every field
// shown by the destination editor can use this shape, while platform-specific
// components remain the source of the actual value and persistence logic.
export const DESTINATION_FIELD_SCHEMA = {
  required: {
    requiredWhen: 'selected-action',
    priority: 'needs-attention',
    defaultSource: 'platform-or-project',
    persistedByAdapter: true,
    evidenceLevel: 'platform-specific',
    fixTarget: 'destinations-required',
  },
  automatic: {
    requiredWhen: 'adapter-derived',
    priority: 'ready-automatically',
    defaultSource: 'shared-listing-and-package',
    persistedByAdapter: true,
    evidenceLevel: 'platform-specific',
    fixTarget: 'destinations-automatic',
  },
  advanced: {
    requiredWhen: 'specialist-or-override',
    priority: 'advanced',
    defaultSource: 'safe-platform-default',
    persistedByAdapter: true,
    evidenceLevel: 'platform-specific',
    fixTarget: 'destinations-advanced',
  },
};

// A destination is blocked or it is ready. It is never "ready with warnings":
// an adaptation is something ModelPrep does on its own, so colouring the card
// amber for it downgraded destinations that would have uploaded unchanged.
export function destinationReadinessSummary(platformId, issues = {}, project = {}) {
  const errors = Array.isArray(issues.errors) ? issues.errors : [];
  const adaptations = Array.isArray(issues.adaptations) ? issues.adaptations : [];
  const confirmations = Array.isArray(issues.confirmations) ? issues.confirmations : [];
  const outcome = destinationOutcome(platformId, project);
  return {
    status: errors.length ? 'blocked' : confirmations.length ? 'confirm' : 'ready',
    label: errors.length ? 'Needs attention' : confirmations.length ? 'Confirm to publish' : 'Ready',
    missingCount: errors.length,
    adaptationCount: adaptations.length,
    confirmationCount: confirmations.length,
    firstIssue: errors[0] || '',
    outcome,
    evidence: evidenceLabel(platformId),
    disclosure: DESTINATION_FIELD_SCHEMA,
  };
}

export function platformWorkflow(platformId) {
  return PLATFORM_WORKFLOW[platformId] || {
    safeOutcome: 'Platform-specific action',
    evidence: 'No retained evidence recorded',
    evidenceLevel: 'partial',
    unsupported: [],
  };
}

export function destinationOutcome(platformId, project = {}) {
  const opts = project.platforms?.[platformId] || {};
  const paid = platformId === 'cults'
    ? opts.free === false || Number(opts.price) > 0
    : platformId === 'printables'
      ? !!opts.store || !!opts.club || Number(opts.price) > 0
      : platformId === 'makeroad'
        ? opts.payType && opts.payType !== 'free'
        : platformId === 'thangs'
          ? !!opts.marketplace
          : false;

  if (platformId === 'makeroad') {
    return { action: 'Submit to MakerRoad review', outcome: 'Review submission', visibility: 'pending review', paid, requiresConfirmation: true };
  }
  if (platformId === 'cults') {
    const isPublic = opts.visibility === 'public';
    return {
      action: isPublic ? 'Publish on Cults3D' : 'Create secret Cults3D publication',
      outcome: isPublic ? 'Public publication' : 'Secret unlisted publication',
      visibility: isPublic ? 'public' : 'secret', paid,
      requiresConfirmation: isPublic || paid,
    };
  }
  const publication = opts.publication || opts.visibility || '';
  const isPublic = publication === 'public' || publication === 'publish';
  const safe = platformWorkflow(platformId).safeOutcome;
  return {
    action: isPublic ? `Publish on ${platformId === 'mmf' ? 'MyMiniFactory' : platformId === 'creality' ? 'Creality Cloud' : platformId === 'makeronline' ? 'MakerOnline' : platformId === 'thingiverse' ? 'Thingiverse' : platformId === 'thangs' ? 'Thangs' : platformId === 'nexprint' ? 'Nexprint' : platformId === 'printables' ? 'Printables' : 'MakerWorld'}` : `Create ${safe.toLowerCase()}`,
    outcome: isPublic ? 'Public publication' : safe,
    visibility: isPublic ? 'public' : safe.toLowerCase(),
    paid,
    requiresConfirmation: isPublic || paid,
  };
}

export function destinationMediaTreatment(platformId) {
  const values = {
    makerworld: ['Cover: required 4:3 web crop and 3:4 app crop', 'Gallery: original framing preserved', 'Gallery limit: 16'],
    printables: ['Cover: first original image', 'Gallery: original framing preserved'],
    cults: ['Cover: first original media', 'Gallery: original framing preserved'],
    mmf: ['All images: JPEG quality 90%, longest edge at most 2400 px'],
    thingiverse: ['Cover/gallery: ordered originals'],
    thangs: ['Cover/gallery: ordered originals'],
    nexprint: ['Cover: required 4:3 crop', 'Gallery: original framing preserved', 'Gallery limit: 9'],
    creality: ['Cover: required 4:3 web crop and 3:4 app crop', 'Gallery: original framing preserved', 'Gallery limit: 9'],
    makeronline: ['Cover/gallery: ordered originals', 'Gallery limit: 19'],
    makeroad: ['Cover/gallery: ordered originals', 'Total image limit: 10'],
  };
  return values[platformId] || ['Media treatment follows the platform adapter'];
}

export function evidenceLabel(platformId) {
  const level = platformWorkflow(platformId).evidenceLevel;
  return EVIDENCE_LEVEL_LABELS[level] || EVIDENCE_LEVEL_LABELS.partial;
}

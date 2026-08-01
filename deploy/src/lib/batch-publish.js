export const LIVE_PUBLISH_PLATFORM_IDS = ['makerworld', 'printables', 'cults', 'nexprint', 'creality', 'makeronline', 'mmf', 'makeroad', 'thangs', 'thingiverse'];

export function batchPublishIntent(platformId, project) {
  const safeDemo = !!project.__demo;
  if (platformId === 'makerworld') {
    return safeDemo
      ? { action: 'draft', visibility: 'draft' }
      : { action: 'publish', visibility: project.platforms?.makerworld?.visibility || 'private' };
  }
  if (platformId === 'printables') {
    const publication = project.platforms?.printables?.publication || 'draft';
    return safeDemo
      ? { action: 'draft', visibility: 'draft' }
      : {
        action: publication === 'publish' ? 'publish' : 'draft',
        visibility: publication === 'publish' ? 'public' : 'draft',
      };
  }
  if (platformId === 'cults') {
    return {
      action: 'publish',
      visibility: safeDemo ? 'secret' : (project.platforms?.cults?.visibility || 'secret'),
    };
  }
  if (platformId === 'nexprint') {
    const publication = project.platforms?.nexprint?.publication || 'draft';
    return safeDemo
      ? { action: 'draft', visibility: 'draft' }
      : {
        action: publication === 'publish' ? 'publish' : 'draft',
        visibility: publication === 'publish' ? 'public' : 'draft',
      };
  }
  if (platformId === 'creality') {
    const publication = project.platforms?.creality?.publication === 'public' ? 'public' : 'private';
    return safeDemo
      ? { action: 'private', visibility: 'private' }
      : {
        action: publication === 'public' ? 'publish' : publication,
        visibility: publication,
      };
  }
  if (platformId === 'makeronline') {
    const publication = project.platforms?.makeronline?.publication || 'draft';
    return safeDemo
      ? { action: 'draft', visibility: 'draft' }
      : {
        action: publication === 'public' ? 'publish' : 'draft',
        visibility: publication === 'public' ? 'public' : 'draft',
      };
  }
  if (platformId === 'mmf') {
    const publication = project.platforms?.mmf?.publication === 'public' ? 'public' : 'private';
    return safeDemo
      ? { action: 'private', visibility: 'private' }
      : { action: publication === 'public' ? 'publish' : 'private', visibility: publication };
  }
  if (platformId === 'makeroad') {
    const publication = project.platforms?.makeroad?.publication === 'publish' ? 'publish' : 'draft';
    return safeDemo ? { action: 'draft', visibility: 'draft' } : {
      action: publication, visibility: publication === 'publish' ? 'pending' : 'draft',
    };
  }
  if (platformId === 'thangs') {
    const publication = project.platforms?.thangs?.publication === 'public' ? 'public' : 'private';
    return safeDemo ? { action: 'private', visibility: 'private' } : { action: publication === 'public' ? 'publish' : 'private', visibility: publication };
  }
  if (platformId === 'thingiverse') {
    const publication = project.platforms?.thingiverse?.publication === 'publish' ? 'public' : 'draft';
    return safeDemo ? { action: 'draft', visibility: 'draft' } : { action: publication === 'public' ? 'publish' : 'draft', visibility: publication };
  }
  return { action: 'manual', visibility: 'manual' };
}

export function publishVisibility(platformId, project) {
  return batchPublishIntent(platformId, project).visibility;
}

export function orderedPlatformImages(platform, project) {
  const cover = project.images.find((image) => image.id === project.coverImageId) || project.images[0];
  if (!cover) return [];
  return [
    cover,
    ...project.images.filter((image) => image.id !== cover.id),
  ].slice(0, platform.maxImages || project.images.length);
}

export const DESKTOP_PUBLISH_CONCURRENCY = 4;

export function createPublishBatch(targets, runId, requestedConcurrency = DESKTOP_PUBLISH_CONCURRENCY) {
  const results = Object.fromEntries(targets.map((target) => [
    target.id,
    {
      id: target.id,
      name: target.name,
      state: 'pending',
      action: target.action,
      visibility: target.visibility,
      publicationState: target.visibility,
      simulated: target.mode === 'simulation',
      detail: target.mode === 'simulation'
        ? `${target.action === 'draft' ? 'Draft save' : `${target.visibility} publish`} simulation queued`
        : `${target.action === 'draft' ? 'Draft save' : `${target.visibility} publish`} queued`,
    },
  ]));
  const concurrency = Math.max(1, Math.min(Number(requestedConcurrency) || 1, targets.length || 1));
  const activeIds = targets.slice(0, concurrency).map((target) => target.id);
  activeIds.forEach((id) => {
    results[id] = { ...results[id], state: 'publishing', detail: 'Starting…' };
  });
  return {
    runId,
    status: activeIds.length ? 'running' : 'idle',
    targetIds: targets.map((target) => target.id),
    concurrency,
    activeIds,
    currentId: activeIds[0] || null,
    results,
  };
}

export function advancePublishBatch(batch, outcome) {
  if (!batch || batch.status !== 'running') return batch;
  const activeIds = batch.activeIds || (batch.currentId ? [batch.currentId] : []);
  if (batch.runId !== outcome.runId || !activeIds.includes(outcome.platformId)) return batch;

  const results = {
    ...batch.results,
    [outcome.platformId]: {
      ...batch.results[outcome.platformId],
      state: outcome.state === 'success' ? 'done' : 'error',
      detail: concisePublishDetail(outcome.detail || (outcome.state === 'success' ? 'Complete' : 'Failed')),
      fullDetail: outcome.detail || (outcome.state === 'success' ? 'Complete' : 'Failed'),
      publicationState: outcome.publicationState || batch.results[outcome.platformId].publicationState,
      simulated: outcome.simulated ?? batch.results[outcome.platformId].simulated,
      url: outcome.url || '',
    },
  };
  const remainingActive = activeIds.filter((id) => id !== outcome.platformId);
  const pendingIds = batch.targetIds.filter((id) => results[id]?.state === 'pending');
  const openSlots = Math.max(0, (batch.concurrency || 1) - remainingActive.length);
  const startingIds = pendingIds.slice(0, openSlots);
  startingIds.forEach((id) => {
    results[id] = { ...results[id], state: 'publishing', detail: 'Starting…' };
  });
  const nextActiveIds = [...remainingActive, ...startingIds];
  return {
    ...batch,
    status: nextActiveIds.length ? 'running' : 'done',
    activeIds: nextActiveIds,
    currentId: nextActiveIds[0] || null,
    results,
  };
}

export function retryFailedPublishBatch(batch, runId) {
  if (!batch || batch.status !== 'done') return batch;
  const failedIds = batch.targetIds.filter((id) => batch.results[id]?.state === 'error');
  if (!failedIds.length) return batch;

  const results = { ...batch.results };
  failedIds.forEach((id) => {
    results[id] = { ...results[id], state: 'pending', detail: 'Retry queued', fullDetail: 'Retry queued' };
  });
  const activeIds = failedIds.slice(0, batch.concurrency || 1);
  activeIds.forEach((id) => {
    results[id] = { ...results[id], state: 'publishing', detail: 'Retrying…', fullDetail: 'Retrying…' };
  });

  return {
    ...batch,
    runId,
    status: 'running',
    activeIds,
    currentId: activeIds[0] || null,
    results,
  };
}

export function concisePublishDetail(detail, maxLength = 160) {
  const clean = String(detail || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

export function publishReceiptLabel(result) {
  if (!result) return 'Ready';
  if (result.state === 'publishing') return 'Working';
  if (result.state === 'pending') return 'Queued';
  if (result.state === 'error') return 'Failed';
  if (result.state !== 'done') return 'Ready';

  const publicationState = result.publicationState || result.visibility;
  if (result.simulated) {
    if (publicationState === 'draft') return 'Simulated · Draft';
    const simulatedLabel = publicationState
      ? publicationState.charAt(0).toUpperCase() + publicationState.slice(1)
      : 'Publish';
    return `Simulated · ${simulatedLabel}`;
  }
  if (publicationState === 'draft') return 'Not published · Draft';
  if (publicationState === 'pending') return 'Pending approval';
  if (publicationState === 'private') return 'Published · Private';
  if (publicationState === 'secret') return 'Published · Secret';
  if (publicationState === 'live' || publicationState === 'public') return 'Published';
  if (publicationState === 'submitted') return 'Submitted';
  return 'Complete';
}

export function publishBatchSummary(batch) {
  const results = Object.values(batch?.results || {});
  return {
    total: results.length,
    succeeded: results.filter((result) => result.state === 'done').length,
    failed: results.filter((result) => result.state === 'error').length,
    running: results.filter((result) => result.state === 'publishing').length,
  };
}

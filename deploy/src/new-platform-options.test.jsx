// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { chooseOption, expectFieldValue } from './select-harness.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MakerRoadOptions, PlatformFilePicker, ThangsOptions, ThingiverseOptions, makerRoadReadbackIssues, platformPreflight, publishBlockers } from './App.jsx';

afterEach(cleanup);
const noop = vi.fn();
describe('new direct-platform option parity', () => {
  it('renders MakerRoad action, source, license and print branches', () => {
    render(<MakerRoadOptions opts={{ publication: 'draft', uploadType: 1, categoryIds: [], printMethods: ['FDM'], licenseIndex: 0, visibility: 'private', payType: 'free' }} onUpdate={noop} />);
    expect(screen.getByLabelText('MakerRoad batch action')).toBeInTheDocument(); expect(screen.getByLabelText('MakerRoad license')).toBeInTheDocument();
    expect(screen.getByText(/current native form has no video field/i)).toBeInTheDocument();
  });
  it('warns rather than silently sending video media to MakerRoad', () => {
    const result = platformPreflight({ id: 'makeroad', name: 'MakerRoad', formats: ['stl'], limits: {} }, {
      files: [{ name: 'part.stl', size: 1, isImage: false }], media: [{ name: 'turntable.mp4', type: 'video/mp4' }],
      images: [{ id: 'cover' }], coverImageId: 'cover', title: 'Dragon', description: 'A dragon', category: 'toys', tags: [],
      platforms: { makeroad: { visibility: 'private' } },
    });
    expect(result.warnings).toContain("MakerRoad's current upload form has no native video field; video media will not upload.");
  });
  // The attestation is unverifiable, so it is asked for at publish time rather
  // than kept as a standing error. Nothing uploads until it is ticked.
  it('blocks MakerRoad saves that would be rejected for having only synthetic renders', () => {
    const result = platformPreflight({ id: 'makeroad', name: 'MakerRoad', formats: ['stl'], limits: {} }, {
      files: [{ name: 'part.stl', size: 1, isModel: true }], media: [],
      images: [{ id: 'cover' }, { id: 'side' }, { id: 'detail' }], coverImageId: 'cover',
      title: 'Calibration puck', description: 'A printable puck', category: 'tools', tags: [],
      profiles: [{ id: 'profile', realPhotoConfirmed: false }],
      platforms: { makeroad: { categoryIds: ['test-models'], printMethods: ['fdm'], visibility: 'private', payType: 'free' } },
    });
    expect(result.errors).toEqual([]);
    expect(result.confirmations.map((item) => item.id)).toContain('makeroad-real-photo');
    expect(publishBlockers(result).join(' ')).toMatch(/real printed model/i);
  });
  it('allows the disclosed demo fixture to exercise MakerRoad transport without weakening real projects', () => {
    const result = platformPreflight({ id: 'makeroad', name: 'MakerRoad', formats: ['stl'], limits: {} }, {
      __testProject: true, files: [{ name: 'part.stl', size: 1, isModel: true }], media: [],
      images: [{ id: 'cover' }, { id: 'side' }, { id: 'detail' }], coverImageId: 'cover',
      title: 'Calibration puck', description: 'A disclosed synthetic test', category: 'tools', tags: [],
      profiles: [{ id: 'profile', realPhotoConfirmed: false }],
      platforms: { makeroad: { categoryIds: ['test-models'], printMethods: ['fdm'], visibility: 'private', payType: 'free' } },
    });
    expect(result.errors.join(' ')).not.toMatch(/real photo/i);
    expect(result.warnings.join(' ')).toMatch(/Demo transport testing is allowed/i);
  });
  it('fails closed when MakerRoad edit readback loses uploaded media or changes privacy', () => {
    const issues = makerRoadReadbackIssues({ title: 'Dragon', visibility: 'private', scheduled: false, payType: 'free', models: 1, profiles: 0, documents: 1, images: 3 }, {
      name: 'Dragon', visible: 1, plan: 1, payType: 1, fileModel: 'model-1', filePrintconf: '', fileDoc: '', pics: 'image-1|image-2',
    });
    expect(issues.join(' ')).toMatch(/visibility.*instruction documents.*images/i);
  });
  it('names the Printables print profile it is not sending, so a receipt cannot overclaim', () => {
    // The reproducible cause of "the 3MF is missing" on Printables: its native
    // slicer is Prusa, so automatic selection unticks a Bambu-sliced profile
    // and nothing said so. Printables has no print-profile surface at all - a
    // .3mf is filed as an ordinary model file (live readback of public model
    // 1472993 puts it in `stls`).
    const project = {
      files: [
        { id: 'a', name: 'puck.stl', size: 1, isModel: true, blob: {} },
        { id: 'b', name: 'puck-bambu.3mf', size: 1, isModel: true, isProfile: true, blob: {} },
      ],
      images: [{ id: 'cover' }], coverImageId: 'cover',
      title: 'Calibration puck', description: 'A printable puck', category: 'tools', tags: ['calibration'],
      platforms: { printables: { categoryId: '12', aiGenerated: false, authorship: 'author', excludedFileIds: ['b'] } },
    };
    const result = platformPreflight({ id: 'printables', name: 'Printables', formats: ['stl', '3mf'], limits: {} }, project);
    expect(result.errors).toEqual([]);
    expect(result.warnings.join(' ')).toMatch(/no print-profile section/i);
    expect(result.warnings.join(' ')).toContain('puck-bambu.3mf');
    // Ticking it back on removes the notice rather than warning about a file
    // that is actually being sent.
    const included = platformPreflight({ id: 'printables', name: 'Printables', formats: ['stl', '3mf'], limits: {} }, {
      ...project,
      platforms: { printables: { ...project.platforms.printables, excludedFileIds: [] } },
    });
    expect(included.warnings.join(' ')).not.toMatch(/no print-profile section/i);
  });

  it('separates an unticked Nexprint profile from one that uploads without a profile block', () => {
    const base = {
      files: [
        { id: 'a', name: 'puck.stl', size: 1, isModel: true, blob: {} },
        { id: 'b', name: 'puck-bambu.3mf', size: 1, isModel: true, isProfile: true, blob: {} },
      ],
      images: [{ id: 'cover' }], coverImageId: 'cover',
      title: 'Calibration puck', description: 'A printable puck', category: 'tools', tags: ['calibration'],
      profiles: [{ id: 'prof', name: 'puck' }],
    };
    const plat = { id: 'nexprint', name: 'Nexprint', formats: ['stl', '3mf'], limits: {} };
    const opts = { categoryId: '1422473859022859', licenseType: 2, originalityType: 1 };
    const unticked = platformPreflight(plat, { ...base, platforms: { nexprint: { ...opts, excludedFileIds: ['b'] } } });
    expect(unticked.warnings.join(' ')).toMatch(/not ticked for Nexprint and will not upload/i);
    expect(unticked.warnings.join(' ')).toContain('puck-bambu.3mf');
    // An unticked profile must not also claim it "uploads as a plain model file".
    expect(unticked.warnings.join(' ')).not.toMatch(/uploads as a plain model file/i);

    const ticked = platformPreflight(plat, { ...base, platforms: { nexprint: { ...opts, excludedFileIds: [] } } });
    expect(ticked.warnings.join(' ')).not.toMatch(/not ticked for Nexprint/i);
    expect(ticked.warnings.join(' ')).toMatch(/Print Profile \(0\)/);
  });

  it('names an unticked Creality profile separately from an unparsed one', () => {
    const base = {
      files: [
        { id: 'a', name: 'puck.stl', size: 1, isModel: true, blob: {} },
        { id: 'b', name: 'puck-bambu.3mf', size: 1, isModel: true, isProfile: true, blob: {} },
      ],
      images: [{ id: 'cover' }], coverImageId: 'cover',
      title: 'Calibration puck', description: 'A printable puck', category: 'tools', tags: ['calibration'],
    };
    const plat = { id: 'creality', name: 'Creality Cloud', formats: ['stl', '3mf'], limits: {} };
    const opts = { categoryId: '1645', license: 'CC BY-NC', modelSource: 1 };
    const unticked = platformPreflight(plat, { ...base, platforms: { creality: { ...opts, excludedFileIds: ['b'] } } });
    expect(unticked.warnings.join(' ')).toMatch(/not ticked for Creality Cloud and will not upload/i);
    expect(unticked.warnings.join(' ')).toContain('puck-bambu.3mf');
    // An unticked profile must not also claim it uploads as a plain model file.
    expect(unticked.warnings.join(' ')).not.toMatch(/uploads as plain model files/i);

    const ticked = platformPreflight(plat, { ...base, platforms: { creality: { ...opts, excludedFileIds: [] } } });
    expect(ticked.warnings.join(' ')).not.toMatch(/not ticked for Creality Cloud/i);
    expect(ticked.warnings.join(' ')).toMatch(/Print Configurations/i);
  });

  it('rejects Creality tags over the live 30-character input limit', () => {
    const result = platformPreflight({ id: 'creality', name: 'Creality Cloud', formats: ['stl'], limits: {} }, {
      files: [{ name: 'part.stl', size: 1, isModel: true }], images: [{ id: 'cover' }], coverImageId: 'cover',
      title: 'Dragon', description: 'A dragon', category: 'toys',
      tags: ['ok-tag', 'this-tag-is-thirty-one-chars-xx'],
      platforms: { creality: { categoryId: '1575', license: 'CC BY-NC' } },
    });
    expect(result.errors).toContain('Creality Cloud tags may not exceed 30 characters.');
  });
  it('fails closed when every compatible file is excluded for a platform', () => {
    const result = platformPreflight({ id: 'creality', name: 'Creality Cloud', formats: ['stl', '3mf'], limits: {} }, {
      files: [{ id: 'f1', name: 'part.stl', size: 1 }], images: [{ id: 'cover' }], coverImageId: 'cover',
      title: 'Dragon', description: 'A dragon', category: 'toys', tags: [],
      platforms: { creality: { categoryId: '1575', license: 'CC BY-NC', excludedFileIds: ['f1'] } },
    });
    expect(result.errors).toContain('No model or print-profile role is selected for Creality Cloud; give at least one compatible file a role in Files.');
  });
  it('lets per-platform file exclusions drop a slicer-specific variant', () => {
    const files = [
      { id: 'stl', name: 'dragon.stl', size: 1, isModel: true },
      { id: 'e3mf', name: 'dragon-E.3mf', size: 1, isModel: true, isProfile: true, threemf: { slicer: 'elegoo' } },
    ];
    const withExclusion = platformPreflight({ id: 'creality', name: 'Creality Cloud', formats: ['stl', '3mf'], limits: {} }, {
      files, images: [{ id: 'cover' }], coverImageId: 'cover',
      title: 'Dragon', description: 'A dragon', category: 'toys', tags: [],
      platforms: { creality: { categoryId: '1575', license: 'CC BY-NC', excludedFileIds: ['e3mf'] } },
    });
    expect(withExclusion.errors).toEqual([]);
    expect(withExclusion.warnings.join(' ')).toMatch(/not ticked for Creality Cloud/i);
    const withoutExclusion = platformPreflight({ id: 'creality', name: 'Creality Cloud', formats: ['stl', '3mf'], limits: {} }, {
      files, images: [{ id: 'cover' }], coverImageId: 'cover',
      title: 'Dragon', description: 'A dragon', category: 'toys', tags: [],
      platforms: { creality: { categoryId: '1575', license: 'CC BY-NC' } },
    });
    expect(withoutExclusion.warnings.join(' ')).toMatch(/print settings won't be parsed/);
  });
  it('renders the per-platform file picker with slicer badges and toggles exclusions', () => {
    const onUpdate = vi.fn();
    render(<PlatformFilePicker
      platform={{ id: 'creality', name: 'Creality Cloud', formats: ['stl', '3mf'] }}
      project={{ files: [
        { id: 'stl', name: 'dragon.stl' },
        { id: 'e3mf', name: 'dragon-E.3mf', isProfile: true, threemf: { slicer: 'elegoo' } },
      ] }}
      opts={{ excludedFileIds: [] }}
      onUpdate={onUpdate}
    />);
    expect(screen.getByText('Elegoo Slicer')).toBeInTheDocument();
    const role = screen.getByLabelText('dragon-E.3mf role for Creality Cloud');
    expectFieldValue(role, 'model');
    chooseOption('dragon-E.3mf role for Creality Cloud', /not sent|Not sent/i);
    expect(onUpdate).toHaveBeenCalledWith('fileSelection', 'manual');
  });
  it('renders Thangs privacy and structure controls', () => {
    render(<ThangsOptions opts={{ publication: 'private', structure: 'single', units: 'mm' }} project={{ files: [] }} onUpdate={noop} />);
    expectFieldValue(screen.getByLabelText('Thangs visibility'), 'private'); expectFieldValue(screen.getByLabelText('Thangs structure'), 'single');
  });
  it('renders Thingiverse as draft-first and upload-ready with license choices', () => {
    render(<ThingiverseOptions opts={{ publication: 'draft', license: 'cc-nc' }} project={{ files: [] }} onUpdate={noop} />);
    expect(screen.getByText(/Direct upload ready:/)).toBeInTheDocument(); expectFieldValue(screen.getByLabelText('Thingiverse action'), 'draft'); expectFieldValue(screen.getByLabelText('Thingiverse license'), 'cc-nc');
    expect(screen.getByLabelText('Thingiverse Customizer')).toBeDisabled();
  });
  it('enables Thingiverse Customizer only for SCAD uploads and fails closed for stale state', () => {
    render(<ThingiverseOptions opts={{ publication: 'draft', license: 'cc-nc' }} project={{ files: [{ name: 'customizer.scad' }] }} onUpdate={noop} />);
    expect(screen.getByLabelText('Thingiverse Customizer')).toBeEnabled();
    const result = platformPreflight({ id: 'thingiverse', name: 'Thingiverse', formats: ['stl', 'scad'], limits: {} }, {
      files: [{ name: 'part.stl', size: 1, isModel: true }], images: [{ id: 'cover' }], coverImageId: 'cover',
      title: 'Dragon', description: 'A dragon', category: 'toys', tags: [],
      platforms: { thingiverse: { summary: 'A dragon', categoryId: '124', license: 'cc-nc', publication: 'draft', customizable: true } },
    });
    expect(result.errors).toContain('Thingiverse Customizer requires at least one .SCAD model file.');
  });

  // Swapping your own files into a project that has print profiles enabled --
  // which the demo does -- used to disqualify MakerOnline from the entire batch
  // over an optional extra. The raw model files still upload, so it warns.
  it('does not block MakerOnline when print profiles are on but no .3mf exists', () => {
    const project = (files) => ({
      files, images: [{ id: 'c' }], coverImageId: 'c', media: [], title: 'Desk Dragon',
      description: 'A dragon', category: 'toys', tags: ['dragon'], license: 'CC BY-NC',
      platforms: { makeronline: { categoryId: '104', includePrintProfile: true, printMethod: 3 } },
    });
    const platform = { id: 'makeronline', name: 'MakerOnline', formats: ['stl', '3mf'], limits: {} };
    const blob = new Blob(['x']);

    const missing = platformPreflight(platform, project([{ name: 'Ram.stl', size: 1, blob, isModel: true }]));
    expect(missing.errors).toEqual([]);
    expect(missing.warnings.join(' ')).toMatch(/no \.3mf; the raw model files still upload/i);

    const present = platformPreflight(platform, project([
      { name: 'Ram.stl', size: 1, blob, isModel: true }, { name: 'Ram.3mf', size: 1, blob, isModel: true },
    ]));
    expect(present.errors).toEqual([]);
    expect(present.warnings.join(' ')).not.toMatch(/no \.3mf/i);
  });

  // The one MakerOnline field with no workable default, so it must stay a blocker.
  it('still blocks MakerOnline when no leaf category is chosen', () => {
    const result = platformPreflight({ id: 'makeronline', name: 'MakerOnline', formats: ['stl'], limits: {} }, {
      files: [{ name: 'Ram.stl', size: 1, blob: new Blob(['x']) }], images: [{ id: 'c' }], coverImageId: 'c',
      media: [], title: 'Desk Dragon', description: 'A dragon', category: 'toys', tags: ['dragon'],
      license: 'CC BY-NC', platforms: { makeronline: { categoryId: '' } },
    });
    expect(result.errors.join(' ')).toMatch(/leaf category/i);
  });
});

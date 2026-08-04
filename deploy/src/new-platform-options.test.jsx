// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MakerRoadOptions, ThangsOptions, ThingiverseOptions, makerRoadReadbackIssues, platformPreflight } from './App.jsx';

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
    expect(result.warnings).toContain('MakerRoad’s current upload form has no native video field; video media will not upload.');
  });
  it('fails closed when MakerRoad edit readback loses uploaded media or changes privacy', () => {
    const issues = makerRoadReadbackIssues({ title: 'Dragon', visibility: 'private', scheduled: false, payType: 'free', models: 1, profiles: 0, documents: 1, images: 3 }, {
      name: 'Dragon', visible: 1, plan: 1, payType: 1, fileModel: 'model-1', filePrintconf: '', fileDoc: '', pics: 'image-1|image-2',
    });
    expect(issues.join(' ')).toMatch(/visibility.*instruction documents.*images/i);
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
  it('renders Thangs privacy and structure controls', () => {
    render(<ThangsOptions opts={{ publication: 'private', structure: 'single', units: 'mm' }} project={{ files: [] }} onUpdate={noop} />);
    expect(screen.getByLabelText('Thangs visibility')).toHaveValue('private'); expect(screen.getByLabelText('Thangs structure')).toHaveValue('single');
  });
  it('renders Thingiverse as draft-first and upload-ready with license choices', () => {
    render(<ThingiverseOptions opts={{ publication: 'draft', license: 'cc-nc' }} project={{ files: [] }} onUpdate={noop} />);
    expect(screen.getByText(/Direct upload ready:/)).toBeInTheDocument(); expect(screen.getByLabelText('Thingiverse action')).toHaveValue('draft'); expect(screen.getByLabelText('Thingiverse license')).toHaveValue('cc-nc');
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
});

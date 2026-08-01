// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MakerRoadOptions, ThangsOptions, ThingiverseOptions } from './App.jsx';

afterEach(cleanup);
const noop = vi.fn();
describe('new direct-platform option parity', () => {
  it('renders MakerRoad action, source, license and print branches', () => {
    render(<MakerRoadOptions opts={{ publication: 'draft', uploadType: 1, categoryIds: [], printMethods: ['FDM'], licenseIndex: 0, visibility: 'private', payType: 'free' }} onUpdate={noop} />);
    expect(screen.getByLabelText('MakerRoad batch action')).toBeInTheDocument(); expect(screen.getByLabelText('MakerRoad license')).toBeInTheDocument();
  });
  it('renders Thangs privacy and structure controls', () => {
    render(<ThangsOptions opts={{ publication: 'private', structure: 'single', units: 'mm' }} project={{ files: [] }} onUpdate={noop} />);
    expect(screen.getByLabelText('Thangs visibility')).toHaveValue('private'); expect(screen.getByLabelText('Thangs structure')).toHaveValue('single');
  });
  it('renders Thingiverse as draft-first and upload-ready with license choices', () => {
    render(<ThingiverseOptions opts={{ publication: 'draft', license: 'cc-nc' }} onUpdate={noop} />);
    expect(screen.getByText(/Direct upload ready:/)).toBeInTheDocument(); expect(screen.getByLabelText('Thingiverse action')).toHaveValue('draft'); expect(screen.getByLabelText('Thingiverse license')).toHaveValue('cc-nc');
  });
});

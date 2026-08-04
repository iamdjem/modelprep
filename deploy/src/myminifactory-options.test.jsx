// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MyMiniFactoryOptions } from './App.jsx';

describe('MyMiniFactory-specific upload options', () => {
  it('exposes the captured visibility, license, print, remix, and declaration fields', () => {
    const onUpdate = vi.fn();
    render(<MyMiniFactoryOptions
      opts={{
        publication: 'private', categoryIds: [60, 462], licenseId: 5, technology: 'FDM', materialQuantity: '45 g',
        dimensions: '120 × 75 × 45', dimensionsUnit: 0, timeFrom: 3, timeTo: 5,
        printingTips: 'No supports', supportFree: true, remix: true,
        remixParentIds: ['123', '456'], confirmOriginalNoAi: true,
      }}
      onUpdate={onUpdate}
    />);

    expect(screen.getByLabelText(/visibility/i)).toHaveValue('private');
    expect(screen.getByLabelText(/MyMiniFactory category/i)).toHaveValue('462');
    expect(screen.getByRole('option', { name: 'Toys › Articulated' })).toBeInTheDocument();
    expect(screen.getByLabelText(/license/i)).toHaveValue('5');
    expect(screen.getByLabelText(/technology/i)).toHaveValue('FDM');
    expect(screen.getByLabelText(/material quantity/i)).toHaveValue('45 g');
    expect(screen.getByLabelText(/material quantity/i)).toHaveAttribute('maxlength', '45');
    expect(screen.getByLabelText(/^dimensions$/i)).toHaveValue('120 × 75 × 45');
    expect(screen.getByLabelText(/^dimensions$/i)).toHaveAttribute('maxlength', '100');
    // `.mp-input` sets width:100%, which outranked the w-20 utility and
    // collapsed this field to a few pixels in the packaged app.
    expect(screen.getByLabelText(/^dimensions$/i)).toHaveStyle({ flex: '1 1 0%' });
    expect(screen.getByLabelText(/dimensions unit/i)).toHaveStyle({ width: '5rem' });
    expect(screen.getByLabelText(/printing tips/i)).toHaveValue('No supports');
    // MyMiniFactory stores this range in minutes ("Time to print … in minutes";
    // the object page renders "Time to do 3 - 5 minutes"). Labelling it hours
    // silently published a 60x-wrong value that read back unchanged.
    expect(screen.getByText(/print time range \(minutes\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/print time range \(hours\)/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/parent MyMiniFactory object IDs/i)).toHaveValue('123, 456');
    expect(screen.getByText(/Required declaration:/i).closest('label').querySelector('input')).toBeChecked();

    fireEvent.change(screen.getByLabelText(/MyMiniFactory category/i), { target: { value: '780' } });
    expect(onUpdate).toHaveBeenCalledWith('categoryIds', [1015, 785, 780]);
  });

  it('accepts only a numeric existing-object ID for the read-only re-read', () => {
    const onUpdate = vi.fn();
    const view = within(render(<MyMiniFactoryOptions opts={{ publication: 'private', categoryIds: [60, 462], verifyObjectId: '829284' }} onUpdate={onUpdate} />).container);

    const field = view.getByLabelText(/existing MyMiniFactory object ID to verify/i);
    expect(field).toHaveValue('829284');
    expect(view.getByText(/never creates or edits an object/i)).toBeInTheDocument();

    fireEvent.change(field, { target: { value: '829284/../upload/object' } });
    expect(onUpdate).toHaveBeenCalledWith('verifyObjectId', '829284');
  });
});

// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByLabelText(/^dimensions$/i)).toHaveValue('120 × 75 × 45');
    expect(screen.getByLabelText(/printing tips/i)).toHaveValue('No supports');
    expect(screen.getByLabelText(/parent MyMiniFactory object IDs/i)).toHaveValue('123, 456');
    expect(screen.getByText(/Required declaration:/i).closest('label').querySelector('input')).toBeChecked();

    fireEvent.change(screen.getByLabelText(/MyMiniFactory category/i), { target: { value: '780' } });
    expect(onUpdate).toHaveBeenCalledWith('categoryIds', [1015, 785, 780]);
  });
});

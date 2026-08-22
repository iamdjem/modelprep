// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from './App.jsx';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in test'))));
});

const toDetails = async (user) => user.click(screen.getByRole('button', { name: /step 2: details/i }));
const titleInput = () => screen.getByPlaceholderText('e.g. Articulating Desk Dragon');

describe('the draft panel', () => {
  it('offers to write from a prompt when nothing is written, and to improve once something is', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toDetails(user);

    await user.click(screen.getByRole('button', { name: /draft listing/i }));
    const panel = screen.getByTestId('draft-panel');
    expect(within(panel).getByRole('button', { name: /start from a prompt/i })).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).getByText(/what is this model\?/i)).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: /close/i }));

    await user.type(titleInput(), 'Bracket');
    await user.click(screen.getByRole('button', { name: /improve listing/i }));
    const again = screen.getByTestId('draft-panel');
    expect(within(again).getByRole('button', { name: /improve what i wrote/i })).toHaveAttribute('aria-pressed', 'true');
    expect(within(again).getByText(/anything to change or add/i)).toBeInTheDocument();
  });

  it('improving needs an AI provider, and says so instead of guessing', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toDetails(user);
    await user.type(titleInput(), 'Bracket');
    await user.click(screen.getByRole('button', { name: /improve listing/i }));
    await user.click(within(screen.getByTestId('draft-panel')).getByRole('button', { name: /^improve$/i }));
    expect(await within(screen.getByTestId('draft-panel')).findByRole('status')).toHaveTextContent(/needs an AI provider/i);
    expect(titleInput()).toHaveValue('Bracket');
  });

  it('lets you edit a proposal before using it, and never touches the page until then', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toDetails(user);
    await user.type(titleInput(), 'Bracket');
    await user.click(screen.getByRole('button', { name: /improve listing/i }));
    const panel = screen.getByTestId('draft-panel');
    // Start over from a prompt, with no AI: the offline writer drafts from the hint.
    await user.click(within(panel).getByRole('button', { name: /start from a prompt/i }));
    await user.type(within(panel).getByLabelText(/hint for the draft/i), 'wall bracket for headphones');
    await user.click(within(panel).getByRole('button', { name: /^draft$/i }));

    const offer = await within(panel).findByTestId('draft-offer-title');
    expect(titleInput()).toHaveValue('Bracket'); // still yours
    const proposed = within(offer).getByLabelText(/proposed title/i);
    await user.clear(proposed);
    await user.type(proposed, 'Headphone wall bracket');
    await user.click(within(offer).getByRole('button', { name: /use this/i }));
    await waitFor(() => expect(titleInput()).toHaveValue('Headphone wall bracket'));
    expect(within(panel).getByRole('status')).toHaveTextContent(/replaced title/i);
  });

  it('adds tags to yours instead of swapping them', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toDetails(user);
    await user.type(screen.getByLabelText(/add a tag/i), 'mine{Enter}');
    await user.click(screen.getByRole('button', { name: /draft listing/i }));
    const panel = screen.getByTestId('draft-panel');
    await user.type(within(panel).getByLabelText(/hint for the draft/i), 'wall bracket for headphones');
    await user.click(within(panel).getByRole('button', { name: /^draft$/i }));
    const offer = await within(panel).findByTestId('draft-offer-tags');
    expect(within(offer).getByLabelText(/proposed tags/i).value.split(', ')).toContain('mine');
    expect(within(offer).getByText(/\d+ new, 1 kept/)).toBeInTheDocument();
  });
});

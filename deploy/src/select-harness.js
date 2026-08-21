// Driving our Select from a test.
//
// A native <select> takes fireEvent.change with a value. Ours is a listbox: the
// trigger opens it and the option is a button. These two helpers keep that
// difference in one place instead of in every test that picks something.
import { fireEvent, screen, within } from '@testing-library/react';
import { expect } from 'vitest';

/** The trigger for the select labelled `label`. */
export function selectTrigger(label, scope = screen) {
  return scope.getByRole('combobox', { name: label });
}

/**
 * Pick an option by its visible text.
 *
 * `option` may be a string or a RegExp. Pass `scope` when more than one select
 * on the screen offers the same option text.
 */
export function chooseOption(label, option, scope = screen) {
  const trigger = selectTrigger(label, scope);
  fireEvent.click(trigger);
  const list = document.getElementById(trigger.getAttribute('aria-controls')) || document;
  const choice = within(list === document ? document.body : list)
    .getByRole('option', { name: option });
  fireEvent.click(choice);
  return trigger;
}

/**
 * The labels currently offered by the select.
 *
 * Opens it, reads it, and closes it with a second click on the trigger. Escape
 * would be closer to how a person closes it, but the handler lives on the
 * component's wrapper and a synthetic keydown on the body never reaches it, so
 * the list stayed open and the next call toggled it shut instead.
 */
export function optionLabels(label, scope = screen) {
  const trigger = selectTrigger(label, scope);
  fireEvent.click(trigger);
  const labels = screen.getAllByRole('option').map((node) => node.textContent.trim());
  fireEvent.click(trigger);
  return labels;
}

/**
 * Assert a field holds `value`, whether it is a text input or one of our
 * comboboxes. A native select answered `toHaveValue`; a listbox trigger cannot,
 * so it carries the same information in `data-value`.
 */
export function expectFieldValue(element, value) {
  if (element.getAttribute('role') === 'combobox') {
    expect(element).toHaveAttribute('data-value', String(value));
    return;
  }
  expect(element).toHaveValue(value);
}

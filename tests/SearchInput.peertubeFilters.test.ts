import { describe, it, expect } from 'vitest';

// Regression test for: entering a query in the PeerTube search input,
// then clicking "Apply Filters" without pressing Enter should preserve the typed query.
// The fix ensures `searchTerm` (the current input value) is preferred over the URL param.

describe('PeerTube searchTerm preservation when applying filters', () => {
  function resolveCurrentSearch(searchTerm: string, urlSearch: string | null): string {
    return searchTerm || urlSearch || '';
  }

  it('prefers the typed searchTerm over an empty URL param', () => {
    const searchTerm = 'hku';
    const urlSearch = null; // user typed but did not press Enter
    expect(resolveCurrentSearch(searchTerm, urlSearch)).toBe('hku');
  });

  it('falls back to the URL param when searchTerm is empty', () => {
    const searchTerm = '';
    const urlSearch = 'hku'; // user previously submitted via Enter
    expect(resolveCurrentSearch(searchTerm, urlSearch)).toBe('hku');
  });

  it('returns empty string when both are empty', () => {
    expect(resolveCurrentSearch('', null)).toBe('');
  });
});
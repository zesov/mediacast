import { describe, it, expect, vi, beforeEach } from 'vitest';

// This test simulates the issue: handleApplyFilters calls setFilters then runSearch,
// but runSearch uses stale filters from closure

describe('PeerTubePage filter application bug', () => {
  it('should demonstrate the stale closure bug in handleApplyFilters', () => {
    // Simulating the current buggy implementation
    let filtersState = { sort: '-match' as const };
    let runSearchCalledWith: any = null;
    
    // Mock setFilters (ASYNC like React useState!)
    const setFilters = vi.fn((updater: (prev: any) => any) => {
      // In React, setState is async - the updater runs but the component
      // doesn't re-render immediately, so the closure still has old value
      filtersState = updater(filtersState);
      // But runSearch uses the CLOSURE value, not the updated state!
    });
    
    // runSearch uses filtersState from closure (STALE!)
    // In the real component, this is captured at render time
    const closureFilters = filtersState;
    const runSearch = (query: string) => {
      runSearchCalledWith = { query, filters: closureFilters }; // Uses stale closure!
    };
    
    // Buggy handleApplyFilters
    const handleApplyFilters = (newFilters: any) => {
      setFilters((prev: any) => ({ ...prev, ...newFilters }));
      runSearch('test query'); // Called immediately, but closureFilters not updated yet!
    };
    
    // Apply new filters
    handleApplyFilters({ sort: '-publishedAt', nsfw: true });
    
    // BUG: runSearch receives OLD filters from closure, not the new ones
    expect(runSearchCalledWith.filters.sort).toBe('-match'); // Old value from closure!
    expect(runSearchCalledWith.filters.nsfw).toBeUndefined(); // Old value!
  });

  it('should work correctly when passing merged filters to runSearch', () => {
    // Fixed implementation: pass merged filters directly to runSearch
    let filtersState = { sort: '-match' as const };
    let runSearchCalledWith: any = null;
    
    const setFilters = (updater: (prev: any) => any) => {
      filtersState = updater(filtersState);
    };
    
    const runSearch = (query: string, currentFilters: any) => {
      runSearchCalledWith = { query, filters: currentFilters };
    };
    
    // FIXED handleApplyFilters
    const handleApplyFilters = (newFilters: any) => {
      const mergedFilters = { ...filtersState, ...newFilters };
      setFilters(() => mergedFilters);
      runSearch('test query', mergedFilters); // Pass merged filters directly!
    };
    
    handleApplyFilters({ sort: '-publishedAt', nsfw: true });
    
    // FIXED: runSearch receives NEW filters
    expect(runSearchCalledWith.filters.sort).toBe('-publishedAt');
    expect(runSearchCalledWith.filters.nsfw).toBe(true);
  });
});
import React from 'react';
import { AppState, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { useReviewAccess } from '@/hooks/useReviewAccess';
import { hasReviewAccess } from '@/lib/review-access';
let mockOwner = 'one';
let mockFetch: jest.Mock;
jest.mock('@/lib/firebase-native', () => ({ getFirebaseAccountScope: () => mockOwner, getFirebaseCallableContracts: async () => ({ getReviewAccess: () => mockFetch() }) }));
function Screen({ owner = 'one' }: {
    owner?: string;
}) { mockOwner = owner; const proof = useReviewAccess(owner); return <Text>{hasReviewAccess(proof.snapshot, owner) ? 'Review access' : 'No review access'}</Text>; }
let listener: (state: any) => void;
const proof = (ownerUid = 'one', ms = 60000) => ({ reviewAccessVersion: 1, ownerUid, access: 'review', expiresAt: new Date(Date.now() + ms).toISOString(), capabilities: ['ad-free', 'premium-features'] });
async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }
beforeEach(() => { jest.useFakeTimers(); mockOwner = 'one'; mockFetch = jest.fn().mockResolvedValue(proof()); jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, fn) => { listener = fn; return { remove: () => { } }; }); Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' }); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });
test('foreground invalidates cached review proof until fresh fetch and revocation removes access', async () => { const screen = render(<Screen />); await flush(); expect(screen.getByText('Review access')).toBeTruthy(); act(() => listener('background')); expect(screen.getByText('No review access')).toBeTruthy(); mockFetch.mockResolvedValue({ reviewAccessVersion: 1, ownerUid: 'one', access: 'none', expiresAt: null, capabilities: [] }); act(() => listener('active')); await flush(); expect(mockFetch).toHaveBeenCalledTimes(2); expect(screen.getByText('No review access')).toBeTruthy(); });
test('expiry removes access without a new tap, and failed fetch never retains proof', async () => { mockFetch.mockResolvedValue(proof('one', 1000)); const screen = render(<Screen />); await flush(); act(() => jest.advanceTimersByTime(1001)); expect(screen.getByText('No review access')).toBeTruthy(); mockFetch.mockRejectedValue(Error()); act(() => listener('active')); await flush(); expect(screen.getByText('No review access')).toBeTruthy(); });
test('stale asynchronous owner result cannot license a newly connected account', async () => { let resolve!: (v: any) => void; mockFetch.mockImplementationOnce(() => new Promise(r => { resolve = r; })); const screen = render(<Screen />); await flush(); mockFetch.mockResolvedValue(proof('two')); screen.rerender(<Screen owner="two"/>); await flush(); expect(screen.getByText('Review access')).toBeTruthy(); await act(async () => resolve(proof('one'))); expect(screen.getByText('Review access')).toBeTruthy(); });

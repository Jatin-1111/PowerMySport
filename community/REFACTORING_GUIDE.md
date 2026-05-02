# Community Project State Management Refactoring

## Problem Summary

The community project had severe state management issues causing "hallucinating" UI:

- **60+ useState** calls in `page.tsx` alone
- **Multiple uncoordinated loading flags** (isLoading, isLoadingMore, isSending, isSearching, isVotingKey, etc.)
- **Race conditions** from parallel API requests completing out-of-order
- **No abort handling** - stale requests would overwrite fresh data
- **Missing debouncing** on search inputs causing excessive API calls
- **Inconsistent error states** scattered across components

## Solution: Standardized Async Hooks

### 1. `useAsync<T>` Hook

**Purpose**: Single source of truth for async data fetching operations

**Benefits**:

- Unified `status: "idle" | "pending" | "success" | "error"` state machine
- Automatic AbortController for race condition prevention
- Replaces 3-5 useState calls with one
- Clean dependency tracking

**Before**:

```typescript
const [isLoading, setIsLoading] = useState(true);
const [data, setData] = useState([]);
const [error, setError] = useState(null);

useEffect(() => {
  setIsLoading(true);
  fetchData()
    .then((d) => setData(d))
    .catch((e) => setError(e))
    .finally(() => setIsLoading(false));
}, [deps]);
```

**After**:

```typescript
const {
  data = [],
  isLoading,
  error,
} = useAsync(async (signal) => fetchData({ signal }), [deps]);
```

### 2. `useMutationState` Hook

**Purpose**: Manage multiple concurrent mutations (voting, editing, deleting on different items)

**Before**: 5+ separate `isMutatingPostId`, `isVotingKey`, `isMutatingMessageId` flags

```typescript
const [isMutatingPostId, setIsMutatingPostId] = useState<string | null>(null);
const [isVotingKey, setIsVotingKey] = useState<string | null>(null);
```

**After**: Single unified mutation tracker

```typescript
const { mutate, isLoading: (id) => boolean, isError: (id) => boolean } = useMutationState(
  async (id, payload, signal) => votingService.upvote(id, { signal })
);

// Vote on multiple posts without state collision
mutate(postId1);
mutate(postId2);
mutate(postId3);
```

### 3. `usePlayerSearch` Hook

**Purpose**: Debounced search with race condition prevention

**Prevents Hallucination By**:

- Debouncing rapid input changes (300ms default)
- Aborting stale requests automatically
- Only rendering results for the _latest_ query

**Before**: UI could show results from query "a" while user typed "abc" because requests completed out-of-order

**After**: Guarantees UI always shows results for current user input

### 4. `useConversationState` Hook

**Purpose**: Consolidate conversation list + pagination + filtering into single hook

**Reduces**: 15+ useState calls to 5 organized state groups

- Core data (conversations, selection)
- Pagination (page, hasMore)
- Filters (search, groupFilter)
- Unified loading (isLoading, isLoadingMore)

## Migration Strategy

### Phase 1: New Hook Foundations (COMPLETED)

✅ Created 5 new hooks with proper TypeScript types and AbortController support
✅ No changes to existing components yet
✅ Hooks are ready for gradual adoption

### Phase 2: Low-Risk Refactoring (IN PROGRESS)

- ✅ GroupMembersList.tsx - refactored to use useAsync
- [ ] Search input components - refactor to use usePlayerSearch/useDebouncedSearch
- [ ] Vote/mutation buttons - refactor to use useMutationState

### Phase 3: Critical Components

- [ ] QnAFeedClient.tsx - extract to useConversationState + useMutationState
- [ ] QnAPostDetailClient.tsx - use useAsync for answers loading
- [ ] page.tsx - consolidate 60+ useState with new hooks

### Phase 4: Cleanup

- [ ] Remove old scattered state patterns
- [ ] Add loading skeletons for better UX
- [ ] Add retry logic for failed requests

## Key Improvements

| Issue                  | Before                                    | After                                      |
| ---------------------- | ----------------------------------------- | ------------------------------------------ |
| Multiple loading flags | `isLoading`, `isSending`, `isLoadingMore` | Single `status` state machine              |
| Race conditions        | No abort handling                         | Automatic AbortController per operation    |
| Search hallucination   | Results could show stale query            | Debounced + abort guarantees fresh results |
| Code complexity        | 60+ useState in one file                  | Hooks handle state logic                   |
| Error handling         | Scattered, inconsistent                   | Unified via hook return values             |
| Memory leaks           | useEffect cleanup sometimes forgotten     | Built into every hook                      |

## Integration Example

**Before** (page.tsx nightmare):

```typescript
// ~60 useState calls mixed together
const [isLoading, setIsLoading] = useState(true);
const [isSending, setIsSending] = useState(false);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const [conversations, setConversations] = useState([]);
const [playerSearchResults, setPlayerSearchResults] = useState([]);
const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
const [isMutatingPostId, setIsMutatingPostId] = useState(null);
const [isVotingKey, setIsVotingKey] = useState(null);
// ... 50+ more useState calls
```

**After** (cleaner, more maintainable):

```typescript
const conversations = useConversationState(fetchConversations);
const playerSearch = usePlayerSearch(searchPlayers);
const mutations = useMutationState(mutateFn);
const voting = useMutationState(voteFn);

// UI code:
<button disabled={voting.isLoading(postId)}>
  Vote
</button>

{playerSearch.results.map(player => (...))}
```

## Testing & Validation

- ✅ TypeScript compilation - no errors
- ✅ Hooks have AbortController cleanup in useEffect return
- ✅ Race condition prevention tested in hook logic
- ✅ Debouncing logic prevents rapid re-searches
- ✅ Migration to GroupMembersList validates approach

## Next Steps

1. **Update QnAFeedClient.tsx** to use new hooks (most critical)
2. **Update page.tsx** search functionality to use usePlayerSearch
3. **Add loading skeletons** during pending states
4. **Gradual migration** of remaining components

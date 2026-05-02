# QnAFeedClient.tsx Refactoring Strategy

## Current State (PROBLEMATIC)

- **30+ useState calls** mixed throughout component
- **Multiple loading flags**: isLoading, isLoadingMore, isLoadingActivity, isMarkingActivityRead, isSubmitting
- **Multiple mutation flags**: isMutatingPostId, isVotingKey
- **Form state scattered**: title, body, tags, sport, city (5+ separate states)
- **Filter state scattered**: searchInput, q, activeTag, sportFilterInput, cityFilterInput, sportFilter, cityFilter

## Refactoring Approach: Minimal Changes, Maximum Impact

Instead of a full rewrite (which would be risky), consolidate state in small, testable chunks:

### PART 1: Consolidate Loading Flags

**Before** (4 different flags):

```typescript
const [isLoading, setIsLoading] = useState(true);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const [isLoadingActivity, setIsLoadingActivity] = useState(false);
const [isMarkingActivityRead, setIsMarkingActivityRead] = useState(false);
```

**After** (1 consolidated state):

```typescript
const [loading, setLoading] = useState<{
  feed: "idle" | "pending" | "success" | "error";
  feedMore: "idle" | "pending" | "success" | "error";
  activity: "idle" | "pending" | "success" | "error";
  activityRead: "idle" | "pending" | "success" | "error";
}>({
  feed: "pending",
  feedMore: "idle",
  activity: "idle",
  activityRead: "idle",
});

// Usage everywhere:
// setLoading(prev => ({ ...prev, feed: "pending" }))
// loading.feed === "pending"
```

**Even Better** (use useMemo to derive booleans):

```typescript
const isLoading = loading.feed === "pending";
const isLoadingMore = loading.feedMore === "pending";
// ... rest of component can stay mostly unchanged
```

### PART 2: Consolidate Mutation Flags

**Before** (2 mutation-specific flags):

```typescript
const [isMutatingPostId, setIsMutatingPostId] = useState<string | null>(null);
const [isVotingKey, setIsVotingKey] = useState<string | null>(null);
```

**After** (replace with useMutationState hook):

```typescript
const voting = useMutationState(
  async (postId: string) => {
    // existing vote logic
    return result;
  },
  { onSuccess: handleVoteSuccess, onError: handleVoteError },
);

// Usage: voting.isLoading(postId) instead of isVotingKey === `POST:${postId}`
```

### PART 3: Consolidate Form State

**Before** (5 separate states):

```typescript
const [title, setTitle] = useState("");
const [body, setBody] = useState("");
const [tags, setTags] = useState("");
const [sport, setSport] = useState("");
const [city, setCity] = useState("");
```

**After** (single form state object):

```typescript
const [askForm, setAskForm] = useState({
  title: "",
  body: "",
  tags: "",
  sport: "",
  city: "",
});

const handleFormChange = (field: keyof typeof askForm, value: string) => {
  setAskForm((prev) => ({ ...prev, [field]: value }));
};
```

### PART 4: Consolidate Filter State

**Before** (7 filter-related states):

```typescript
const [searchInput, setSearchInput] = useState("");
const [q, setQ] = useState("");
const [activeTag, setActiveTag] = useState<string>("");
const [sportFilterInput, setSportFilterInput] = useState("");
const [cityFilterInput, setCityFilterInput] = useState("");
const [sportFilter, setSportFilter] = useState("");
const [cityFilter, setCityFilter] = useState("");
```

**After** (single filter state with input/committed split):

```typescript
const [filters, setFilters] = useState({
  search: { input: "", committed: "" },
  tag: "",
  sport: { input: "", committed: "" },
  city: { input: "", committed: "" },
});

// Debounce handlers:
useEffect(() => {
  const timer = setTimeout(() => {
    setFilters((prev) => ({
      ...prev,
      search: { ...prev.search, committed: prev.search.input },
    }));
  }, 260);
  return () => clearTimeout(timer);
}, [filters.search.input]);
```

## Estimated Reduction

- **Before**: 30+ useState calls
- **After**: 10-12 useState calls (form, filters, misc UI state)
- **Benefit**: Massive reduction in state synchronization bugs and race conditions

## Implementation Priority

### Phase A: Validation (ensures this approach works)

1. Create hooks in `/lib/hooks/` - ✅ DONE
2. Test hooks with GroupMembersList - ✅ DONE
3. Document approach - ✅ DONE

### Phase B: Core Fixes (prevents hallucination)

1. [ ] Consolidate loading flags → 1 object or use loading state object
2. [ ] Replace voting/mutation flags with useMutationState hook
3. [ ] Fix vote() function to use voting mutation state
4. [ ] Validate no TypeScript errors
5. [ ] Test voting UI still works

### Phase C: Additional Cleanup

1. [ ] Consolidate form state
2. [ ] Consolidate filter state
3. [ ] Add retry logic for failed requests

## Code Changes Needed

### File: QnAFeedClient.tsx

**Change 1: Add import**

```typescript
import { useMutationState } from "@/lib/hooks/useMutationState";
```

**Change 2: Replace voting flags (line ~75)**

```typescript
// REMOVE:
// const [isVotingKey, setIsVotingKey] = useState<string | null>(null);
// const [isMutatingPostId, setIsMutatingPostId] = useState<string | null>(null);

// ADD:
const voting = useMutationState(
  async (postId: string, payload: { value: 1 | -1 }) => {
    return await communityService.vote({
      targetType: "POST",
      targetId: postId,
      value: payload.value,
    });
  },
  {
    onSuccess: (postId, result) => {
      setPosts((current) =>
        current.map((item) =>
          item.id === postId
            ? {
                ...item,
                myVote: result.myVote,
                voteScore: result.voteScore,
                upvoteCount: result.upvoteCount,
                downvoteCount: result.downvoteCount,
              }
            : item,
        ),
      );
      void loadActivity();
    },
    onError: (postId, error) => {
      toast.error(error.message || "Failed to vote");
    },
  },
);
```

**Change 3: Update vote() function (line ~453)**

```typescript
// REPLACE:
// const vote = async (post: CommunityPost, value: 1 | -1) => {
//   const key = `POST:${post.id}`;
//   try {
//     setIsVotingKey(key);
//     ...

// WITH:
const vote = async (post: CommunityPost, value: 1 | -1) => {
  await voting.mutate(post.id, { value });
};
```

**Change 4: Update button disabled state (line ~1045)**

```typescript
// REPLACE:
// disabled={isVotingKey === voteKey}

// WITH:
disabled={voting.isLoading(post.id)}
```

## Result

After these changes:

- ✅ No more race conditions with voting (AbortController in hook)
- ✅ UI can't render while mutation pending
- ✅ Multiple votes on different posts work independently
- ✅ Automatic cleanup on unmount
- ✅ Backward compatible with rest of component

## Next Steps

1. Apply Phase B changes (1-2 hours)
2. Test voting functionality
3. Validate no new errors
4. Then Phase C cleanup (form/filter consolidation)

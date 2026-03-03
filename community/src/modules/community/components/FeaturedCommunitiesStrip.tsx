import { CommunityGroupSummary } from "@/modules/community/types";

type FeaturedCommunitiesStripProps = {
  groups: CommunityGroupSummary[];
  getActionLabel: (group: CommunityGroupSummary) => string;
  onGroupAction: (group: CommunityGroupSummary) => void;
  onViewAll: () => void;
};

export function FeaturedCommunitiesStrip({
  groups,
  getActionLabel,
  onGroupAction,
  onViewAll,
}: FeaturedCommunitiesStripProps) {
  return (
    <section className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Explore communities
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-900">
            Popular groups near players like you
          </h3>
        </div>
        <button
          onClick={onViewAll}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          View all
        </button>
      </div>

      {groups.length ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 xl:grid-cols-3 sm:overflow-visible sm:pb-0">
          {groups.map((group) => {
            const actionLabel = getActionLabel(group);
            return (
              <article
                key={group.id}
                className="min-w-60 rounded-xl border border-border bg-slate-50 p-3 sm:min-w-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                    {group.name}
                  </p>
                  {group.isMember && (
                    <span className="rounded-full bg-turf-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-turf-green">
                      Joined
                    </span>
                  )}
                </div>
                {(group.sport || group.city) && (
                  <p className="mt-1 text-xs text-slate-500">
                    {[group.sport, group.city].filter(Boolean).join(" • ")}
                  </p>
                )}
                <p className="mt-3 text-xs font-medium text-slate-500">
                  {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                </p>
                <button
                  onClick={() => onGroupAction(group)}
                  className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    !group.isMember
                      ? "bg-power-orange text-white hover:opacity-90"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {actionLabel}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-slate-50 px-4 py-3 text-sm text-slate-500">
          No communities available yet. Create one below to get started.
        </p>
      )}
    </section>
  );
}

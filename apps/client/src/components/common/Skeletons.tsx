export function HeroSkeleton() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-obsidian-950 animate-pulse">
      {/* Background shimmer */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-obsidian-900 via-obsidian-800/40 to-obsidian-900" />
      <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-obsidian-950/70 to-transparent" />

      <div className="cx-cinema-pattern relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-8">
            {/* Pill */}
            <div className="h-7 w-56 rounded-full bg-white/10" />

            {/* Title */}
            <div className="space-y-3">
              <div className="h-12 sm:h-16 w-3/4 rounded-2xl bg-white/15" />
              <div className="h-12 sm:h-16 w-1/2 rounded-2xl bg-white/10" />
            </div>

            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="h-8 w-24 rounded-lg bg-gold-500/15" />
              <div className="h-8 w-20 rounded-lg bg-white/10" />
              <div className="h-8 w-24 rounded-lg bg-white/10" />
              <div className="h-8 w-36 rounded-lg bg-white/10" />
            </div>

            {/* Genre pills */}
            <div className="flex gap-2 pt-1">
              <div className="h-6 w-16 rounded-full bg-white/10" />
              <div className="h-6 w-20 rounded-full bg-white/10" />
              <div className="h-6 w-16 rounded-full bg-white/10" />
            </div>

            {/* Overview lines */}
            <div className="space-y-2.5 pt-2 max-w-2xl">
              <div className="h-4 w-full rounded bg-white/10" />
              <div className="h-4 w-11/12 rounded bg-white/10" />
              <div className="h-4 w-4/5 rounded bg-white/10" />
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <div className="h-13 w-52 rounded-xl bg-gold-500/20" />
              <div className="h-13 w-44 rounded-xl bg-white/10" />
            </div>
          </div>

          {/* Right Column Experience Box */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-obsidian-900/60 p-6 space-y-4">
              <div className="h-4 w-28 rounded bg-white/15" />
              <div className="space-y-3">
                <div className="h-16 w-full rounded-xl bg-white/5" />
                <div className="h-16 w-full rounded-xl bg-white/5" />
                <div className="h-16 w-full rounded-xl bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-obsidian-900/80 animate-pulse">
      {/* Poster placeholder */}
      <div className="relative aspect-[2/3] w-full bg-obsidian-800">
        <div className="absolute top-3 left-3 h-6 w-14 rounded-md bg-white/10" />
        <div className="absolute bottom-2.5 right-2.5 h-5 w-24 rounded-md bg-white/10" />
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4 space-y-4">
        <div className="space-y-2">
          <div className="h-5 w-4/5 rounded bg-white/15" />
          <div className="flex justify-between">
            <div className="h-3.5 w-12 rounded bg-white/10" />
            <div className="h-3.5 w-12 rounded bg-white/10" />
          </div>
          <div className="h-3 w-2/3 rounded bg-white/10" />
        </div>

        <div className="h-9 w-full rounded-xl bg-white/10" />
      </div>
    </div>
  );
}

export function MovieGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <MovieCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MovieDetailsSkeleton() {
  return (
    <div className="space-y-12 pb-24 animate-pulse">
      {/* Header Backdrop */}
      <div className="relative overflow-hidden border-b border-white/10 bg-obsidian-950">
        <div className="h-72 sm:h-96 w-full bg-obsidian-900" />
        <div className="mx-auto max-w-7xl px-4 sm:px-8 -mt-36 sm:-mt-48 relative z-10">
          <div className="flex flex-col sm:flex-row gap-8 items-start">
            {/* Poster */}
            <div className="aspect-[2/3] w-48 sm:w-64 rounded-2xl bg-obsidian-800 border-2 border-white/10 shadow-2xl shrink-0" />

            {/* Info */}
            <div className="flex-1 space-y-4 pt-4 sm:pt-16">
              <div className="h-10 w-3/4 rounded-xl bg-white/15" />
              <div className="flex gap-3">
                <div className="h-6 w-20 rounded bg-gold-500/20" />
                <div className="h-6 w-16 rounded bg-white/10" />
                <div className="h-6 w-24 rounded bg-white/10" />
              </div>
              <div className="space-y-2 max-w-2xl pt-2">
                <div className="h-4 w-full rounded bg-white/10" />
                <div className="h-4 w-5/6 rounded bg-white/10" />
                <div className="h-4 w-3/4 rounded bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Showtimes Section Skeleton */}
      <div className="mx-auto max-w-7xl px-4 sm:px-8 space-y-6">
        <div className="h-8 w-60 rounded bg-white/15" />
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-xl bg-white/10" />
          <div className="h-10 w-32 rounded-xl bg-white/10" />
          <div className="h-10 w-32 rounded-xl bg-white/10" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-32 rounded-2xl bg-white/5 border border-white/10" />
          <div className="h-32 rounded-2xl bg-white/5 border border-white/10" />
          <div className="h-32 rounded-2xl bg-white/5 border border-white/10" />
        </div>
      </div>
    </div>
  );
}

export function TicketListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 animate-pulse">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col justify-between rounded-2xl border border-white/10 bg-surface p-5 space-y-4"
        >
          <div className="flex items-start gap-4">
            <div className="h-24 w-16 rounded-lg bg-white/10 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-24 rounded bg-gold-500/20" />
              <div className="h-5 w-4/5 rounded bg-white/15" />
              <div className="h-3.5 w-32 rounded bg-white/10" />
              <div className="h-3 w-40 rounded bg-white/10" />
            </div>
          </div>
          <div className="h-14 rounded-xl bg-obsidian-950" />
          <div className="h-10 rounded-xl bg-white/10" />
        </div>
      ))}
    </div>
  );
}

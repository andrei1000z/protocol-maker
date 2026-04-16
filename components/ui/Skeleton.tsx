import clsx from 'clsx';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('animate-pulse rounded-xl bg-card-border/30', className)} />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-card border border-card-border p-5 space-y-3">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
      <div className="rounded-2xl bg-card border border-card-border p-6">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 rounded-xl bg-background border border-card-border text-center">
              <Skeleton className="h-10 w-16 mx-auto" />
              <Skeleton className="h-3 w-20 mx-auto mt-2" />
            </div>
          ))}
        </div>
      </div>
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

export function TrackingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <Skeleton className="h-7 w-40 mx-auto" />
      <Skeleton className="h-4 w-32 mx-auto" />
      <div className="flex justify-center"><Skeleton className="h-32 w-32 rounded-full" /></div>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

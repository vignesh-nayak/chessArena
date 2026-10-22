import { TopBar } from "./TopBar";

export function LoadingPulse({
  lines = 3,
  className = "space-y-3",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="h-4 animate-pulse bg-muted/30"
          style={{ width: `${100 - index * 12}%` }}
        />
      ))}
    </div>
  );
}

export function ListLoading() {
  return (
    <div className="flex min-h-full flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
        <LoadingPulse lines={5} className="mt-10 space-y-3" />
      </main>
    </div>
  );
}

export function BoardLoading() {
  return (
    <div className="flex min-h-full flex-col">
      <TopBar />
      <div
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-8 lg:flex-row lg:items-start lg:justify-center lg:gap-8"
        role="status"
        aria-label="Loading"
      >
        <div className="aspect-square w-full max-w-[min(70vh,100%)] animate-pulse bg-muted/20" />
        <div className="flex w-full flex-col gap-3 lg:w-64 lg:shrink-0">
          <div className="h-4 w-2/3 animate-pulse bg-muted/30" />
          <div className="h-4 w-1/2 animate-pulse bg-muted/30" />
          <div className="h-4 w-3/4 animate-pulse bg-muted/30" />
        </div>
      </div>
    </div>
  );
}

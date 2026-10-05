/** Full-screen spinner shown while auth state or a route's code is loading. */
export function PageLoader({ fullScreen = true }: { fullScreen?: boolean }) {
  return (
    <div className={`flex items-center justify-center bg-background ${fullScreen ? "min-h-screen" : "min-h-[50vh]"}`}>
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

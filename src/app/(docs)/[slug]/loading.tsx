export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-(--bg) text-(--text)">
      <div className="md-scale-in flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--text-subtle)/30 border-t-(--text)" />
        <p className="text-[12.5px] font-medium tracking-tight text-(--text-muted)">Loading specification…</p>
      </div>
    </div>
  );
}

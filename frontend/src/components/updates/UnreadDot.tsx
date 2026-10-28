export function UnreadDot({ className = '' }: { className?: string }) {
  return (
    <span className={`pointer-events-none ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
      </span>
      <span className="sr-only">Novidades não lidas</span>
    </span>
  );
}

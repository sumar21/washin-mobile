import { cn } from "@/lib/utils";

export function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex min-h-screen items-stretch justify-center bg-muted">
      <div
        className={cn(
          "relative flex w-full max-w-[480px] flex-col bg-background shadow-2xl sm:my-4 sm:min-h-[720px] sm:rounded-3xl sm:overflow-hidden md:my-8",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

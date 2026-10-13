import { type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

/** A contained section frame shared by the auth pages. */
export function AuthPageFrame({ children, wide = false }: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-ui-background p-4 text-base-fg dark:text-white sm:py-10">
      <div className={twMerge("relative w-full", wide ? "max-w-lg lg:max-w-5xl" : "max-w-lg")}>
        <div className="relative rounded-2xl border border-black/10 dark:border-white/20 bg-ui-panel dark:bg-ui-controls overflow-hidden shadow-2xl">
          <div className={twMerge("flex", wide ? "lg:min-h-[560px]" : "flex-col")}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

import * as React from "react";
import * as S from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export const ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => (
  <S.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    <S.Viewport className="h-full w-full rounded-[inherit]">{children}</S.Viewport>
    <S.Scrollbar orientation="vertical" className="flex h-full w-2.5 touch-none select-none border-l border-l-transparent p-px transition-colors">
      <S.Thumb className="relative flex-1 rounded-full bg-border" />
    </S.Scrollbar>
    <S.Corner />
  </S.Root>
));
ScrollArea.displayName = "ScrollArea";

// Shim de @tanstack/react-router pour la build statique (artifact) :
// la démo n'a qu'une route ; « Note » pointe vers la note publiée sur GitHub.
import type { AnchorHTMLAttributes, ReactNode } from "react";

export const NOTE_URL =
  "https://github.com/JLG-WOCFR-DEV/site-demo-webgpu-novembre-2026/blob/main/NOTE.md";

export function createFileRoute(_path: string) {
  return <T,>(options: T) => ({ options });
}

export function Link({ to: _to, children, ...rest }: { to: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={NOTE_URL} target="_blank" rel="noreferrer" {...rest}>
      {children}
    </a>
  );
}

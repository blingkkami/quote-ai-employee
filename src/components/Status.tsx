import React from "react";

export function Status({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`status ${tone}`}>{children}</span>;
}

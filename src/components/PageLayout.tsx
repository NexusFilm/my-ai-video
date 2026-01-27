"use client";

import { Header } from "./Header";

interface PageLayoutProps {
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  showLogoAsLink?: boolean;
}

export function PageLayout({
  children,
  rightContent,
  showLogoAsLink = false,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col overflow-y-auto">
      <header className="flex justify-between items-start py-8 px-12 shrink-0">
        <Header asLink={showLogoAsLink} />
        {rightContent}
      </header>
      {children}
    </div>
  );
}

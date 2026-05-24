"use client";

import { useCallback } from "react";

export function SkipLink() {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      const main = document.getElementById("main-content");
      if (main) {
        main.tabIndex = -1;
        main.focus();
        main.scrollIntoView({ behavior: "smooth" });
      }
    },
    [],
  );

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-gray-900 focus:rounded focus:shadow-lg focus:outline focus:outline-2 focus:outline-blue-600"
    >
      Skip to main content
    </a>
  );
}

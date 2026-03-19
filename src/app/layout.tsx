import { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "Bracket Signal",
  description: "Data-driven NCAA tournament upset analysis and interactive bracket building.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

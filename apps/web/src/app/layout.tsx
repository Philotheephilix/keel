import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Keel — Crash insurance for your crypto, paid automatically",
  description:
    "Parametric on-chain crash insurance, backed by your own holdings. Built on DeepBook Predict (Sui). Non-custodial, no seed phrase, no claims.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Root provides only providers — the landing page (/) owns its own chrome,
  // and the (app) route group wraps product pages in the NotebookShell.
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

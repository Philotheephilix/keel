import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "@/components/TopNav";

export const metadata: Metadata = {
  title: "Keel — crash insurance for your crypto",
  description: "On-chain parametric crash insurance, backed by your own holdings. Built on DeepBook Predict.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <TopNav />
          <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 80px" }}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}

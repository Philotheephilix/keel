import { NotebookShell } from "@/components/NotebookShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <NotebookShell>{children}</NotebookShell>;
}

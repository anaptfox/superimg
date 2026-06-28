import { TopNav } from "@/components/landing/TopNav";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
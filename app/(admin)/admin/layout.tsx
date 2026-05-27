export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full bg-[#eef3ef] text-[#063f35]">
      <main className="min-h-dvh">{children}</main>
    </div>
  );
}

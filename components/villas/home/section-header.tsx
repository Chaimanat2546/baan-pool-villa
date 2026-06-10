interface SectionHeaderProps {
  align?: "center" | "left";
  description: string;
  eyebrow?: string;
  title: string;
};

export function SectionHeader({
  align = "center",
  description,
  eyebrow,
  title,
}: SectionHeaderProps) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow ? (
        <p className="text-xs font-black uppercase text-[var(--site-accent)]">{eyebrow}</p>
      ) : null}
      <h1 className="mt-2 text-3xl font-black leading-tight text-[var(--site-text)] md:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--site-muted)] md:text-base">{description}</p>
    </div>
  );
}

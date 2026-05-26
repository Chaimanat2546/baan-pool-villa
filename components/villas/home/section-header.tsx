type SectionHeaderProps = {
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
        <p className="text-xs font-black uppercase text-[#0f5a66]">{eyebrow}</p>
      ) : null}
      <h2 className="mt-2 text-3xl font-black leading-tight text-[#063f35] md:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#55746b] md:text-base">{description}</p>
    </div>
  );
}

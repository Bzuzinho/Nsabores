interface SectionHeadingProps {
  eyebrow: string;
  id?: string;
  title: string;
  align?: 'center' | 'left';
}

export function SectionHeading({
  align = 'center',
  eyebrow,
  id,
  title,
}: SectionHeadingProps) {
  return (
    <div className={`section-heading section-heading-${align}`}>
      <p>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
    </div>
  );
}

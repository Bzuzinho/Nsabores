import Image from 'next/image';
import Link from 'next/link';

interface ExperienceCardProps {
  alt: string;
  description: string;
  image: string;
  title: string;
}

export function ExperienceCard({
  alt,
  description,
  image,
  title,
}: ExperienceCardProps) {
  return (
    <article className="experience-card">
      <Image src={image} alt={alt} width={720} height={480} />
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
        <Link className="text-link" href="/loja">
          Ver sugestões <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

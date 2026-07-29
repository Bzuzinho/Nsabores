import Image from 'next/image';
import Link from 'next/link';
import { FacebookIcon, InstagramIcon } from './icons';

const footerGroups = [
  {
    title: 'Loja',
    links: [
      ['Produtos', '/loja'],
      ['Experiências', '/servicos'],
      ['Clube Nsabores', '/clube'],
    ],
  },
  {
    title: 'Serviços',
    links: [
      ['Eventos', '/eventos'],
      ['Empresas', '/servicos'],
      ['Receitas', '/receitas'],
    ],
  },
  {
    title: 'Ajuda',
    links: [
      ['Contactos', '/contactos'],
      ['Entregas e devoluções', '/contactos'],
      ['Termos e condições', '/contactos'],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link
            className="footer-logo-link"
            href="/"
            aria-label="Nsabores, início"
          >
            <Image
              className="footer-logo"
              src="/images/logo-nsabores-white.png"
              alt=""
              width={1789}
              height={512}
            />
          </Link>
          <p>
            Mais do que produtos, criamos experiências que unem pessoas e
            celebram o que é nosso.
          </p>
          <div className="social-links" aria-label="Redes sociais">
            <span aria-label="Instagram — ligação por definir">
              <InstagramIcon />
            </span>
            <span aria-label="Facebook — ligação por definir">
              <FacebookIcon />
            </span>
          </div>
        </div>
        {footerGroups.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <strong>{group.title}</strong>
            {group.links.map(([label, href]) => (
              <Link href={href} key={label}>
                {label}
              </Link>
            ))}
          </nav>
        ))}
        <div className="footer-contact">
          <strong>Contactos</strong>
          <p>Email: a confirmar</p>
          <p>Morada: a confirmar</p>
          <Link href="/contactos">Falar connosco</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 Nsabores. Todos os direitos reservados.</p>
        <div className="payment-placeholders" aria-label="Meios de pagamento">
          <span>MB WAY</span>
          <span>MB</span>
          <span>VISA</span>
        </div>
        <div>
          <Link href="/contactos">Privacidade</Link>
          <Link href="/contactos">Cookies</Link>
        </div>
      </div>
    </footer>
  );
}

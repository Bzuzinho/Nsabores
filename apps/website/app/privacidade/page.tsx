const privacySections = [
  {
    title: '1. Dados que podemos tratar',
    body: 'Consoante o serviço utilizado, podemos tratar nome, email, telefone, NIF quando facultado, moradas, dados de conta, histórico de pedidos e encomendas, preferências de entrega e pagamento, pedidos de apoio, devoluções, comunicações e consentimentos de marketing.',
  },
  {
    title: '2. Finalidades e fundamentos',
    body: 'Os dados necessários a pedidos, encomendas, pagamentos, entregas, faturação, apoio ao cliente, prevenção de fraude e cumprimento de obrigações legais são tratados para executar o contrato, adotar diligências pré-contratuais, cumprir obrigações legais ou prosseguir interesses legítimos compatíveis com a relação com o cliente. O envio de newsletter e outras comunicações promocionais depende de consentimento e pode ser cancelado a qualquer momento.',
  },
  {
    title: '3. Partilha de dados',
    body: 'Os dados podem ser comunicados apenas na medida necessária a prestadores que suportem a operação, como alojamento, email, pagamentos, faturação, transporte ou suporte técnico, bem como a autoridades quando exista obrigação legal. Esses prestadores atuam sujeitos às obrigações aplicáveis de confidencialidade e proteção de dados.',
  },
  {
    title: '4. Conservação',
    body: 'Os dados são conservados durante o período necessário às finalidades para que foram recolhidos e pelos prazos exigidos por obrigações contabilísticas, fiscais, contratuais ou de defesa de direitos. Consentimentos de marketing são mantidos enquanto estiverem ativos ou enquanto seja necessário demonstrar a respetiva gestão.',
  },
  {
    title: '5. Direitos do titular',
    body: 'Nos termos legalmente aplicáveis, pode solicitar acesso, retificação, apagamento, limitação, oposição ou portabilidade dos seus dados e retirar consentimentos. Pode fazê-lo através dos contactos oficiais da Nsabores ou do formulário de contacto do website. Pode igualmente apresentar reclamação junto da Comissão Nacional de Proteção de Dados (CNPD).',
  },
  {
    title: '6. Conta e segurança',
    body: 'A área de cliente permite atualizar dados, gerir moradas, alterar a password e terminar sessões ativas. O utilizador deve manter as suas credenciais confidenciais.',
  },
  {
    title: '7. Newsletter',
    body: 'A subscrição é voluntária e exige consentimento explícito. O cancelamento pode ser feito diretamente no formulário de newsletter do website, indicando o mesmo endereço de email.',
  },
  {
    title: '8. Atualizações',
    body: 'Esta política pode ser atualizada para refletir alterações legais, técnicas ou operacionais. A versão publicada no website é a versão em vigor.',
  },
] as const;

export default function PrivacyPage() {
  return (
    <main id="conteudo" className="account-page">
      <article className="account-card">
        <p className="eyebrow">Privacidade</p>
        <h1>Política de privacidade</h1>
        <p>
          {
            'Esta política explica como a Nsabores trata dados pessoais através do website, da loja online, da área de cliente e dos pedidos dirigidos à equipa. A identificação legal completa do operador é a indicada nos Termos e Condições em vigor.'
          }
        </p>
        {privacySections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </article>
    </main>
  );
}

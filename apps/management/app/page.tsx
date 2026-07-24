import { serviceLabels } from '@nsabores/config';
import { ServiceShell } from '@nsabores/ui';

export default function Home() {
  return (
    <ServiceShell eyebrow="Operações internas" title={serviceLabels.management}>
      <p>
        A fundação da aplicação de gestão está operacional e pronta para receber
        os primeiros módulos de negócio.
      </p>
    </ServiceShell>
  );
}

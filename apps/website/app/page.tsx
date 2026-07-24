import { serviceLabels } from '@nsabores/config';
import { ServiceShell } from '@nsabores/ui';

export default function Home() {
  return (
    <ServiceShell eyebrow="Sabores com história" title={serviceLabels.website}>
      <p>
        A nova casa digital da Nsabores está a ganhar forma. Produtos,
        experiências e tradição portuguesa, reunidos com cuidado.
      </p>
    </ServiceShell>
  );
}

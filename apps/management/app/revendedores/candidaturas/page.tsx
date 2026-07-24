import { OperationsModule } from '../../../components/operations-module';
export default function Page() {
  return (
    <OperationsModule
      title="Candidaturas B2B"
      endpoint="reseller-applications"
      description="Pedidos pendentes, aprovados e rejeitados."
    />
  );
}

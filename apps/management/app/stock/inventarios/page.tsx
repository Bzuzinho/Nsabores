import { OperationsModule } from '../../../components/operations-module';
export default function Page() {
  return (
    <OperationsModule
      title="Inventários"
      endpoint="inventories"
      description="Contagens e correções auditáveis."
    />
  );
}

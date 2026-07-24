import { OperationsModule } from '../../../components/operations-module';
export default function Page() {
  return (
    <OperationsModule
      title="Movimentos de stock"
      endpoint="stock/movements"
      description="Histórico auditável e imutável."
    />
  );
}

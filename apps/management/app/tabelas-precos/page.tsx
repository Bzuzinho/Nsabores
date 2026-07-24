import { OperationsModule } from '../../components/operations-module';
export default function Page() {
  return (
    <OperationsModule
      title="Tabelas de preços"
      endpoint="price-lists"
      description="Preços retail, revendedor e personalizados."
    />
  );
}

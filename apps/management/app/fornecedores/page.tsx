import { OperationsModule } from '../../components/operations-module';
export default function Page() {
  return (
    <OperationsModule
      title="Fornecedores"
      endpoint="suppliers"
      description="Parceiros, custos e condições de compra."
      detailBasePath="/fornecedores"
    />
  );
}

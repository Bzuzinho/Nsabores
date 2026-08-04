import { OperationsModule } from '../../components/operations-module';
export default function Page() {
  return (
    <OperationsModule
      title="Compras"
      endpoint="purchases"
      description="Ordens, receções parciais e custos históricos."
      createHref="/compras/nova"
      createLabel="Nova compra"
      detailBasePath="/compras"
    />
  );
}

import { OperationsModule } from '../../../components/operations-module';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <OperationsModule
      title="Fornecedor"
      endpoint={`suppliers/${id}`}
      description="Produtos e histórico de compras."
    />
  );
}

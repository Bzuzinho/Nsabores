import { OperationsModule } from '../../../components/operations-module';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <OperationsModule
      title="Conta revendedor"
      endpoint={`business-accounts/${id}`}
      description="Preço, utilizadores, condições e encomendas."
    />
  );
}

import { OperationsModule } from '../../../components/operations-module';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <OperationsModule
      title="Tabela de preços"
      endpoint="price-lists"
      description={`Tabela selecionada: ${id}`}
    />
  );
}

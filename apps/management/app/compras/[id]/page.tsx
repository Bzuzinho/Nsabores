import { OperationsModule } from '../../../components/operations-module';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <OperationsModule
      title="Ordem de compra"
      endpoint={`purchases/${id}`}
      description="Linhas, pendentes e receções."
    />
  );
}

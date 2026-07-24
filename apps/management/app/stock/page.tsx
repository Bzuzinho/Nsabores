import { OperationsModule } from '../../components/operations-module';
export default function Page() {
  return (
    <OperationsModule
      title="Stock"
      endpoint="stock"
      description="Disponível, reservado e pontos de reposição."
    />
  );
}

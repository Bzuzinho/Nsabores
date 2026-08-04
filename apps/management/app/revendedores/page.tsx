import { OperationsModule } from '../../components/operations-module';
export default function Page() {
  return (
    <OperationsModule
      title="Revendedores"
      endpoint="business-accounts"
      description="Contas B2B, estados e condições comerciais."
      detailBasePath="/revendedores"
    />
  );
}

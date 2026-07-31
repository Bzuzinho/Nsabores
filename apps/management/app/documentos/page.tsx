import { FiscalDocumentsAdmin } from '../../components/fiscal-documents-admin';
import { FiscalExportActions } from '../../components/fiscal-export-actions';

export default function FiscalDocumentsPage() {
  return (
    <>
      <FiscalExportActions />
      <FiscalDocumentsAdmin />
    </>
  );
}

import { SubPageLayout } from "@/pages/layouts/SubPageLayout";
import { RegisterFormPart } from "@/pages/parts/auth/RegisterFormPart";
import { PageTitle } from "@/pages/parts/util/PageTitle";

export function RegisterPage() {
  return (
    <SubPageLayout>
      <PageTitle subpage k="global.pages.register" />
      <RegisterFormPart />
    </SubPageLayout>
  );
}

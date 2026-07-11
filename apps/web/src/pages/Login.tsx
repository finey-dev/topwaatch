import { SubPageLayout } from "@/pages/layouts/SubPageLayout";
import { LoginFormPart } from "@/pages/parts/auth/LoginFormPart";
import { PageTitle } from "@/pages/parts/util/PageTitle";

export function LoginPage() {
  return (
    <SubPageLayout>
      <PageTitle subpage k="global.pages.login" />
      <LoginFormPart />
    </SubPageLayout>
  );
}

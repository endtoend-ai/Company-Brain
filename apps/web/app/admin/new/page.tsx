import { Soon } from "../../../components/site/soon";
import { cookies } from "next/headers";
import { getDictionary } from "../../../lib/i18n";
import { LOCALE_COOKIE, normalizeLocale } from "../../../lib/i18n/types";

export default async function AdminNew() {
  const store = await cookies();
  const dictionary = getDictionary(normalizeLocale(store.get(LOCALE_COOKIE)?.value));
  return <Soon kind={dictionary.admin.soon.newKind} title={dictionary.admin.soon.newTitle} />;
}

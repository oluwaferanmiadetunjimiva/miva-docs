import { redirect } from "next/navigation";
import services from "./api/services/services.json";

export default function Page() {
  const firstSlug = Array.isArray(services) ? services[0]?.slug : undefined;
  if (!firstSlug) redirect("/_not-found");
  redirect(`/api/select-service?slug=${encodeURIComponent(firstSlug)}`);
}

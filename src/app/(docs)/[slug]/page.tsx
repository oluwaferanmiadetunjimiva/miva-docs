import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (process.env.NODE_ENV === "development") {
    console.info("[miva-docs][docs]/[slug] server redirect → select-service", { slug });
  }
  redirect(`/api/select-service?slug=${encodeURIComponent(slug)}`);
}


import { notFound } from "next/navigation";
import { ProjectScreen } from "@/components/project/ProjectScreen";
import { UuidSchema } from "@/lib/validation/requests";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UuidSchema.safeParse(id).success) notFound();
  return <ProjectScreen id={id} />;
}

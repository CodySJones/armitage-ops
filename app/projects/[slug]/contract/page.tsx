import { notFound, redirect } from "next/navigation";
import { getOpsProject } from "@/lib/ops-store";

type ContractPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProjectContractPage({ params }: ContractPageProps) {
  const { slug } = await params;
  const project = await getOpsProject(slug);

  if (!project) {
    notFound();
  }

  redirect(`/projects/${project.id}/board`);
}

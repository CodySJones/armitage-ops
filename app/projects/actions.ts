"use server";

import {
  archiveProject,
  createProjectFromForm,
  createProjectWithContractFromForm,
  saveContractForProject,
  saveControlDataForProject,
  saveScheduleForProject,
  unarchiveProject,
} from "@/lib/project-store";

export async function createProjectAction(formData: FormData) {
  await createProjectFromForm(formData);
}

export async function createProjectWithContractAction(formData: FormData) {
  await createProjectWithContractFromForm(formData);
}

export async function saveScheduleAction(slug: string, formData: FormData) {
  await saveScheduleForProject(slug, formData);
}

export async function saveContractAction(slug: string, formData: FormData) {
  await saveContractForProject(slug, formData);
}

export async function archiveProjectAction(slug: string) {
  await archiveProject(slug);
}

export async function unarchiveProjectAction(slug: string) {
  await unarchiveProject(slug);
}

export async function saveControlDataAction(slug: string, formData: FormData) {
  await saveControlDataForProject(slug, formData);
}

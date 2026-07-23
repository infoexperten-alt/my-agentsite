import { join } from 'path';

const DEFAULT_STATE_DIR = '/root/we0';

export function getStateRoot() {
  const configured = process.env.WEDEV_STATE_DIR?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_STATE_DIR;
}

export function statePath(...segments: string[]) {
  return join(getStateRoot(), ...segments);
}

export const PROJECTS_DIR = () =>
  process.env.WEDEV_PROJECTS_DIR?.trim() || statePath('projects');
export const STAGING_DIR = () =>
  process.env.WEDEV_STAGING_DIR?.trim() || statePath('project-staging');
export const REVISIONS_DIR = () =>
  process.env.WEDEV_REVISIONS_DIR?.trim() || statePath('project-revisions');
export const QUALITY_DIR = () =>
  process.env.WEDEV_QUALITY_DIR?.trim() || statePath('quality-reports');
export const QUALITY_JOBS_DIR = () =>
  process.env.WEDEV_QUALITY_JOBS_DIR?.trim() || statePath('quality-jobs');
export const RELEASES_DIR = () =>
  process.env.WEDEV_RELEASES_DIR?.trim() || statePath('releases');
export const WORKFLOW_JOBS_DIR = () =>
  process.env.WEDEV_WORKFLOW_JOBS_DIR?.trim() || statePath('workflow-jobs');

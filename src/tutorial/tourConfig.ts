import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export type TourId =
  | 'orientation'
  | 'dashboard'
  | 'newPrForm'
  | 'poCapRule'
  | 'fullApprovalFlow'
  | 'roleRequestor'
  | 'roleApprover'
  | 'roleProcurement'
  | 'roleFinanceAdmin'
  | 'roleFinanceApprover'
  | 'roleSuperadmin';

export interface TourMeta {
  id: TourId;
  titleKey: string;
  descriptionKey: string;
  /** Navigate here before starting (if not already there) */
  path?: string;
  /** Badge label shown on steps — typically the role name */
  badge?: string;
}

export const TOUR_LIST: TourMeta[] = [
  {
    id: 'orientation',
    titleKey: 'tutorial.tours.orientation.title',
    descriptionKey: 'tutorial.tours.orientation.description',
  },
  {
    id: 'dashboard',
    titleKey: 'tutorial.tours.dashboard.title',
    descriptionKey: 'tutorial.tours.dashboard.description',
    path: '/dashboard',
  },
  {
    id: 'newPrForm',
    titleKey: 'tutorial.tours.newPrForm.title',
    descriptionKey: 'tutorial.tours.newPrForm.description',
    path: '/pr/new',
  },
  {
    id: 'poCapRule',
    titleKey: 'tutorial.tours.poCapRule.title',
    descriptionKey: 'tutorial.tours.poCapRule.description',
  },
  {
    id: 'fullApprovalFlow',
    titleKey: 'tutorial.tours.fullApprovalFlow.title',
    descriptionKey: 'tutorial.tours.fullApprovalFlow.description',
    path: '/dashboard',
  },
  {
    id: 'roleRequestor',
    titleKey: 'tutorial.tours.roleRequestor.title',
    descriptionKey: 'tutorial.tours.roleRequestor.description',
    path: '/dashboard',
    badge: 'Requestor (L5)',
  },
  {
    id: 'roleApprover',
    titleKey: 'tutorial.tours.roleApprover.title',
    descriptionKey: 'tutorial.tours.roleApprover.description',
    path: '/dashboard',
    badge: 'Approver (L2)',
  },
  {
    id: 'roleProcurement',
    titleKey: 'tutorial.tours.roleProcurement.title',
    descriptionKey: 'tutorial.tours.roleProcurement.description',
    path: '/dashboard',
    badge: 'Procurement (L3)',
  },
  {
    id: 'roleFinanceAdmin',
    titleKey: 'tutorial.tours.roleFinanceAdmin.title',
    descriptionKey: 'tutorial.tours.roleFinanceAdmin.description',
    path: '/dashboard',
    badge: 'Finance Admin (L4)',
  },
  {
    id: 'roleFinanceApprover',
    titleKey: 'tutorial.tours.roleFinanceApprover.title',
    descriptionKey: 'tutorial.tours.roleFinanceApprover.description',
    path: '/dashboard',
    badge: 'Finance Approver (L6)',
  },
  {
    id: 'roleSuperadmin',
    titleKey: 'tutorial.tours.roleSuperadmin.title',
    descriptionKey: 'tutorial.tours.roleSuperadmin.description',
    path: '/dashboard',
    badge: 'Superadmin (L1)',
  },
];

function step(
  target: string,
  titleKey: string,
  contentKey: string,
  t: TFunction,
  placement: Step['placement'] = 'bottom'
): Step {
  return {
    target,
    title: t(titleKey),
    content: t(contentKey),
    placement,
    disableBeacon: true,
  };
}

function center(titleKey: string, contentKey: string, t: TFunction): Step {
  return {
    target: 'body',
    title: t(titleKey),
    content: t(contentKey),
    placement: 'center',
    disableBeacon: true,
  };
}

function spot(target: string, titleKey: string, contentKey: string, t: TFunction, placement: Step['placement'] = 'bottom'): Step {
  return step(`[data-tutorial="${target}"]`, titleKey, contentKey, t, placement);
}

export type TourStepDestination = 'dashboard' | 'newPrForm' | 'sandboxPr';

const ROLE_WORKFLOW_TOURS: TourId[] = [
  'roleRequestor',
  'roleApprover',
  'roleProcurement',
  'roleFinanceAdmin',
  'roleFinanceApprover',
  'roleSuperadmin',
];

export function tourUsesSandboxPR(tourId: TourId): boolean {
  return ROLE_WORKFLOW_TOURS.includes(tourId);
}

/** Which page a role-workflow tour step should navigate to. */
export function getTourStepDestination(tourId: TourId, stepIndex: number): TourStepDestination {
  switch (tourId) {
    case 'roleRequestor':
      if (stepIndex === 2) return 'newPrForm';
      if (stepIndex >= 5) return 'sandboxPr';
      return 'dashboard';
    case 'roleApprover':
      return stepIndex >= 3 ? 'sandboxPr' : 'dashboard';
    case 'roleProcurement':
      return stepIndex >= 2 ? 'sandboxPr' : 'dashboard';
    case 'roleFinanceAdmin':
      return stepIndex >= 2 ? 'sandboxPr' : 'dashboard';
    case 'roleFinanceApprover':
      return stepIndex >= 3 ? 'sandboxPr' : 'dashboard';
    case 'roleSuperadmin':
      return stepIndex === 5 ? 'sandboxPr' : 'dashboard';
    default:
      return 'dashboard';
  }
}

export function resolveTourStepPath(
  tourId: TourId,
  stepIndex: number,
  sandboxPrId: string | null
): string {
  const destination = getTourStepDestination(tourId, stepIndex);
  if (destination === 'newPrForm') return '/pr/new';
  if (destination === 'sandboxPr' && sandboxPrId) return `/pr/${sandboxPrId}`;
  const meta = TOUR_LIST.find((m) => m.id === tourId);
  return meta?.path ?? '/dashboard';
}

/** Build Joyride steps for a tour id. Targets use [data-tutorial] selectors. */
export function buildTourSteps(tourId: TourId, t: TFunction): Step[] {
  const S = (key: string) => `tutorial.${tourId}.${key}`;

  switch (tourId) {
    // ── Legacy / generic tours ──────────────────────────────

    case 'orientation':
      return [
        step('[data-tutorial="layout-appbar"]', 'tutorial.orientation.step1.title', 'tutorial.orientation.step1.content', t, 'bottom'),
        center('tutorial.orientation.step2.title', 'tutorial.orientation.step2.content', t),
        step('[data-tutorial="layout-main"]', 'tutorial.orientation.step3.title', 'tutorial.orientation.step3.content', t, 'top'),
        step('[data-tutorial="layout-help"]', 'tutorial.orientation.step4.title', 'tutorial.orientation.step4.content', t, 'right'),
      ];

    case 'dashboard':
      return [
        step('[data-tutorial="dashboard-toolbar"]', 'tutorial.dashboard.step1.title', 'tutorial.dashboard.step1.content', t, 'bottom'),
        step('[data-tutorial="dashboard-org"]', 'tutorial.dashboard.step2.title', 'tutorial.dashboard.step2.content', t, 'bottom'),
        step('[data-tutorial="dashboard-actions"]', 'tutorial.dashboard.step3.title', 'tutorial.dashboard.step3.content', t, 'bottom'),
        step('[data-tutorial="dashboard-metrics"]', 'tutorial.dashboard.step4.title', 'tutorial.dashboard.step4.content', t, 'bottom'),
        step('[data-tutorial="dashboard-status-row"]', 'tutorial.dashboard.step5.title', 'tutorial.dashboard.step5.content', t, 'bottom'),
        step('[data-tutorial="dashboard-table"]', 'tutorial.dashboard.step6.title', 'tutorial.dashboard.step6.content', t, 'top'),
      ];

    case 'newPrForm':
      return [
        step('[data-tutorial="newpr-stepper"]', 'tutorial.newPrForm.step1.title', 'tutorial.newPrForm.step1.content', t, 'bottom'),
        step('[data-tutorial="newpr-nav"]', 'tutorial.newPrForm.step2.title', 'tutorial.newPrForm.step2.content', t, 'top'),
      ];

    case 'poCapRule':
      return [
        center('tutorial.poCapRule.step1.title', 'tutorial.poCapRule.step1.content', t),
        center('tutorial.poCapRule.step2.title', 'tutorial.poCapRule.step2.content', t),
        center('tutorial.poCapRule.step3.title', 'tutorial.poCapRule.step3.content', t),
        center('tutorial.poCapRule.step4.title', 'tutorial.poCapRule.step4.content', t),
      ];

    case 'fullApprovalFlow':
      return [
        spot('dashboard-status-row', S('step1.title'), S('step1.content'), t),
        spot('dashboard-table', S('step2.title'), S('step2.content'), t, 'top'),
        center(S('step3.title'), S('step3.content'), t),
        center(S('step4.title'), S('step4.content'), t),
        center(S('step5.title'), S('step5.content'), t),
        center(S('step6.title'), S('step6.content'), t),
        center(S('step7.title'), S('step7.content'), t),
      ];

    // ── Role-specific tours ──────────────────────────────────

    case 'roleRequestor':
      return [
        spot('dashboard-org', S('step1.title'), S('step1.content'), t),
        spot('dashboard-new-pr', S('step2.title'), S('step2.content'), t),
        spot('newpr-stepper', S('step3.title'), S('step3.content'), t),
        spot('dashboard-table', S('step4.title'), S('step4.content'), t, 'top'),
        center(S('step5.title'), S('step5.content'), t),
        spot('pr-status-stepper', S('step6.title'), S('step6.content'), t),
        center(S('step7.title'), S('step7.content'), t),
      ];

    case 'roleApprover':
      return [
        spot('dashboard-my-actions', S('step1.title'), S('step1.content'), t),
        spot('dashboard-status-row', S('step2.title'), S('step2.content'), t),
        spot('dashboard-table', S('step3.title'), S('step3.content'), t, 'top'),
        spot('pr-details-info', S('step4.title'), S('step4.content'), t),
        spot('pr-quotes-section', S('step5.title'), S('step5.content'), t),
        spot('pr-approver-actions', S('step6.title'), S('step6.content'), t),
        center(S('step7.title'), S('step7.content'), t),
      ];

    case 'roleProcurement':
      return [
        spot('dashboard-org', S('step1.title'), S('step1.content'), t),
        spot('dashboard-status-row', S('step2.title'), S('step2.content'), t),
        spot('pr-quotes-section', S('step3.title'), S('step3.content'), t),
        spot('pr-procurement-actions', S('step4.title'), S('step4.content'), t),
        center(S('step5.title'), S('step5.content'), t),
        spot('pr-approved-actions', S('step6.title'), S('step6.content'), t),
        spot('pr-ordered-actions', S('step7.title'), S('step7.content'), t),
        center(S('step8.title'), S('step8.content'), t),
      ];

    case 'roleFinanceAdmin':
      return [
        spot('dashboard-metrics', S('step1.title'), S('step1.content'), t),
        spot('dashboard-status-row', S('step2.title'), S('step2.content'), t),
        spot('pr-details-info', S('step3.title'), S('step3.content'), t),
        spot('pr-approved-actions', S('step4.title'), S('step4.content'), t),
        center(S('step5.title'), S('step5.content'), t),
      ];

    case 'roleFinanceApprover':
      return [
        spot('dashboard-my-actions', S('step1.title'), S('step1.content'), t),
        spot('dashboard-status-row', S('step2.title'), S('step2.content'), t),
        spot('dashboard-table', S('step3.title'), S('step3.content'), t, 'top'),
        spot('pr-approver-actions', S('step4.title'), S('step4.content'), t),
        center(S('step5.title'), S('step5.content'), t),
      ];

    case 'roleSuperadmin':
      return [
        spot('dashboard-metrics', S('step1.title'), S('step1.content'), t),
        spot('layout-admin', S('step2.title'), S('step2.content'), t, 'right'),
        center(S('step3.title'), S('step3.content'), t),
        center(S('step4.title'), S('step4.content'), t),
        center(S('step5.title'), S('step5.content'), t),
        spot('pr-procurement-actions', S('step6.title'), S('step6.content'), t),
        center(S('step7.title'), S('step7.content'), t),
      ];

    default:
      return [];
  }
}

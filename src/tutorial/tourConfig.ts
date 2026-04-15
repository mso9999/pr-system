import type { Step } from 'react-joyride';
import type { TFunction } from 'i18next';

export type TourId =
  | 'orientation'
  | 'dashboard'
  | 'workflowRequestor'
  | 'workflowApprover'
  | 'workflowProcurement'
  | 'newPrForm';

export interface TourMeta {
  id: TourId;
  titleKey: string;
  descriptionKey: string;
  /** Navigate here before starting (if not already there) */
  path?: string;
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
    id: 'workflowRequestor',
    titleKey: 'tutorial.tours.workflowRequestor.title',
    descriptionKey: 'tutorial.tours.workflowRequestor.description',
    path: '/dashboard',
  },
  {
    id: 'workflowApprover',
    titleKey: 'tutorial.tours.workflowApprover.title',
    descriptionKey: 'tutorial.tours.workflowApprover.description',
    path: '/dashboard',
  },
  {
    id: 'workflowProcurement',
    titleKey: 'tutorial.tours.workflowProcurement.title',
    descriptionKey: 'tutorial.tours.workflowProcurement.description',
    path: '/dashboard',
  },
  {
    id: 'newPrForm',
    titleKey: 'tutorial.tours.newPrForm.title',
    descriptionKey: 'tutorial.tours.newPrForm.description',
    path: '/pr/new',
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

/** Build Joyride steps for a tour id. Targets use [data-tutorial] selectors. */
export function buildTourSteps(tourId: TourId, t: TFunction): Step[] {
  switch (tourId) {
    case 'orientation':
      return [
        step('[data-tutorial="layout-appbar"]', 'tutorial.orientation.step1.title', 'tutorial.orientation.step1.content', t, 'bottom'),
        {
          target: 'body',
          title: t('tutorial.orientation.step2.title'),
          content: t('tutorial.orientation.step2.content'),
          placement: 'center',
          disableBeacon: true,
        },
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

    case 'workflowRequestor':
      return [
        step('[data-tutorial="dashboard-org"]', 'tutorial.wfRequestor.step1.title', 'tutorial.wfRequestor.step1.content', t, 'bottom'),
        step('[data-tutorial="dashboard-new-pr"]', 'tutorial.wfRequestor.step2.title', 'tutorial.wfRequestor.step2.content', t, 'bottom'),
        step('[data-tutorial="dashboard-metrics"]', 'tutorial.wfRequestor.step3.title', 'tutorial.wfRequestor.step3.content', t, 'bottom'),
        step('[data-tutorial="dashboard-table"]', 'tutorial.wfRequestor.step4.title', 'tutorial.wfRequestor.step4.content', t, 'top'),
      ];

    case 'workflowApprover':
      return [
        step('[data-tutorial="dashboard-my-actions"]', 'tutorial.wfApprover.step1.title', 'tutorial.wfApprover.step1.content', t, 'bottom'),
        step('[data-tutorial="dashboard-status-row"]', 'tutorial.wfApprover.step2.title', 'tutorial.wfApprover.step2.content', t, 'bottom'),
        step('[data-tutorial="dashboard-table"]', 'tutorial.wfApprover.step3.title', 'tutorial.wfApprover.step3.content', t, 'top'),
      ];

    case 'workflowProcurement':
      return [
        step('[data-tutorial="dashboard-org"]', 'tutorial.wfProcurement.step1.title', 'tutorial.wfProcurement.step1.content', t, 'bottom'),
        step('[data-tutorial="layout-pr-list"]', 'tutorial.wfProcurement.step2.title', 'tutorial.wfProcurement.step2.content', t, 'right'),
        step('[data-tutorial="dashboard-status-row"]', 'tutorial.wfProcurement.step3.title', 'tutorial.wfProcurement.step3.content', t, 'bottom'),
        step('[data-tutorial="dashboard-table"]', 'tutorial.wfProcurement.step4.title', 'tutorial.wfProcurement.step4.content', t, 'top'),
      ];

    case 'newPrForm':
      return [
        step('[data-tutorial="newpr-stepper"]', 'tutorial.newPrForm.step1.title', 'tutorial.newPrForm.step1.content', t, 'bottom'),
        step('[data-tutorial="newpr-nav"]', 'tutorial.newPrForm.step2.title', 'tutorial.newPrForm.step2.content', t, 'top'),
      ];

    default:
      return [];
  }
}

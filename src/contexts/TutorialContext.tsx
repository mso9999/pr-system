import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import {
  Joyride,
  EVENTS,
  STATUS,
  ACTIONS,
  type Step,
  type CallBackProps,
} from 'react-joyride';
import {
  buildTourSteps,
  resolveTourStepPath,
  tourUsesSandboxPR,
  type TourId,
  TOUR_LIST,
} from '@/tutorial/tourConfig';
import {
  cleanupTutorialSandboxPRs,
  seedTutorialSandboxPR,
  type TutorialSandboxSeedResult,
} from '@/services/tutorialSandbox';
import { RootState } from '@/store';

const NAV_DELAY_MS = 500;

type TutorialContextValue = {
  /** Start a guided tour by id (navigates first if the tour defines a path). */
  startTour: (id: TourId) => void;
  /** Stop the current tour immediately. */
  stopTour: () => void;
  /** True while a tour is running. */
  isRunning: boolean;
  activeTourId: TourId | null;
  /** Open the tour picker dialog (lifted to Layout). */
  openPicker: () => void;
  setPickerOpen: (open: boolean) => void;
  pickerOpen: boolean;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return ctx;
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state: RootState) => state.auth.user);
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const sandboxRef = useRef<TutorialSandboxSeedResult | null>(null);
  const navTimerRef = useRef<number | null>(null);

  const steps: Step[] = useMemo(() => {
    if (!activeTourId) return [];
    return buildTourSteps(activeTourId, t);
  }, [activeTourId, t]);

  const clearNavTimer = useCallback(() => {
    if (navTimerRef.current !== null) {
      window.clearTimeout(navTimerRef.current);
      navTimerRef.current = null;
    }
  }, []);

  const runCleanup = useCallback(async () => {
    if (user?.id) {
      try {
        await cleanupTutorialSandboxPRs(user.id);
      } catch (error) {
        console.error('[tutorial] sandbox cleanup failed', error);
      }
    }
    sandboxRef.current = null;
  }, [user?.id]);

  const stopTour = useCallback(async () => {
    clearNavTimer();
    setRun(false);
    setActiveTourId(null);
    setStepIndex(0);
    await runCleanup();
  }, [clearNavTimer, runCleanup]);

  const goToStep = useCallback(
    (tourId: TourId, index: number) => {
      const path = resolveTourStepPath(tourId, index, sandboxRef.current?.primaryPrId ?? null);
      const resume = () => {
        setStepIndex(index);
        setRun(true);
      };

      if (location.pathname !== path) {
        setRun(false);
        navigate(path);
        clearNavTimer();
        navTimerRef.current = window.setTimeout(resume, NAV_DELAY_MS);
      } else {
        resume();
      }
    },
    [clearNavTimer, location.pathname, navigate]
  );

  const startTour = useCallback(
    async (id: TourId) => {
      setPickerOpen(false);
      clearNavTimer();
      setRun(false);
      setStepIndex(0);
      setActiveTourId(null);

      let sandbox: TutorialSandboxSeedResult | null = null;
      if (user && tourUsesSandboxPR(id)) {
        try {
          sandbox = await seedTutorialSandboxPR(user, id);
          sandboxRef.current = sandbox;
        } catch (error) {
          console.error('[tutorial] sandbox seed failed', error);
          sandboxRef.current = null;
        }
      } else {
        sandboxRef.current = null;
      }

      const path = resolveTourStepPath(id, 0, sandbox?.primaryPrId ?? null);
      const launch = () => {
        setActiveTourId(id);
        setRun(true);
      };

      if (location.pathname !== path) {
        navigate(path);
        navTimerRef.current = window.setTimeout(launch, NAV_DELAY_MS);
      } else {
        launch();
      }
    },
    [clearNavTimer, location.pathname, navigate, user]
  );

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { action, index, status, type } = data;

      if (type === EVENTS.TOUR_END || status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        void stopTour();
        return;
      }

      if (!activeTourId || type !== EVENTS.STEP_AFTER) return;

      if (action === ACTIONS.NEXT) {
        const nextIndex = index + 1;
        if (nextIndex >= steps.length) {
          void stopTour();
          return;
        }
        goToStep(activeTourId, nextIndex);
        return;
      }

      if (action === ACTIONS.PREV && index > 0) {
        goToStep(activeTourId, index - 1);
      }
    },
    [activeTourId, goToStep, steps.length, stopTour]
  );

  useEffect(() => {
    return () => {
      clearNavTimer();
      if (user?.id) {
        void cleanupTutorialSandboxPRs(user.id);
      }
    };
  }, [clearNavTimer, user?.id]);

  const value = useMemo(
    () => ({
      startTour,
      stopTour,
      isRunning: run,
      activeTourId,
      openPicker: () => setPickerOpen(true),
      setPickerOpen,
      pickerOpen,
    }),
    [startTour, stopTour, run, activeTourId, pickerOpen]
  );

  const locale = useMemo(
    () => ({
      back: t('tutorial.back'),
      close: t('tutorial.close'),
      last: t('tutorial.last'),
      next: t('tutorial.next'),
      nextWithProgress: t('tutorial.nextWithProgress'),
      skip: t('tutorial.skip'),
    }),
    [t]
  );

  return (
    <TutorialContext.Provider value={value}>
      <Joyride
        run={run && steps.length > 0}
        steps={steps}
        stepIndex={stepIndex}
        continuous
        showProgress
        scrollToFirstStep
        disableOverlayClose
        locale={locale}
        options={{
          buttons: ['skip', 'back', 'close', 'primary'],
        }}
        styles={{
          options: {
            zIndex: 1600,
            primaryColor: '#1976d2',
            textColor: '#333',
            arrowColor: '#fff',
            backgroundColor: '#fff',
            overlayColor: 'rgba(0, 0, 0, 0.45)',
          },
        }}
        callback={handleJoyrideCallback}
      />
      {children}
    </TutorialContext.Provider>
  );
}

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Joyride, EVENTS, STATUS, type EventData, type Step } from 'react-joyride';
import { buildTourSteps, type TourId, TOUR_LIST } from '@/tutorial/tourConfig';

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
  const [run, setRun] = useState(false);
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const steps: Step[] = useMemo(() => {
    if (!activeTourId) return [];
    return buildTourSteps(activeTourId, t);
  }, [activeTourId, t]);

  const stopTour = useCallback(() => {
    setRun(false);
    setActiveTourId(null);
  }, []);

  const startTour = useCallback(
    (id: TourId) => {
      const meta = TOUR_LIST.find((m) => m.id === id);
      const path = meta?.path;
      setPickerOpen(false);

      const launch = () => {
        setActiveTourId(id);
        setRun(true);
      };

      if (path && location.pathname !== path) {
        navigate(path);
        window.setTimeout(launch, 450);
      } else {
        launch();
      }
    },
    [location.pathname, navigate]
  );

  const handleJoyrideEvent = useCallback(
    (data: EventData) => {
      if (data.type === EVENTS.TOUR_END) {
        stopTour();
        return;
      }
      if (data.type === EVENTS.TOUR_STATUS && (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED)) {
        stopTour();
      }
    },
    [stopTour]
  );

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
        onEvent={handleJoyrideEvent}
      />
      {children}
    </TutorialContext.Provider>
  );
}

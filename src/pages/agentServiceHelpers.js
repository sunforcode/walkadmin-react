export const normalizeTaskEvent = (data = {}) => ({
  status: data.status,
  progress: data.progress,
  currentStep: data.current_step ?? data.currentStep,
  routeId: data.route_id ?? data.routeId,
  error: data.error,
  executionEvent: data.execution_event ?? data.executionEvent,
  degraded: data.degraded === true,
});

export const getExecutionEventIdentity = (event) => {
  if (event?.event_id != null) return `id:${event.event_id}`;

  return `fallback:${[
    event?.timestamp ?? '',
    event?.node ?? '',
    event?.phase ?? '',
    event?.message ?? '',
  ].join('\u0000')}`;
};

export const appendExecutionEvent = (events, taskEvent) => {
  const nextEvent = taskEvent?.executionEvent;
  if (!nextEvent) return events;

  const nextIdentity = getExecutionEventIdentity(nextEvent);
  if (events.some((event) => getExecutionEventIdentity(event) === nextIdentity)) return events;

  return [...events, nextEvent];
};

export const closeEventSourceAfterError = (eventSource, onDisconnected) => {
  eventSource.close();
  onDisconnected();
};

export const formatExecutionEventTime = (timestamp, locale, timeZone) => {
  if (!timestamp) return '--:--:--';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--:--:--';

  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone,
  });
};

export const getCompletionPresentation = (taskProgress) => {
  if (taskProgress?.status !== 'completed') return null;

  if (taskProgress.degraded) {
    return {
      alertType: 'warning',
      label: '降级完成',
      message: '分析已完成，但部分步骤已降级',
    };
  }

  return {
    alertType: 'success',
    label: '已完成',
    message: '分析完成',
  };
};

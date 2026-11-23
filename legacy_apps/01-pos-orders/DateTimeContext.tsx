import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  RegionalSettings,
  DEFAULT_REGIONAL_SETTINGS,
  DateFormat,
  TimeFormat,
  AVAILABLE_TIMEZONES,
  formatDate as formatD,
  formatTime as formatT,
  formatDateTime as formatDT,
  formatHourLabel as formatH,
  getTodayDateStr,
  getYesterdayDateStr,
} from './dateTimeUtils';

interface DateTimeContextType {
  settings: RegionalSettings;
  updateSettings: (newSettings: Partial<RegionalSettings>) => void;
  resetSettings: () => void;
  formatDate: (input: Date | string | number | null | undefined, formatOverride?: DateFormat) => string;
  formatTime: (input: Date | string | number | null | undefined, timeFormatOverride?: TimeFormat, includeSeconds?: boolean) => string;
  formatDateTime: (input: Date | string | number | null | undefined, formatOverride?: DateFormat, timeFormatOverride?: TimeFormat, includeSeconds?: boolean) => string;
  formatHourLabel: (hourInput: string | number, short?: boolean) => string;
  getTodayStr: () => string;
  getYesterdayStr: () => string;
}

const DateTimeContext = createContext<DateTimeContextType | undefined>(undefined);

const REGIONAL_SETTINGS_STORAGE_KEY = 'idealpos_regional_settings_v1';

export const DateTimeProvider: React.FC<{
  children: React.ReactNode;
  initialSettings?: Partial<RegionalSettings>;
}> = ({ children, initialSettings }) => {
  const [settings, setSettings] = useState<RegionalSettings>(() => {
    try {
      const saved = localStorage.getItem(REGIONAL_SETTINGS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      return {
        ...DEFAULT_REGIONAL_SETTINGS,
        ...parsed,
        ...(initialSettings || {}),
      };
    } catch (e) {
      console.warn('Failed to parse regional settings:', e);
    }
    return {
      ...DEFAULT_REGIONAL_SETTINGS,
      ...(initialSettings || {}),
    };
  });

  useEffect(() => {
    if (initialSettings && (initialSettings.timeZone || initialSettings.dateFormat || initialSettings.timeFormat)) {
      setSettings((prev) => ({
        ...prev,
        ...initialSettings,
      }));
    }
  }, [initialSettings?.timeZone, initialSettings?.dateFormat, initialSettings?.timeFormat]);

  const updateSettings = (newSettings: Partial<RegionalSettings>) => {
    setSettings((prev) => {
      let tzLabel = prev.timeZoneLabel;
      if (newSettings.timeZone) {
        const found = AVAILABLE_TIMEZONES.find((t) => t.value === newSettings.timeZone);
        if (found) tzLabel = found.label;
      }
      const updated: RegionalSettings = {
        ...prev,
        ...newSettings,
        timeZoneLabel: newSettings.timeZoneLabel || tzLabel,
      };
      try {
        localStorage.setItem(REGIONAL_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save regional settings:', e);
      }
      return updated;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_REGIONAL_SETTINGS);
    try {
      localStorage.setItem(REGIONAL_SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_REGIONAL_SETTINGS));
    } catch (e) {}
  };

  const formatDate = (input: Date | string | number | null | undefined, formatOverride?: DateFormat) => {
    return formatD(input, formatOverride || settings.dateFormat, settings.timeZone);
  };

  const formatTime = (
    input: Date | string | number | null | undefined,
    timeFormatOverride?: TimeFormat,
    includeSeconds: boolean = false
  ) => {
    return formatT(input, timeFormatOverride || settings.timeFormat, settings.timeZone, includeSeconds);
  };

  const formatDateTime = (
    input: Date | string | number | null | undefined,
    formatOverride?: DateFormat,
    timeFormatOverride?: TimeFormat,
    includeSeconds: boolean = false
  ) => {
    return formatDT(
      input,
      formatOverride || settings.dateFormat,
      timeFormatOverride || settings.timeFormat,
      settings.timeZone,
      includeSeconds
    );
  };

  const formatHourLabel = (hourInput: string | number, short: boolean = false) => {
    return formatH(hourInput, settings.timeFormat, short);
  };

  const getTodayStr = () => {
    return getTodayDateStr(settings.timeZone);
  };

  const getYesterdayStr = () => {
    return getYesterdayDateStr(settings.timeZone);
  };

  return (
    <DateTimeContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
        formatDate,
        formatTime,
        formatDateTime,
        formatHourLabel,
        getTodayStr,
        getYesterdayStr,
      }}
    >
      {children}
    </DateTimeContext.Provider>
  );
};

export const useDateTime = (): DateTimeContextType => {
  const context = useContext(DateTimeContext);
  if (!context) {
    // Return fallback bound to default settings so components don't crash if rendered outside provider
    return {
      settings: DEFAULT_REGIONAL_SETTINGS,
      updateSettings: () => {},
      resetSettings: () => {},
      formatDate: (input, formatOverride) => formatD(input, formatOverride || DEFAULT_REGIONAL_SETTINGS.dateFormat, DEFAULT_REGIONAL_SETTINGS.timeZone),
      formatTime: (input, timeFormatOverride, includeSeconds) => formatT(input, timeFormatOverride || DEFAULT_REGIONAL_SETTINGS.timeFormat, DEFAULT_REGIONAL_SETTINGS.timeZone, includeSeconds),
      formatDateTime: (input, formatOverride, timeFormatOverride, includeSeconds) => formatDT(input, formatOverride || DEFAULT_REGIONAL_SETTINGS.dateFormat, timeFormatOverride || DEFAULT_REGIONAL_SETTINGS.timeFormat, DEFAULT_REGIONAL_SETTINGS.timeZone, includeSeconds),
      formatHourLabel: (h, short) => formatH(h, DEFAULT_REGIONAL_SETTINGS.timeFormat, short),
      getTodayStr: () => getTodayDateStr(DEFAULT_REGIONAL_SETTINGS.timeZone),
      getYesterdayStr: () => getYesterdayDateStr(DEFAULT_REGIONAL_SETTINGS.timeZone),
    };
  }
  return context;
};

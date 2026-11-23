import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Trash2,
  CalendarDays,
} from "lucide-react";
import { ModulePermissions, Schedule } from "../types";

interface CalendarViewProps {
  schedules: Schedule[];
  permissions: ModulePermissions;
  onDeleteSchedule: (scheduleId: string) => void;
  onReschedule: (scheduleId: string, newDate: string, newTime: string) => void;
}

export default function CalendarView({
  schedules,
  permissions,
  onDeleteSchedule,
  onReschedule,
}: CalendarViewProps) {
  const [calendarView, setCalendarView] = useState<"Day" | "Week" | "Month">("Month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rescheduleState, setRescheduleState] = useState<{ id: string; date: string; time: string } | null>(null);

  const handlePrevPeriod = () => {
    const next = new Date(currentDate);
    if (calendarView === "Month") next.setMonth(next.getMonth() - 1);
    else if (calendarView === "Week") next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNextPeriod = () => {
    const next = new Date(currentDate);
    if (calendarView === "Month") next.setMonth(next.getMonth() + 1);
    else if (calendarView === "Week") next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const getDaysInMonthArray = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthTotalDays - i);
      days.push({
        dateStr: prevDate.toISOString().split("T")[0],
        dayNum: prevMonthTotalDays - i,
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      const current = new Date(year, month, i);
      days.push({
        dateStr: current.toISOString().split("T")[0],
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        dateStr: nextDate.toISOString().split("T")[0],
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const triggerRescheduleAction = (schedId: string, originalDate: string, originalTime: string) => {
    if (!permissions.canEdit && !permissions.canDelete) return;
    setRescheduleState({
      id: schedId,
      date: originalDate,
      time: originalTime,
    });
  };

  const applyRescheduleAction = () => {
    if (rescheduleState && permissions.canEdit) {
      onReschedule(rescheduleState.id, rescheduleState.date, rescheduleState.time);
      setRescheduleState(null);
    }
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const daysInMonth = getDaysInMonthArray(currentDate);

  const getDaysInWeekArray = (date: Date) => {
    const days: string[] = [];
    const temp = new Date(date);
    const dayOfWeek = temp.getDay();
    temp.setDate(temp.getDate() - dayOfWeek);
    for (let i = 0; i < 7; i++) {
      days.push(temp.toISOString().split("T")[0]);
      temp.setDate(temp.getDate() + 1);
    }
    return days;
  };

  const daysInWeek = getDaysInWeekArray(currentDate);

  return (
    <div id="calendar_module_container" className="space-y-6 animate-fade-in">
      {/* Calendar Header Nav bar */}
      <div
        id="calendar_header"
        className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <span className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
            <CalendarIcon className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-md font-bold text-white font-display tracking-tight">
              {calendarView === "Month" && `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
              {calendarView === "Week" && `Week of ${new Date(daysInWeek[0]).toLocaleDateString()}`}
              {calendarView === "Day" &&
                currentDate.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Automated queue calendar and schedule planner</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <div className="flex bg-slate-950/80 p-1 border border-slate-800 rounded-xl">
            {(["Day", "Week", "Month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setCalendarView(v)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  calendarView === v ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevPeriod}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handleNextPeriod}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid View renderers */}
      <div id="calendar_main_stage">
        {calendarView === "Month" && (
          <div className="bg-slate-900 border border-slate-800 shadow-xl rounded-3xl overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-950 border-b border-slate-800/80 text-center text-xs font-bold text-slate-400 py-3">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-800/80 min-h-[480px]">
              {daysInMonth.map((cell, idx) => {
                const isToday = cell.dateStr === new Date().toISOString().split("T")[0];
                const cellSchedules = schedules.filter((s) => s.date === cell.dateStr);

                return (
                  <div
                    key={idx}
                    className={`p-2 flex flex-col justify-between min-h-[85px] transition-all hover:bg-slate-800/20 ${
                      cell.isCurrentMonth ? "bg-slate-900" : "bg-slate-950/40 opacity-30"
                    }`}
                  >
                    <span
                      className={`text-xs font-bold ${
                        isToday
                          ? "bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center font-extrabold"
                          : "text-slate-300"
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    <div className="mt-1 space-y-1">
                      {cellSchedules.map((s) => (
                        <div
                          key={s.id}
                          id={`calendar_item_cell_${s.id}`}
                          onClick={() => triggerRescheduleAction(s.id, s.date, s.time)}
                          className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 p-1 rounded text-[10px] font-bold cursor-pointer transition-colors truncate flex items-center justify-between"
                          title={`${s.productName} (${s.time})`}
                        >
                          <span>
                            {s.time} • {s.productName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {calendarView === "Week" && (
          <div className="bg-slate-900 border border-slate-800 shadow-xl rounded-3xl overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-950 border-b border-slate-800/80 text-center text-xs font-bold text-slate-400 py-3">
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-slate-800/80 min-h-[250px]">
              {daysInWeek.map((dateStr, idx) => {
                const isToday = dateStr === new Date().toISOString().split("T")[0];
                const cellSchedules = schedules.filter((s) => s.date === dateStr);
                const dayNum = new Date(dateStr).getDate();

                return (
                  <div key={idx} className="p-3 bg-slate-900 space-y-3 min-h-[300px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-black ${
                          isToday
                            ? "text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20"
                            : "text-slate-300"
                        }`}
                      >
                        {dayNum}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {cellSchedules.length === 0 ? (
                        <span className="text-[10px] text-slate-500 italic block">No postings scheduled</span>
                      ) : (
                        cellSchedules.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => triggerRescheduleAction(s.id, s.date, s.time)}
                            className="bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 p-2 rounded-xl text-xs font-bold cursor-pointer transition-all space-y-1"
                          >
                            <div className="flex items-center gap-1 text-[9px] text-indigo-400 font-extrabold uppercase">
                              <Clock className="w-3 h-3" />
                              {s.time}
                            </div>
                            <h4 className="text-[11px] text-slate-200 truncate font-bold leading-tight">{s.productName}</h4>
                            <span className="bg-indigo-500/20 px-1.5 py-0.5 rounded text-[8px] tracking-wide font-black uppercase text-indigo-300 border border-indigo-500/30">
                              {s.platform}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {calendarView === "Day" && (
          <div className="bg-slate-900 border border-slate-800 shadow-xl rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Posts Scheduled for Date</h3>

            {schedules.filter((s) => s.date === currentDate.toISOString().split("T")[0]).length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No promotions scheduled on this date.</div>
            ) : (
              <div className="space-y-3">
                {schedules
                  .filter((s) => s.date === currentDate.toISOString().split("T")[0])
                  .map((s) => (
                    <div
                      key={s.id}
                      className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        {s.productImage && (
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                            {s.productImage.startsWith("data:video/") || s.productImage.match(/\.(mp4|mov|webm)$/i) ? (
                              <video src={s.productImage} className="w-full h-full object-cover" muted playsInline />
                            ) : (
                              <img src={s.productImage} referrerPolicy="no-referrer" alt={s.productName} className="w-full h-full object-cover" />
                            )}
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] font-extrabold text-indigo-300 uppercase bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                            {s.platform}
                          </span>
                          <h4 className="text-sm font-bold text-slate-200 mt-1">{s.productName}</h4>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Posting time: {s.time}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {permissions.canEdit && (
                          <button
                            onClick={() => triggerRescheduleAction(s.id, s.date, s.time)}
                            className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                          >
                            Reschedule
                          </button>
                        )}
                        {permissions.canDelete && (
                          <button
                            onClick={() => onDeleteSchedule(s.id)}
                            className="p-1.5 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-rose-400 rounded-xl cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rescheduling Overlay Form Panel */}
      {rescheduleState && (
        <div id="reschedule_overlay" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 max-w-sm w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-2.5 text-indigo-400 border-b border-slate-800 pb-3">
              <CalendarDays className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Reschedule Social Promotion</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">New Date</label>
                <input
                  type="date"
                  value={rescheduleState.date}
                  disabled={!permissions.canEdit}
                  onChange={(e) => setRescheduleState({ ...rescheduleState, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">New Time</label>
                <input
                  type="time"
                  value={rescheduleState.time}
                  disabled={!permissions.canEdit}
                  onChange={(e) => setRescheduleState({ ...rescheduleState, time: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              {permissions.canDelete ? (
                <button
                  onClick={() => {
                    onDeleteSchedule(rescheduleState.id);
                    setRescheduleState(null);
                  }}
                  className="text-xs text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 rounded-xl font-bold cursor-pointer flex items-center gap-1 border border-rose-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Cancel Post
                </button>
              ) : (
                <span />
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setRescheduleState(null)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close
                </button>
                {permissions.canEdit && (
                  <button
                    onClick={applyRescheduleAction}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Save Reschedule
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Megaphone,
  Settings,
  ShoppingBag,
  Tag,
  Thermometer,
  type LucideIcon,
} from 'lucide-react';
import {
  hasModuleAccess,
  type BusinessConfig,
  type ModuleId,
  type StaffProfile,
} from '../types';

interface DashboardHomeProps {
  currentUser: StaffProfile;
  businessConfig: BusinessConfig;
  onNavigate: (moduleId: ModuleId) => void;
}

interface StatusCardItem {
  moduleId: ModuleId;
  title: string;
  headlineMetric: string;
  breakdown: string;
  detailNote: string;
  statusLabel: string;
  statusTone: 'nominal' | 'warning' | 'neutral';
  icon: LucideIcon;
}

interface RecentShiftEvent {
  id: string;
  time: string;
  area: string;
  summary: string;
  staff: string;
  moduleId: ModuleId;
}

const RECENT_EVENTS: RecentShiftEvent[] = [
  {
    id: 'ev-1',
    time: '14:46',
    area: 'Temperature Logging',
    summary: 'Afternoon walk-in & dairy display fridge check recorded (3.4°C / -18.2°C)',
    staff: 'Sarah Jenkins',
    moduleId: 'temp-logs',
  },
  {
    id: 'ev-2',
    time: '14:15',
    area: 'POS & Order Manager',
    summary: 'Order #KS-1048 marked ready for customer counter pickup ($64.20)',
    staff: 'Sarah Jenkins',
    moduleId: 'pos-orders',
  },
  {
    id: 'ev-3',
    time: '11:30',
    area: 'Smoke Price Tracker',
    summary: '5 tobacco & smoke SKU wholesale price updates flagged for RRP check',
    staff: 'Bhavin Patel',
    moduleId: 'pricematch',
  },
  {
    id: 'ev-4',
    time: '07:45',
    area: 'ATM Cash Manager',
    summary: 'Opening $20 and $50 note cassette verification completed ($4,840 total)',
    staff: 'Bhavin Patel',
    moduleId: 'atm-cash',
  },
];

function getSpanClass(index: number, totalVisible: number): string {
  if (totalVisible === 5) return index < 2 ? 'xl:col-span-3' : 'xl:col-span-2';
  if (totalVisible === 4) return 'xl:col-span-3';
  if (totalVisible === 3) return 'xl:col-span-2';
  if (totalVisible === 2) return 'xl:col-span-3';
  return 'xl:col-span-6';
}

export function DashboardHome({
  currentUser,
  businessConfig,
  onNavigate,
}: DashboardHomeProps) {
  const formattedDate = new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const allCards: StatusCardItem[] = [
    {
      moduleId: 'pos-orders',
      title: 'POS & Pending Orders',
      headlineMetric: '4 Active Orders',
      breakdown: '2 Pickup · 2 Local Delivery',
      detailNote: '$486.50 pending counter total · Register 1 & 2 open',
      statusLabel: 'Active Queue',
      statusTone: 'warning',
      icon: ShoppingBag,
    },
    {
      moduleId: 'temp-logs',
      title: 'Display Fridge & Freezer Temp',
      headlineMetric: '3.4°C / -18.2°C',
      breakdown: `Fridge ${businessConfig.fridgeTempRange.min}°–${businessConfig.fridgeTempRange.max}°C · Freezer ${businessConfig.freezerTempRange.min}°–${businessConfig.freezerTempRange.max}°C`,
      detailNote: 'Last logged 14 min ago · Next check due 4:00 PM',
      statusLabel: 'In Safe Range',
      statusTone: 'nominal',
      icon: Thermometer,
    },
    {
      moduleId: 'atm-cash',
      title: 'ATM Cash Balance',
      headlineMetric: '$4,840.00',
      breakdown: '112 × $20 ($2,240) · 52 × $50 ($2,600)',
      detailNote: `Low-cash alert threshold: $${businessConfig.atmLowCashAlert.toLocaleString()}`,
      statusLabel: 'Healthy Reserve',
      statusTone: 'nominal',
      icon: Banknote,
    },
    {
      moduleId: 'fb-posts',
      title: 'Scheduled Facebook Posts',
      headlineMetric: '3 Scheduled',
      breakdown: 'Next: Today 5:00 PM',
      detailNote: 'Weekend Cold Drinks & Ice Bundle promo queued',
      statusLabel: 'Queue Ready',
      statusTone: 'neutral',
      icon: Megaphone,
    },
    {
      moduleId: 'pricematch',
      title: 'Smoke Price Tracker',
      headlineMetric: '5 Price Updates',
      breakdown: `${businessConfig.defaultSuppliers.length} tracked suppliers`,
      detailNote: 'Tobacco & smoke SKU wholesale changes flagged for margin check',
      statusLabel: 'Review Alerts',
      statusTone: 'warning',
      icon: Tag,
    },
  ];

  const visibleCards = allCards.filter((card) => hasModuleAccess(currentUser, card.moduleId));
  const visibleEvents = RECENT_EVENTS.filter((event) =>
    hasModuleAccess(currentUser, event.moduleId)
  );

  const canOpenPos = hasModuleAccess(currentUser, 'pos-orders');
  const canOpenSettings = hasModuleAccess(currentUser, 'settings');

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Store Operations Overview
          </h2>
          <p className="text-sm text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {businessConfig.storeName} — {businessConfig.address}
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span>
              Signed in as{' '}
              <strong className="font-semibold text-slate-900">{currentUser.name}</strong> (
              {currentUser.role})
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="font-mono tabular-nums text-xs text-slate-500">{formattedDate}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {canOpenSettings && (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Settings className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              <span>Settings</span>
            </button>
          )}

          {canOpenPos && (
            <button
              type="button"
              onClick={() => onNavigate('pos-orders')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Open POS Queue</span>
            </button>
          )}
        </div>
      </section>

      <section aria-label="Live store module status">
        {visibleCards.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
            <h3 className="text-base font-semibold text-slate-900">
              No Operational Modules Assigned
            </h3>
            <p className="text-sm text-slate-600">
              Your account currently has no active module permissions. Contact your Store Admin
              to enable access.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 sm:gap-5">
            {visibleCards.map((card, index) => {
              const Icon = card.icon;
              const statusColorClass =
                card.statusTone === 'nominal'
                  ? 'text-emerald-700'
                  : card.statusTone === 'warning'
                    ? 'text-amber-700'
                    : 'text-slate-700';

              return (
                <button
                  key={card.moduleId}
                  type="button"
                  onClick={() => onNavigate(card.moduleId)}
                  className={`${getSpanClass(index, visibleCards.length)} group bg-white border border-slate-200 hover:border-orange-500 rounded-xl p-5 sm:p-6 text-left flex flex-col justify-between gap-5 transition-colors focus-visible:outline-2 focus-visible:outline-orange-500`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-orange-50 text-slate-700 group-hover:text-orange-600 flex items-center justify-center shrink-0 transition-colors">
                          <Icon className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {card.title}
                        </h3>
                      </div>

                      <ArrowUpRight
                        className="w-4 h-4 text-slate-400 group-hover:text-orange-600 shrink-0 transition-colors"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                        {card.headlineMetric}
                      </div>
                      <div className="text-xs font-medium text-slate-700 font-mono tabular-nums">
                        {card.breakdown}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{card.detailNote}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1.5 font-semibold ${statusColorClass}`}>
                      {card.statusTone === 'nominal' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      ) : card.statusTone === 'warning' ? (
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>{card.statusLabel}</span>
                    </span>

                    <span className="font-medium text-slate-500 group-hover:text-orange-600 transition-colors whitespace-nowrap">
                      Open Module
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent Store Activity</h3>
            <p className="text-xs text-slate-500">
              Permitted operational events for {businessConfig.storeName} — {businessConfig.address}
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
            {visibleEvents.length} entries visible
          </span>
        </div>

        {visibleEvents.length === 0 ? (
          <div className="px-5 py-6 text-xs text-slate-500">
            No recent activity entries for your assigned modules.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-5 whitespace-nowrap">Time</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Module</th>
                  <th className="py-2.5 px-4">Activity Detail</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Logged By</th>
                  <th className="py-2.5 px-5 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {visibleEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-5 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {event.time}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {event.area}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{event.summary}</td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{event.staff}</td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onNavigate(event.moduleId)}
                        className="font-semibold text-orange-600 hover:text-orange-700 transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

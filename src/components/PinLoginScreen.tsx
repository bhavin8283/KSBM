import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Delete, LockKeyhole, ShieldCheck, Store, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { STORE_INFO, type StaffProfile } from '../types';

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function PinLoginScreen() {
  const { staffProfiles, loginWithPin } = useAuth();
  const { businessConfig } = useStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const attemptLogin = useCallback(
    (candidatePin: string) => {
      if (candidatePin.length < 4) {
        setError('Enter all 4 digits of your staff PIN.');
        return;
      }
      const result = loginWithPin(candidatePin);
      if (!result.success) {
        setError(result.error ?? 'Incorrect PIN.');
        setPin('');
      }
    },
    [loginWithPin]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      setError(null);
      setPin((prev) => {
        if (prev.length >= 4) return prev;
        const next = prev + digit;
        if (next.length === 4) {
          queueMicrotask(() => attemptLogin(next));
        }
        return next;
      });
    },
    [attemptLogin]
  );

  const handleBackspace = useCallback(() => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setError(null);
    setPin('');
  }, []);

  const handleQuickProfileSelect = (profile: StaffProfile) => {
    setError(null);
    setPin(profile.pin);
    attemptLogin(profile.pin);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        handleDigit(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        handleBackspace();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleClear();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        attemptLogin(pin);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [attemptLogin, handleBackspace, handleClear, handleDigit, pin]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5 bg-slate-900 text-slate-100 p-6 sm:p-8 flex flex-col justify-between gap-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight text-white truncate">
                  {STORE_INFO.shortName} — {businessConfig.storeName}
                </h1>
                <p className="text-xs text-slate-400 truncate">{businessConfig.address}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white text-balance">
                Staff Terminal Sign-In
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Enter your 4-digit PIN to unlock authorized store modules, counter queues, and
                daily compliance tools.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Staff Directory</span>
              <span>Tap to sign in</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {staffProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => handleQuickProfileSelect(profile)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-lg border text-left transition-colors focus-visible:outline-2 focus-visible:outline-orange-500 ${
                    profile.active
                      ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 hover:border-orange-500/60'
                      : 'bg-slate-900/50 border-slate-800 opacity-55'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {profile.name}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {profile.role} · {profile.active ? profile.shiftLabel : 'Inactive'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums text-xs font-semibold text-orange-400">
                      PIN {profile.pin}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <LockKeyhole className="w-4 h-4 text-orange-600" aria-hidden="true" />
                <span>Enter 4-Digit Staff PIN</span>
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap">Keyboard Supported</span>
            </div>

            <div className="grid grid-cols-4 gap-3" aria-label="PIN entry display">
              {[0, 1, 2, 3].map((index) => {
                const isFilled = index < pin.length;
                const isActive = index === pin.length;
                return (
                  <div
                    key={index}
                    className={`h-14 rounded-lg border flex items-center justify-center font-mono text-xl font-bold transition-colors ${
                      error
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : isActive
                          ? 'border-orange-500 bg-orange-50/40 text-slate-900'
                          : isFilled
                            ? 'border-slate-300 bg-slate-50 text-slate-900'
                            : 'border-slate-200 bg-white text-slate-300'
                    }`}
                  >
                    {isFilled ? '•' : ''}
                  </div>
                );
              })}
            </div>

            <div className="min-h-5">
              {error ? (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {error}
                </p>
              ) : (
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <span>Module visibility and actions adapt to your assigned store permissions.</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {KEYPAD_KEYS.map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="h-14 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-lg font-mono font-semibold text-slate-900 tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-orange-500"
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="h-14 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-sm font-medium text-slate-600 transition-colors focus-visible:outline-2 focus-visible:outline-orange-500"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-14 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-lg font-mono font-semibold text-slate-900 tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-orange-500"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              aria-label="Backspace"
              className="h-14 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors focus-visible:outline-2 focus-visible:outline-orange-500"
            >
              <Delete className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => attemptLogin(pin)}
            className="w-full h-12 rounded-lg bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
          >
            <UserCheck className="w-4 h-4" aria-hidden="true" />
            <span>Unlock Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}

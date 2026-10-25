import { Delete } from "lucide-react";
import { PIN_MAX, PIN_MIN } from "../local/lock";

// The on-screen number pad for PINs: no system keyboard, so nothing is
// remembered or suggested by it.
export default function PinPad({
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  const press = (digit: string) => {
    if (!disabled && value.length < PIN_MAX) onChange(value + digit);
  };
  const key =
    "flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-[26px] font-medium transition active:scale-95 active:bg-surface-3 disabled:opacity-40";

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="flex h-4 items-center gap-3"
        aria-label={`${value.length} digits entered`}
      >
        {Array.from({ length: Math.max(PIN_MIN, value.length) }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 ${
              i < value.length
                ? "border-primary bg-primary"
                : "border-border-strong"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            className={key}
            disabled={disabled}
            onClick={() => press(d)}
          >
            {d}
          </button>
        ))}
        <span />
        <button
          type="button"
          className={key}
          disabled={disabled}
          onClick={() => press("0")}
        >
          0
        </button>
        <button
          type="button"
          className={`${key} !bg-transparent`}
          aria-label="Delete last digit"
          disabled={disabled || !value}
          onClick={() => onChange(value.slice(0, -1))}
        >
          <Delete size={24} />
        </button>
      </div>

      <button
        type="button"
        className="btn btn-primary w-full max-w-[264px]"
        disabled={disabled || value.length < PIN_MIN}
        onClick={onSubmit}
      >
        {submitLabel}
      </button>
    </div>
  );
}

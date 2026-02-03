type SliderFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  valueLabel?: string;
};

export const SliderField = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  valueLabel,
}: SliderFieldProps) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const normalized = Number.isFinite(percentage)
    ? Math.min(100, Math.max(0, percentage))
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#898a8b]">{label}</span>
        <span className="rounded-full bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[11px] font-semibold text-[#898a8b]">
          {valueLabel ?? value}
        </span>
      </div>
      <div className="relative h-4">
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[rgba(255,255,255,0.08)]" />
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[#9aed00]"
          style={{ width: `${normalized}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="refined-slider relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent"
          aria-label={label}
        />
      </div>
    </div>
  );
};

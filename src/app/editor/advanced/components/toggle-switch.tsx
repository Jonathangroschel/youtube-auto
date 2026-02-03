type ToggleSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
};

export const ToggleSwitch = ({ checked, onChange, ariaLabel }: ToggleSwitchProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(154,237,0,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1012] ${
        checked ? "bg-[#9aed00]" : "bg-[rgba(255,255,255,0.08)]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-[#f7f7f8] shadow-[0_2px_6px_rgba(0,0,0,0.3)] transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
};

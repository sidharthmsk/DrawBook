interface CheckboxCellProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function CheckboxCell({ value, onChange }: CheckboxCellProps) {
  return (
    <div className="grid-cell__checkbox-wrap" onClick={() => onChange(!value)}>
      <div
        className={`grid-cell__checkbox${value ? " grid-cell__checkbox--checked" : ""}`}
      >
        {value && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

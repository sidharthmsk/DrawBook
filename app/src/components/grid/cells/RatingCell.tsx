interface RatingCellProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
}

export function RatingCell({ value, max, onChange }: RatingCellProps) {
  return (
    <div className="grid-cell__rating">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          className={`grid-cell__star${i < value ? " grid-cell__star--filled" : ""}`}
          onClick={() => onChange(i + 1 === value ? 0 : i + 1)}
          title={`${i + 1} star${i + 1 > 1 ? "s" : ""}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill={i < value ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <path d="M8 1.5l1.76 3.57 3.94.57-2.85 2.78.67 3.93L8 10.52l-3.52 1.83.67-3.93L2.3 5.64l3.94-.57L8 1.5z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

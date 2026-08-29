export function PackNumberField({
  label,
  max,
  min,
  onChange,
  value,
}: Readonly<{
  label: string;
  max?: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}>) {
  return (
    <label>
      {label}
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        required
        type="number"
        value={value}
      />
    </label>
  );
}

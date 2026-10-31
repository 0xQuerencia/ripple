const CHOICES = [
  ["negative", "a disruption"],
  ["positive", "good news"],
];

/** Is the what-if bad news or good news? Two plain choices, usable with the keyboard. */
export function ToneToggle({ name, value, onChange }) {
  return (
    <fieldset className="tone">
      <legend className="sr-only">What kind of change is it?</legend>
      {CHOICES.map(([choice, label]) => (
        <label key={choice} className={value === choice ? "is-on" : ""}>
          <input
            type="radio"
            name={name}
            value={choice}
            checked={value === choice}
            onChange={() => onChange(choice)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

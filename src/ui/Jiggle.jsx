/** Text whose letters shiver on their own tiny beat, like a hand-drawn title that will not sit still. */
export function Jiggle({ children, as: Tag = "span", className = "" }) {
  const text = String(children);
  let index = 0;
  return (
    <Tag className={`jig ${className}`} aria-label={text}>
      {text.split(" ").map((word, w) => (
        <span key={w} className="jw" aria-hidden="true">
          {[...word].map((letter) => (
            <span
              key={index}
              className="jc"
              style={{ "--d": `${(index++ * 173) % 760}ms` }}
            >
              {letter}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}

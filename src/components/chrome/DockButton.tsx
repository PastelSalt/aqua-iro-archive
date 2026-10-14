/**
 * The one dock button (DOCK-PLAN §4): a Phosphor icon with one short label under it, in the visitor's
 * language. Chapters are links, system buttons are buttons; both share the same size and styles
 * (rest, hover, focus, current chapter, toggled on). Styles live in styles/dock.css.
 */
type Props = {
  icon: string; // Phosphor name, e.g. "house" (#ph-house in the sprite)
  /** CSS var for the icon's soft fill, e.g. "--icon-home" */
  tint?: string;
  /** one label, or { ja, en } shown by the page language */
  label: string | { ja: string; en: string };
  href?: string;
  current?: boolean;
  pressed?: boolean;
  /** screen-reader text added after the visible label (links) or used as the button's name */
  sr?: string;
  ariaLabel?: string;
  onClick?: (e: MouseEvent) => void;
  attrs?: Record<string, string | number | boolean | undefined>;
};

export default function DockButton({
  icon,
  tint = '--icon-sys',
  label,
  href,
  current,
  pressed,
  sr,
  ariaLabel,
  onClick,
  attrs,
}: Props) {
  const inner = (
    <>
      <svg class="dbtn__icon" style={`--ph-fill:var(${tint})`} aria-hidden="true" focusable="false">
        <use href={`#ph-${icon}`} />
      </svg>
      {typeof label === 'string' ? (
        <span class="dbtn__label">{label}</span>
      ) : (
        <span class="dbtn__label">
          <span lang="ja" class="l-ja">
            {label.ja}
          </span>
          <span lang="en" class="l-en">
            {label.en}
          </span>
        </span>
      )}
      {sr && <span class="sr-only"> {sr}</span>}
    </>
  );
  if (href)
    return (
      <a
        class="dbtn"
        href={href}
        data-astro-prefetch="hover"
        aria-current={current ? 'page' : undefined}
        onClick={onClick as never}
        {...attrs}
      >
        {inner}
      </a>
    );
  return (
    <button
      type="button"
      class="dbtn"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      onClick={onClick as never}
      {...attrs}
    >
      {inner}
    </button>
  );
}

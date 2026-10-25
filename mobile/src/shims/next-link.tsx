import type { AnchorHTMLAttributes, Ref } from "react";
import { Link } from "react-router";

// Stands in for next/link in the Android app, so the web app's components
// can be reused as they are. Takes the same props they use.

type Href =
  | string
  | {
      pathname?: string;
      query?: Record<string, string | number | undefined>;
      hash?: string;
    };

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: Href;
  replace?: boolean;
  // Next scrolls to the top on navigation unless this is false.
  scroll?: boolean;
  // There's nothing to prefetch: data comes from the phone.
  prefetch?: boolean | null;
  ref?: Ref<HTMLAnchorElement>;
}

function toPath(href: Href) {
  if (typeof href === "string") return href;
  const query = Object.entries(href.query ?? {}).flatMap(([k, v]) =>
    v === undefined ? [] : [[k, String(v)]],
  );
  const search = query.length ? `?${new URLSearchParams(query)}` : "";
  return `${href.pathname ?? ""}${search}${href.hash ? `#${href.hash}` : ""}`;
}

export default function NextLink({
  href,
  replace,
  scroll,
  // Dropped: not an attribute an <a> can take.
  prefetch: _prefetch, // eslint-disable-line @typescript-eslint/no-unused-vars
  ...rest
}: Props) {
  return (
    <Link
      to={toPath(href)}
      replace={replace}
      preventScrollReset={scroll === false}
      {...rest}
    />
  );
}

import type { ReactNode, SVGProps } from 'react';

type Occasion =
  | 'couple'
  | 'friends'
  | 'birthday'
  | 'gift'
  | 'barbecue'
  | 'wine'
  | 'christmas'
  | 'easter';

const paths: Record<Occasion, ReactNode> = {
  couple: (
    <>
      <path d="M24 47S7 37 7 22C7 9 23 5 30 16 37 5 53 9 53 22c0 15-17 25-23 25Z" />
      <path d="M30 18v19M24 22h12" />
    </>
  ),
  friends: (
    <>
      <circle cx="14" cy="18" r="5" />
      <circle cx="30" cy="13" r="6" />
      <circle cx="46" cy="18" r="5" />
      <path d="M5 45V34c0-6 4-10 9-10s9 4 9 10v11M21 45V29c0-7 4-11 9-11s9 4 9 11v16M37 45V34c0-6 4-10 9-10s9 4 9 10v11" />
    </>
  ),
  birthday: (
    <>
      <path d="M10 29h40v20H10zM7 49h46M14 20h32v9H14z" />
      <path d="M18 20v-7M30 20v-9M42 20v-7M16 10c2-3 4-3 4 0M28 8c2-3 4-3 4 0M40 10c2-3 4-3 4 0M10 36c7 5 13-5 20 0s13-5 20 0" />
    </>
  ),
  gift: (
    <>
      <path d="M8 23h44v28H8zM6 17h48v10H6zM30 17v34" />
      <path d="M30 17c-9 0-15-3-15-8 0-4 4-6 8-3 4 3 7 11 7 11ZM30 17c9 0 15-3 15-8 0-4-4-6-8-3-4 3-7 11-7 11Z" />
    </>
  ),
  barbecue: (
    <>
      <path d="M9 26h42c0 11-9 19-21 19S9 37 9 26ZM15 45l-4 9M45 45l4 9M30 45v10" />
      <path d="M19 21c-4-5 4-7 0-12M30 21c-4-5 4-7 0-14M41 21c-4-5 4-7 0-12" />
    </>
  ),
  wine: (
    <>
      <path d="M9 9h18l-2 17c-1 7-13 7-14 0L9 9ZM18 33v16M12 49h12" />
      <circle cx="43" cy="34" r="9" />
      <path d="M43 25c-3 5-3 13 0 18M35 34h16M47 18c4 2 7 6 7 11" />
    </>
  ),
  christmas: (
    <>
      <path d="m30 5-12 17h7L13 38h11L9 52h42L36 38h11L35 22h7L30 5ZM30 52v6" />
    </>
  ),
  easter: (
    <>
      <path d="M30 5c12 0 19 18 19 33 0 12-8 17-19 17S11 50 11 38C11 23 18 5 30 5Z" />
      <path d="M13 36c10-9 24 10 34 0M15 25c10 8 20-8 30 0" />
    </>
  ),
};

export function OccasionIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: Occasion }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 60 60"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

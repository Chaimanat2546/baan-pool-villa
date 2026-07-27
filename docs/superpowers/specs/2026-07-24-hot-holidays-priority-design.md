# Hot Holidays Priority Design

## Goal

Correct booking-calendar normalization so the upstream `hot_holidays` data is
read using its real field names and takes precedence over ordinary `holidays`
when their date ranges overlap.

## Upstream contract

- `holidays` continues to use `holiday_start`, `holiday_end`,
  `holiday_price`, `holiday_people`, `holiday_alert`, and `holiday_type`.
- `hot_holidays` uses `hot_holiday_start`, `hot_holiday_end`,
  `hot_holiday_price`, and `hot_holiday_people`.
- The implementation will not accept the `holiday_*` aliases inside
  `hot_holidays`, because the inspected production response does not expose
  that schema.

## Normalization

Add a dedicated raw type for `hot_holidays` and read its `hot_holiday_*`
fields. A valid hot-holiday entry produces a `hot_holiday` calendar day with:

- its own price and guest capacity;
- the existing fire icon and hot-holiday label/tone;
- higher event priority than ordinary holidays, hot promotions, and general
  promotions.

Existing confirmed and waiting booking events retain their higher priorities,
so an unavailable booked date remains unavailable even when it overlaps a hot
holiday.

Malformed or incomplete hot-holiday date ranges continue to be ignored by the
existing date-range parser.

## Verification

Update focused booking-calendar normalization tests to use the real
`hot_holiday_*` schema and add an overlap case proving that:

- `hot_holidays` overrides `holidays`;
- hot-holiday price and guest capacity are returned;
- booking events still override hot holidays.

Run the focused booking-calendar test file, lint, and the production Next.js
build before declaring the change complete.

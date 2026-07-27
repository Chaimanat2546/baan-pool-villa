# Hot Holidays Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize the real `hot_holidays` API schema and ensure valid hot-holiday data overrides ordinary holiday data.

**Architecture:** Keep normalization in `lib/villas/booking-calendar.ts`. Introduce a raw type dedicated to the `hot_holiday_*` contract, then feed those fields into the existing event-priority map where hot holidays already have priority 4 and bookings retain priorities 5–6.

**Tech Stack:** TypeScript 6, Vitest 4, Next.js 16

## Global Constraints

- `hot_holidays` accepts the inspected production fields `hot_holiday_start`, `hot_holiday_end`, `hot_holiday_price`, and `hot_holiday_people`.
- Valid `hot_holidays` override ordinary `holidays`, hot promotions, and general promotions.
- Waiting and confirmed bookings continue to override `hot_holidays`.
- Do not commit unless the user explicitly requests a commit.

---

### Task 1: Correct Hot-Holiday Normalization

**Files:**
- Modify: `lib/villas/__tests__/booking-calendar.test.ts`
- Modify: `lib/villas/booking-calendar.ts`

**Interfaces:**
- Consumes: `normalizeBookingCalendar(response: RawBookingCalendarResponse, month: string): BookingCalendarMonth`
- Produces: `RawBookingCalendarResponse.hot_holidays` typed with `RawHotHoliday[]`; normalized `BookingCalendarDay` values with `kind: "hot_holiday"`

- [ ] **Step 1: Write the failing schema and overlap test**

Update the existing hot-holiday fixture to use the real contract and overlap an ordinary holiday:

```ts
holidays: [
  {
    holiday_end: "2026-06-05",
    holiday_price: 18900,
    holiday_start: "2026-06-05",
    holiday_type: "holiday",
  },
],
hot_holidays: [
  {
    hot_holiday_end: "2026-06-05",
    hot_holiday_people: "10",
    hot_holiday_price: 15900,
    hot_holiday_start: "2026-06-05",
  },
],
```

Assert that the normalized day uses the hot-holiday values:

```ts
expect(calendar.days["2026-06-05"]).toMatchObject({
  guestCapacity: "10",
  icons: ["fire"],
  kind: "hot_holiday",
  price: 15900,
  tone: "hot_holiday",
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/booking-calendar.test.ts
```

Expected: TypeScript/Vitest failure because `RawHoliday` does not define `hot_holiday_*`, or the normalized day remains the ordinary holiday.

- [ ] **Step 3: Implement the real upstream contract**

In `lib/villas/booking-calendar.ts`, define and use:

```ts
interface RawHotHoliday {
  hot_holiday_end?: string | null;
  hot_holiday_people?: string | null;
  hot_holiday_price?: number | null;
  hot_holiday_start?: string | null;
}
```

Change `RawBookingCalendarResponse.hot_holidays` to `RawHotHoliday[] | null`. In the hot-holiday loop, read the `hot_holiday_*` date and price fields and use trimmed `hot_holiday_people` as `guestCapacity`, falling back to the base weekday capacity only when it is absent.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/booking-calendar.test.ts
```

Expected: all booking-calendar tests pass.

- [ ] **Step 5: Add booking-overlap regression coverage**

Add a focused test with a confirmed booking overlapping the same hot-holiday date:

```ts
expect(calendar.days["2026-06-05"]).toMatchObject({
  disabled: true,
  kind: "booking_confirmed",
  tone: "booked",
});
```

- [ ] **Step 6: Run focused tests, lint, and production build**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/booking-calendar.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit successfully with no test, lint, type-check, or build failures.

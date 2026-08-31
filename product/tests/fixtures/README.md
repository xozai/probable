# M1 walking-skeleton fixture

Referenced by `T-AC5-06` (`product/tests/TEST_PLAN.md`) and exercised end to
end by `tests/e2e/walking-skeleton.spec.ts` (M1-13). The scenario is built
live through the real UI in every run — there is no seed script or checked-in
data file — but its shape and expected totals are fixed here so the test's
assertions have a documented source of truth instead of being re-derived
from the test body.

## Scenario

1. Firm owner (`demo.engineer@example.test`) creates a firm and adds
   **Traffic Control** to the firm's section defaults (in addition to the
   seeded Earthwork/Paving/Storm/Water/Sanitary/Misc from M1-08).
2. Owner invites `demo.invitee@example.test`, who accepts as a `member`.
3. The invited member creates a project and a 30% / revision 1 estimate at
   the form default contingency, **10.00%**.
4. The member adds two line items:

   | Description   | Quantity | Unit | Section   | Unit price | Extension  |
   |----------------|---------:|------|-----------|-----------:|-----------:|
   | Excavation     |      500 | CY   | Earthwork |     $12.50 | $6,250.00  |
   | Base course    |    1,200 | SY   | Paving    |      $8.25 | $9,900.00  |

   Excavation is entered through the manual add form. Base course is
   entered via **TSV paste** (`Base course\t1200\tSY`, matching AC3's
   description/quantity/unit column order — paste has no price column), then
   priced and assigned to Paving afterward through the row's inline
   Section/Unit price fields, the same way a real user would price a pasted
   row before totals reflect it.

## Expected totals (`lib/estimate/math.ts` money policy)

- Earthwork subtotal: **$6,250.00**
- Paving subtotal: **$9,900.00**
- Subtotal: **$16,150.00**
- Contingency (10.00%): **$1,615.00**
- Total: **$17,765.00**

No rounding boundary is exercised by these numbers (each extension and the
contingency land on an exact cent); rounding-boundary behavior is covered
separately by `T-AC5-04` at the unit level in
`src/exports/estimate-exhibit.test.ts` / `lib/estimate/math.test.ts`.

## PDF exhibit

The same estimate's PDF download (`GET /estimates/[estimateId]/export/pdf`)
is asserted for a `%PDF-` signature and a deterministic
`<project-slug>-<milestone>-percent-rev-<revision>.pdf` filename, matching
the convention already covered by `tests/e2e/totals.spec.ts`.

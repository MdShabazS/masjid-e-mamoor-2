import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function repoFile(path: string) {
  return resolve(
    process.cwd(),
    "../..",
    path,
  );
}

const migration = readFileSync(
  repoFile(
    "supabase/migrations/20260922002000_donation_outstanding_snapshot.sql",
  ),
  "utf8",
);

const server = readFileSync(
  repoFile(
    "apps/web/src/lib/donations/server.ts",
  ),
  "utf8",
);

const page = readFileSync(
  repoFile(
    "apps/web/src/app/donations/page.tsx",
  ),
  "utf8",
);

describe(
  "authoritative donation outstanding snapshot",
  () => {
    it(
      "calculates allocations, waivers, and outstanding in PostgreSQL",
      () => {
        expect(migration).toContain(
          "get_donation_outstanding_snapshot",
        );

        expect(migration).toContain(
          "security definer",
        );

        expect(migration).toContain(
          "sum(dpa.allocated_amount_paise)",
        );

        expect(migration).toContain(
          "sum(dow.waived_amount_paise)",
        );

        expect(migration).toContain(
          "outstanding_amount_paise",
        );

        expect(migration).toContain(
          "'total_outstanding_paise'",
        );
      },
    );

    it(
      "keeps organization-wide scope behind the existing donation role boundary",
      () => {
        expect(migration).toContain(
          "'donations.obligations.read'",
        );

        for (const role of [
          "president",
          "vice_president",
          "secretary",
          "finance",
          "auditor",
        ]) {
          expect(migration).toContain(
            `'${role}'`,
          );
        }

        expect(migration).toContain(
          "mp.application_user_id =",
        );
      },
    );

    it(
      "uses the snapshot for obligation balance rendering",
      () => {
        expect(server).toContain(
          '"get_donation_outstanding_snapshot"',
        );

        expect(page).toContain(
          "getDonationOutstandingSnapshot()",
        );

        expect(page).toContain(
          "outstandingSnapshot.totalOutstandingPaise",
        );

        expect(page).toContain(
          "obligation.outstandingAmountPaise",
        );

        expect(page).not.toContain(
          "allocatedByObligation",
        );

        expect(page).not.toContain(
          "waivedByObligation",
        );
      },
    );
  },
);

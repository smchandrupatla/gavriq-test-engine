# Reporting fixture R1

Six logical leaves: `reportId`, `createdAt`, `currency`, `transaction.amount`, `transaction.country`, optional `transaction.reference`.

- Text `reportId` keeps leading zeros (`00123`).
- Threshold rule under test: `amount >= 1000` → 999 false, 1000 true, 1001 true.
- CSV represents one transaction per record. The sample reference contains a comma and must stay quoted.
- Countries are configuration examples, not a sanctions policy.

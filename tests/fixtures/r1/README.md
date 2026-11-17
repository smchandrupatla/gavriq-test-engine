# Reporting fixture R1

Six logical leaves: `reportId`, `createdAt`, `currency`, `transaction.amount`, `transaction.country`, optional `transaction.reference`.

- Text `reportId` keeps leading zeros (`00123`).
- `transaction` occurs 1..3, so JSON instances carry it as an array (the JSON Schema builder turns repeating nodes into arrays); XML repeats the element and CSV has one transaction per record. `r1.boundary-amounts.json` rows are rule-evaluation inputs, not schema instances, and keep a single `transaction` object.
- Threshold rule under test: `amount >= 1000` → 999 false, 1000 true, 1001 true.
- CSV represents one transaction per record. The sample reference contains a comma and must stay quoted.
- Countries are configuration examples, not a sanctions policy.

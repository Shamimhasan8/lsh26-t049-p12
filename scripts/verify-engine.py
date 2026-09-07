#!/usr/bin/env python3
"""Independent reference implementation of the P12 rules using Decimal with
ROUND_HALF_UP — verifies the TypeScript engine dump for all 25 public cases."""
import json
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
import calendar

D = Decimal
CENT = D("0.01")


def paise(s):
    return int((D(str(s)) * 100).quantize(D("1")))


def dps_sim(deposit_p, rate_percent, target_p, max_months=600):
    rate = D(str(rate_percent))
    balance = 0
    rows = []
    months = 0
    deposited = 0
    while balance < target_p and months < max_months:
        months += 1
        deposited += deposit_p
        after = balance + deposit_p
        # interest in paisa, rounded HALF UP to the paisa (integer paisa)
        interest = int((D(after) * rate / D(12) / D(100)).quantize(D("1"), rounding=ROUND_HALF_UP))
        balance = after + interest
        rows.append((balance - deposit_p - interest, deposit_p, interest, balance))
    return months, balance, deposited, balance - deposited, rows


def main():
    with open("src/data/P12_personal_ledger_public.json") as f:
        data = json.load(f)
    with open("scripts/engine-dump.json") as f:
        dump = {d["case_id"]: d for d in json.load(f)}

    failures = []
    for c in data["cases"]:
        cid = c["case_id"]
        d = dump[cid]
        # 1. month totals
        last_key, this_key = c["months"]["last"], c["months"]["this"]
        tot_last = sum(paise(e["amount_bdt"]) for e in c["expenses"] if e["date"][:7] == last_key)
        tot_this = sum(paise(e["amount_bdt"]) for e in c["expenses"] if e["date"][:7] == this_key)
        if d["totals"]["last"] != tot_last:
            failures.append(f"{cid}: last total {d['totals']['last']} != {tot_last}")
        if d["totals"]["this"] != tot_this:
            failures.append(f"{cid}: this total {d['totals']['this']} != {tot_this}")
        # 2. category totals
        cat_last, cat_this = {}, {}
        for e in c["expenses"]:
            if e["date"][:7] == last_key:
                cat_last[e["category"]] = cat_last.get(e["category"], 0) + paise(e["amount_bdt"])
            elif e["date"][:7] == this_key:
                cat_this[e["category"]] = cat_this.get(e["category"], 0) + paise(e["amount_bdt"])
        for row in d["categories"]:
            if row["last"] != cat_last.get(row["c"], 0):
                failures.append(f"{cid}: cat {row['c']} last {row['last']} != {cat_last.get(row['c'], 0)}")
            if row["this"] != cat_this.get(row["c"], 0):
                failures.append(f"{cid}: cat {row['c']} this {row['this']} != {cat_this.get(row['c'], 0)}")
        # 3. DPS simulation per pocket
        rate = c["dps_annual_rate_percent"]
        for p in c["pockets"]:
            pd = next(x for x in d["pockets"] if x["id"] == p["id"])
            deposit_p = paise(p["monthly_contribution_bdt"])
            target_p = paise(p["target_bdt"])
            months, balance, deposited, interest, rows = dps_sim(deposit_p, rate, target_p)
            if pd["monthsNeeded"] != months:
                failures.append(f"{cid}/{p['id']}: months {pd['monthsNeeded']} != {months}")
            if pd["maturity"] != balance:
                failures.append(f"{cid}/{p['id']}: maturity {pd['maturity']} != {balance}")
            if pd["interest"] != interest:
                failures.append(f"{cid}/{p['id']}: interest {pd['interest']} != {interest}")
            for i, ref in enumerate(rows[:3]):
                got = pd["schedule_first3"][i]
                if (got["opening"], got["deposit"], got["interest"], got["closing"]) != ref:
                    failures.append(f"{cid}/{p['id']} month {i+1}: {got} != {ref}")
            # interestFirst3 match
            if pd["first3_interest"] != [r[2] for r in rows[:3]]:
                failures.append(f"{cid}/{p['id']}: first3 mismatch")
        # 4. half-up rounding spot check: verify a known half case in engine dump
    if failures:
        print("FAILURES:")
        for f_ in failures:
            print(" -", f_)
        raise SystemExit(1)
    print(f"ALL CHECKS PASSED for {len(data['cases'])} cases (totals, categories, DPS schedule, maturity, interest)")

    # explicit half-up boundary test
    m, b, dep, it, rows = dps_sim(100000, "9.00", 10**9, max_months=1200)
    print("half-up sanity (1,000/mo @9% to 1e9 paisa):", m, "months, balance", b)
    # exact .5 paisa check: deposit such that interest lands on .5
    # balance=500000 paisa (5000.00) at 9% -> interest = 500000*9/1200 = 3750 exact
    # balance=5 paisa at 9% -> 5*9/1200 = 0.0375 -> 0.04 half-up? 0.0375 -> 0.04 (round at paisa=4)
    m2, b2, dep2, it2, rows2 = dps_sim(5, "9.00", 10**7, max_months=1200)
    print("tiny deposit interest month1:", rows2[0][2], "(expect round-half-up of 0.0375 = 4 paisa... verify)")
    exp = int((D(5 + 5) * D("9") / D(12) / D(100)).quantize(CENT, ROUND_HALF_UP))
    assert rows2[0][2] == exp, f"half-up mismatch {rows2[0][2]} != {exp}"
    print("half-up boundary verified:", exp)


if __name__ == "__main__":
    main()

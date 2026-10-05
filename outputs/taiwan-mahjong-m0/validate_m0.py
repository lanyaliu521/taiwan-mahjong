"""M0 fixture consistency checks only; this is not the future game engine."""
import json
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from functools import cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent
KINDS = [f'{n}{s}' for s in 'mps' for n in range(1, 10)] + [f'{n}z' for n in range(1, 8)]


@cache
def meld_partitions(counts, remaining):
    if remaining == 0:
        return ((),) if not any(counts) else ()
    first = next((i for i, n in enumerate(counts) if n), None)
    if first is None:
        return ()
    choices = []
    if counts[first] >= 3:
        choices.append((first, first, first))
    if first < 27 and first % 9 <= 6 and counts[first + 1] and counts[first + 2]:
        choices.append((first, first + 1, first + 2))
    result = set()
    for group in choices:
        rest = list(counts)
        for i in group:
            rest[i] -= 1
        for parts in meld_partitions(tuple(rest), remaining - 1):
            result.add(tuple(sorted((group,) + parts)))
    return tuple(sorted(result))


def decompositions(hand, melds):
    if len(hand) + 3 * len(melds) != 17:
        return ()
    counts = [hand.count(k) for k in KINDS]
    result = []
    for i, count in enumerate(counts):
        if count >= 2:
            rest = counts.copy()
            rest[i] -= 2
            result.extend((i, parts) for parts in meld_partitions(tuple(rest), 5 - len(melds)))
    return tuple(result)


def check_tiles(case):
    hand, melds = case['concealed'], case['melds']
    all_tiles = hand + [t for m in melds for t in m['tiles']]
    assert all(t in KINDS for t in all_tiles), '未知一般牌編碼'
    assert all(n <= 4 for n in Counter(all_tiles).values()), '自有牌超過四張'
    assert len(melds) <= 5, '超過五面子'
    for meld in melds:
        ts, kind = meld['tiles'], meld['kind']
        if kind == 'chi':
            ids = sorted(KINDS.index(t) for t in ts)
            assert len(ids) == 3 and ids[0] < 27 and ids[0] // 9 == ids[-1] // 9
            assert ids == list(range(ids[0], ids[0] + 3)), '吃牌不是同門連號'
        else:
            assert kind in ('pon', 'concealedKong', 'exposedKong', 'addedKong')
            assert len(ts) == (3 if kind == 'pon' else 4) and len(set(ts)) == 1


def main():
    data = json.loads((ROOT / 'cases.json').read_text(encoding='utf-8'))
    rules = (ROOT / 'RULES.md').read_text(encoding='utf-8')
    errors, checked = [], []

    def run(label, operation):
        try:
            operation()
            checked.append(label)
        except (AssertionError, KeyError, TypeError, ValueError) as exc:
            errors.append(f'{label}: {exc or "期望不符"}')

    def schema():
        assert data['schemaVersion'] == 1 and data['rulesetId'] == 'TW16-CLASSIC-v1'
        ids = [c['id'] for section in ('handCases', 'waitCases', 'scenarioCases', 'paymentCases') for c in data[section]]
        assert len(ids) == len(set(ids)), '案例ID重複'
        expected = {f'S{n:02}' for n in range(1, 33)}
        assert {c['scoreId'] for c in data['scoreCoverage']} == expected
        assert len(data['scoreCoverage']) == 32
        assert set(re.findall(r'^\| (S\d{2}) \|', rules, re.M)) == expected
        rule_ids = set(re.findall(r'\*\*(R\d{2}) ', rules))
        used_rules = {rule for section in ('handCases', 'waitCases', 'scenarioCases', 'paymentCases') for c in data[section] for rule in c['rules']}
        assert used_rules == rule_ids, f'規則覆蓋差異={used_rules ^ rule_ids}'
        for case in data['scoreCoverage']:
            assert case['positive'].strip() and case['negative'].strip()
            value = str(case['tai'])
            row = re.search(rf'^\| {case["scoreId"]} \| (.+)$', rules, re.M).group(1)
            assert ('2N' if value == '2*N' else value) in row
        for case in data['scenarioCases']:
            assert case['givenAndWhen'] and case['expected']
    run('資料結構、案例ID、32台項對照及情境欄位', schema)

    for case in data['handCases']:
        def check_hand(c=case):
            check_tiles(c)
            solutions = decompositions(c['concealed'], c['melds'])
            assert bool(solutions) == c['expectedWin'], f'結構胡牌={bool(solutions)}'
            assert len(solutions) >= c.get('expectedDecompositionsAtLeast', 0)
        run(case['id'], check_hand)

    for case in data['waitCases']:
        def check_wait(c=case):
            check_tiles(c)
            assert len(c['concealed']) + 3 * len(c['melds']) == 16
            owned = Counter(c['concealed'] + [t for m in c['melds'] for t in m['tiles']])
            actual = {t for t in KINDS if owned[t] < 4 and decompositions(c['concealed'] + [t], c['melds'])}
            assert actual == set(c['expectedWaits']), f'實際聽口={sorted(actual)}'
        run(case['id'], check_wait)

    for case in data['paymentCases']:
        def check_payment(c=case):
            delta, transfers = [0] * 4, {}
            assert c['winner'] not in c['payers'] and len(set(c['payers'])) == len(c['payers'])
            for payer in c['payers']:
                extra = 1 + 2 * c['streak'] if c['dealer'] in (payer, c['winner']) else 0
                value = 30 + 10 * (c['baseTai'] + extra)
                transfers[str(payer)] = value
                delta[payer] -= value
                delta[c['winner']] += value
            assert transfers == c['expectedTransfers']
            assert delta == c['expectedDelta'] and sum(delta) == 0
        run(case['id'], check_payment)

    timestamp = datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds')
    result = 'PASS' if not errors else 'FAIL'
    report = [
        '# M0 資料一致性驗證', '', f'執行時間：{timestamp}', f'結果：{result}；{len(checked)} 個檢查通過，{len(errors)} 個失敗。', '',
        f'- {len(data["handCases"])} 個一般胡牌結構案例：獨立五面子枚舉，含14張拒絕、槓的實體張數、順刻多解。',
        f'- {len(data["waitCases"])} 個聽口案例：枚舉34種候選牌，比對完整聽口集合。',
        f'- {len(data["paymentCases"])} 個付款案例：重算逐家付款、莊連台與零和。',
        f'- {len(data["scoreCoverage"])} 個台項的ID／數值對照與正反情境、{len(data["scenarioCases"])}個流程情境的資料格式檢查；18條規則均有案例引用。', '',
        '**界線：本檢查未實作計台器或行牌狀態機；台項文字與流程情境仍須於 M1 接成真正引擎測試。沒有執行完整牌局、AI、存檔或瀏覽器測試。**', '',
        '重跑方式：在本資料夾執行 `python validate_m0.py`（僅Python標準函式庫）。', '',
    ]
    if errors:
        report += ['失敗：'] + [f'- {e}' for e in errors]
    (ROOT / 'VALIDATION.md').write_text('\n'.join(report) + '\n', encoding='utf-8')
    print(f'{result}: {len(checked)} passed, {len(errors)} failed')
    for error in errors:
        print(error)
    return int(bool(errors))


if __name__ == '__main__':
    raise SystemExit(main())

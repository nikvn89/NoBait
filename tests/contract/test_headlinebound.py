"""
Deterministic tests for contracts/HeadlineBound.py in GenLayer Direct Mode
(genlayer-test: the real py-genlayer v0.2.16 SDK with storage, TreeMap, u256,
Keccak256 and gl.vm.UserError; the model is mocked).

The mocked labels are ASSUMED labels that drive the deterministic code paths.
They say nothing about what the real model returns; the on-chain table does.

Direct Mode does not record native transfers, so payouts are proven through the
credit ledger and an accounting invariant:
sum of credits + bonds held by OPEN pieces == total received - total withdrawn.

Run:  python3 -m pytest tests/contract -q -p no:cacheprovider
"""

import re
from pathlib import Path

import pytest
from gltest.direct.loader import create_address

from glkit import (J, calls_of, check_forbidden_constructs, check_revert_coverage, eval_payload, gate_rubric, hx,
                   load_runtime, lo, norm, replay)

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = str(ROOT / "contracts" / "HeadlineBound.py")
GATE = str(next(ROOT.glob("*_KILLSET_CHECK.py")))
RUNTIME = load_runtime(ROOT)

BOND = 2 * 10 ** 15

# (headline, summary)
O1 = ("Compound slows tumour growth by a third", "In mice, the compound slowed tumour growth by a third.")
O2 = ("Sales rose last quarter", "Sales rose in two of the five regions last quarter.")
O3 = ("Update makes the battery last longer", "Some users reported the battery lasted longer after the update.")
O4 = ("Council closes the library on Sundays", "The council discussed closing the library on Sundays.")
O5 = ("Drug cures migraines in adults", "The trial found the drug may reduce migraines for some adults.")
W1 = ("Compound slows tumour growth in mice", "In mice, the compound slowed tumour growth by a third.")
W2 = ("Sales rose last quarter", "Sales rose in all five regions last quarter.")
W3 = ("Update makes the battery last longer", "Every phone in the test kept its charge longer after the update.")
W4 = ("Council closes the library on Sundays", "The council voted to close the library on Sundays.")
W5 = ("Drug reduces migraines for most adults", "The trial found the drug reduced migraines for most adults.")
ASSUMED_OVERCLAIMS = (O1, O2, O3, O4, O5)

M_NOT_OPEN = "This piece is no longer open to challenge"
M_AUTHOR = "The author cannot challenge their own piece"
M_EQUAL = "The challenge bond must equal the author's bond"
M_ONLY_AUTHOR = "Only the author may retire this piece"


def pair_pattern(case):
    headline, summary = case
    return (r"(?s)<UNTRUSTED_SUMMARY>\s*" + re.escape(summary) + r"\s*</UNTRUSTED_SUMMARY>.*"
            r"<UNTRUSTED_HEADLINE>\s*" + re.escape(headline) + r"\s*</UNTRUSTED_HEADLINE>")


def mock_labels(vm):
    # Cases share summaries and headlines across labels, so each mock matches the exact pair.
    for case in ASSUMED_OVERCLAIMS:
        vm.mock_llm(pair_pattern(case), '{"outcome":"OVERCLAIMS"}')
    vm.mock_llm(r"(?s).*", '{"outcome":"WITHIN"}')


@pytest.fixture
def env(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    a, b, c = create_address("author"), create_address("challenger"), create_address("stranger")
    mock_labels(direct_vm)
    direct_vm.sender = a
    return direct_vm, contract, a, b, c


def pid_for(contract, author, case):
    return contract._piece_id(lo(author), norm(case[0]), norm(case[1]))


def pay(vm, who, value, fn, *args):
    vm.sender = who
    vm.value = value
    try:
        return fn(*args)
    finally:
        vm.value = 0


def publish(vm, contract, who, case, bond=BOND):
    pay(vm, who, bond, contract.publish, case[0], case[1])
    return pid_for(contract, who, case)


def challenge(vm, contract, who, pid, bond=BOND):
    pay(vm, who, bond, contract.challenge, pid)


def piece(contract, pid):
    return J(contract.get_piece(pid))


def credits(contract, who):
    return int(J(contract.get_credits(hx(who)))["credits"])


# ---------------------------------------------------------------------
# The consequence rule
# ---------------------------------------------------------------------

def test_tooth_same_summary_same_challenger_two_headlines(env):
    vm, contract, a, b, _ = env
    p1 = publish(vm, contract, a, O1)
    p2 = publish(vm, contract, a, W1)
    challenge(vm, contract, b, p1)
    assert (credits(contract, a), credits(contract, b)) == (0, 2 * BOND)
    challenge(vm, contract, b, p2)
    assert (credits(contract, a), credits(contract, b)) == (2 * BOND, 2 * BOND)
    one, two = piece(contract, p1), piece(contract, p2)
    assert (one["state"], one["outcome"], one["challenger"]) == ("RULED_OVERCLAIMS", "OVERCLAIMS", lo(b))
    assert (two["state"], two["outcome"], two["challenger"]) == ("RULED_WITHIN", "WITHIN", lo(b))
    assert one["summary"] == two["summary"]


def test_overclaims_credits_both_bonds_to_the_challenger(env):
    vm, contract, a, b, _ = env
    bond = 10 ** 15 + 7
    pid = publish(vm, contract, a, O2, bond)
    challenge(vm, contract, b, pid, bond)
    assert (credits(contract, a), credits(contract, b)) == (0, 2 * bond)
    row = piece(contract, pid)
    assert (row["state"], row["open_to_challenge"], row["held_wei"], row["bond_wei"]) == \
        ("RULED_OVERCLAIMS", False, "0", str(bond))


def test_within_credits_both_bonds_to_the_author(env):
    vm, contract, a, b, _ = env
    bond = 10 ** 18
    pid = publish(vm, contract, a, W2, bond)
    challenge(vm, contract, b, pid, bond)
    assert (credits(contract, a), credits(contract, b)) == (2 * bond, 0)
    assert piece(contract, pid)["state"] == "RULED_WITHIN"


def test_same_headline_two_summaries(env):
    vm, contract, a, b, _ = env
    p3 = publish(vm, contract, a, O4)
    p4 = publish(vm, contract, a, W4)
    challenge(vm, contract, b, p3)
    challenge(vm, contract, b, p4)
    assert (piece(contract, p3)["state"], piece(contract, p4)["state"]) == ("RULED_OVERCLAIMS", "RULED_WITHIN")
    assert (credits(contract, a), credits(contract, b)) == (2 * BOND, 2 * BOND)


def void_env(direct_vm, direct_deploy, response):
    contract = direct_deploy(CONTRACT)
    a, b = create_address("author"), create_address("challenger")
    direct_vm.mock_llm(r"(?s).*", response)
    pid = publish(direct_vm, contract, a, O1)
    challenge(direct_vm, contract, b, pid)
    return contract, a, b, pid


def test_void_refunds_each_side_and_closes_the_piece(direct_vm, direct_deploy):
    contract, a, b, pid = void_env(direct_vm, direct_deploy, "not json at all")
    row = piece(contract, pid)
    assert (row["state"], row["outcome"], row["challenger"]) == ("VOID", "VOID", lo(b))
    assert (credits(contract, a), credits(contract, b)) == (BOND, BOND)
    c = create_address("third")
    direct_vm.sender = c
    direct_vm.value = BOND
    with direct_vm.expect_revert(M_NOT_OPEN):
        contract.challenge(pid)
    direct_vm.value = 0
    direct_vm.sender = a
    with direct_vm.expect_revert(M_NOT_OPEN):
        contract.retire(pid)


def test_fail_safe_on_unknown_label(direct_vm, direct_deploy):
    contract, a, b, pid = void_env(direct_vm, direct_deploy, '{"outcome":"PARTLY"}')
    assert piece(contract, pid)["outcome"] == "VOID" and credits(contract, b) == BOND


def test_fail_safe_on_non_object_json(direct_vm, direct_deploy):
    contract, a, b, pid = void_env(direct_vm, direct_deploy, '["OVERCLAIMS"]')
    assert piece(contract, pid)["outcome"] == "VOID" and (credits(contract, a), credits(contract, b)) == (BOND, BOND)


def test_a_model_that_answers_void_is_treated_as_unusable(direct_vm, direct_deploy):
    contract, a, b, pid = void_env(direct_vm, direct_deploy, '{"outcome":"VOID"}')
    assert piece(contract, pid)["state"] == "VOID" and (credits(contract, a), credits(contract, b)) == (BOND, BOND)


def test_fenced_json_output_is_parsed(direct_vm, direct_deploy):
    contract, a, b, pid = void_env(direct_vm, direct_deploy, '```json\n{"outcome":"overclaims"}\n```')
    assert piece(contract, pid)["state"] == "RULED_OVERCLAIMS" and credits(contract, b) == 2 * BOND


def test_retire_returns_the_bond_and_ends_the_piece(env):
    vm, contract, a, b, _ = env
    pid = publish(vm, contract, a, O3)
    assert piece(contract, pid)["held_wei"] == str(BOND)
    vm.sender = a
    contract.retire(pid)
    row = piece(contract, pid)
    assert (row["state"], row["held_wei"], row["outcome"], row["challenger"]) == ("RETIRED", "0", "", "")
    assert credits(contract, a) == BOND
    with vm.expect_revert(M_NOT_OPEN):
        challenge(vm, contract, b, pid)


def test_a_piece_is_challenged_at_most_once(env):
    vm, contract, a, b, c = env
    pid = publish(vm, contract, a, W3)
    challenge(vm, contract, b, pid)
    for who in (b, c):
        with vm.expect_revert(M_NOT_OPEN):
            challenge(vm, contract, who, pid)
    vm.sender = a
    with vm.expect_revert(M_NOT_OPEN):
        contract.retire(pid)
    assert (credits(contract, a), credits(contract, b), credits(contract, c)) == (2 * BOND, 0, 0)


def test_challenge_bond_must_match_exactly(env):
    vm, contract, a, b, _ = env
    pid = publish(vm, contract, a, O5)
    for wrong in (0, BOND - 1, BOND + 1, 2 * BOND):
        with vm.expect_revert(M_EQUAL):
            challenge(vm, contract, b, pid, wrong)
    assert piece(contract, pid)["state"] == "OPEN"
    challenge(vm, contract, b, pid, BOND)
    assert piece(contract, pid)["state"] == "RULED_OVERCLAIMS"


def test_bond_is_checked_before_the_model(env):
    vm, contract, a, b, _ = env
    pid = publish(vm, contract, a, O1)
    before = len(vm._captured_validators)
    with vm.expect_revert(M_EQUAL):
        challenge(vm, contract, b, pid, BOND - 1)
    assert len(vm._captured_validators) == before          # no model call on a wrong bond
    challenge(vm, contract, b, pid)
    assert len(vm._captured_validators) == before + 1      # exactly one model call per challenge


def test_accounting_invariant_through_every_ending(direct_vm, direct_deploy):
    vm = direct_vm
    contract = direct_deploy(CONTRACT)
    a, b, c = create_address("author"), create_address("challenger"), create_address("third")
    vm.mock_llm(pair_pattern(O1), '{"outcome":"OVERCLAIMS"}')
    vm.mock_llm(pair_pattern(O2), "garbage")                    # -> VOID
    vm.mock_llm(r"(?s).*", '{"outcome":"WITHIN"}')
    wallets = (a, b, c)
    pids = []
    received = withdrawn = 0

    def check():
        held = sum(int(piece(contract, p)["held_wei"]) for p in pids)
        assert sum(credits(contract, w) for w in wallets) + held == received - withdrawn

    for case, bond in ((O1, BOND), (O2, 3 * 10 ** 15), (W1, 10 ** 15), (O3, 5 * 10 ** 15)):
        pids.append(publish(vm, contract, a, case, bond))
        received += bond
        check()
    challenge(vm, contract, b, pids[0], BOND)                   # OVERCLAIMS
    received += BOND
    check()
    challenge(vm, contract, c, pids[1], 3 * 10 ** 15)           # VOID
    received += 3 * 10 ** 15
    check()
    challenge(vm, contract, b, pids[2], 10 ** 15)               # WITHIN
    received += 10 ** 15
    check()
    vm.sender = a
    contract.retire(pids[3])
    check()
    for who in wallets:
        amount = credits(contract, who)
        vm.sender = who
        contract.withdraw()
        withdrawn += amount
        check()
    assert received == withdrawn
    assert all(credits(contract, w) == 0 for w in wallets)


# ---------------------------------------------------------------------
# The planned on-chain table, replayed in order from tests/runtime.json
# ---------------------------------------------------------------------

def test_runtime_table_in_order(env):
    vm, contract, a, b, _ = env

    def after(n, ctx):
        ids = ctx["ids"]
        if n in (1, 2):
            row = piece(contract, ids["P" + str(n)])
            assert (row["state"], row["bond_wei"], row["held_wei"]) == ("OPEN", str(BOND), str(BOND))
        if n == 3:
            assert piece(contract, ids["P1"])["state"] == "RULED_OVERCLAIMS"
            assert (credits(contract, a), credits(contract, b)) == (0, 4 * 10 ** 15)
        if n in (4, 5):
            assert piece(contract, ids["P2"])["state"] == "RULED_WITHIN"
            assert (credits(contract, a), credits(contract, b)) == (4 * 10 ** 15, 4 * 10 ** 15)
        if n in (6, 7, 8):
            assert piece(contract, ids["P3"])["state"] == "OPEN"
        if n == 9:
            assert piece(contract, ids["P3"])["state"] == "RULED_OVERCLAIMS"
            assert (credits(contract, a), credits(contract, b)) == (4 * 10 ** 15, 8 * 10 ** 15)
        if n == 10:
            assert piece(contract, ids["P4"])["state"] == "RULED_WITHIN"
            assert (credits(contract, a), credits(contract, b)) == (8 * 10 ** 15, 8 * 10 ** 15)
        if n == 11:
            assert piece(contract, ids["P5"])["state"] == "RETIRED"
            assert credits(contract, a) == 10 ** 16
        if n == 12:
            assert (credits(contract, a), credits(contract, b)) == (0, 0)

    ctx = replay(vm, contract, RUNTIME, {"A": a, "B": b}, after=after)
    assert set(ctx["ids"]) == {"P1", "P2", "P3", "P4", "P5"}
    assert len(RUNTIME["rows"]) <= 13
    assert sum(1 for r in RUNTIME["rows"] for x in calls_of(r) if x.get("kind") != "view") == 15
    last = RUNTIME["rows"][-1]
    row = J(last["_result"])
    assert last["kind"] == "view"
    assert (row["state"], row["challenger"], row["outcome"], row["held_wei"]) == \
        ("RULED_OVERCLAIMS", lo(b), "OVERCLAIMS", "0")


def test_runtime_id_recipe_matches_contract(env):
    _, contract, a, *_ = env
    seen = 0
    for row in RUNTIME["rows"]:
        for call in calls_of(row):
            if "save" in call:
                seen += 1
                h, s = call["args"]
                assert eval_payload(call["save"]["payload"], [h, s], lo(a), {"wallets": {}, "ids": {}}) == \
                    pid_for(contract, a, (h, s))
                spaced = [" " + h.replace(" ", "\t "), s.replace(" ", "  ") + "\n"]
                assert eval_payload(call["save"]["payload"], spaced, lo(a), {"wallets": {}, "ids": {}}) == \
                    pid_for(contract, a, (h, s))
    assert seen == 5


# ---------------------------------------------------------------------
# Who may call what
# ---------------------------------------------------------------------

def test_third_wallet_is_refused_by_every_write(env):
    vm, contract, a, b, c = env
    pid = publish(vm, contract, a, O1)
    done = publish(vm, contract, a, W1)
    challenge(vm, contract, b, done)
    vm.sender = c
    with vm.expect_revert(M_ONLY_AUTHOR):
        contract.retire(pid)
    with vm.expect_revert("Nothing to withdraw"):
        contract.withdraw()                                 # A's credits are not C's
    vm.sender = b
    with vm.expect_revert(M_ONLY_AUTHOR):
        contract.retire(pid)
    vm.sender = a
    with vm.expect_revert(M_AUTHOR):
        challenge(vm, contract, a, pid)
    assert piece(contract, pid)["state"] == "OPEN"
    assert (credits(contract, a), credits(contract, b), credits(contract, c)) == (2 * BOND, 0, 0)


def test_withdraw_pays_only_the_caller_and_zeroes_first(env):
    vm, contract, a, b, _ = env
    p1 = publish(vm, contract, a, O1)
    p2 = publish(vm, contract, a, W1)
    challenge(vm, contract, b, p1)
    challenge(vm, contract, b, p2)
    vm.sender = b
    contract.withdraw()
    assert (credits(contract, a), credits(contract, b)) == (2 * BOND, 0)
    with vm.expect_revert("Nothing to withdraw"):
        contract.withdraw()
    vm.sender = a
    contract.withdraw()
    assert credits(contract, a) == 0


# ---------------------------------------------------------------------
# Normalization and ids
# ---------------------------------------------------------------------

def test_whitespace_variants_share_one_piece_id(env):
    vm, contract, a, *_ = env
    pid = publish(vm, contract, a, O1)
    with vm.expect_revert("This piece already exists"):
        pay(vm, a, BOND, contract.publish, "  Compound slows\ttumour growth by a third ",
            "In mice,  the compound slowed\ntumour growth by a third.")
    with vm.expect_revert("This piece already exists"):
        pay(vm, a, 3 * BOND, contract.publish, O1[0], O1[1])      # the bond is not part of the id
    assert pid_for(contract, a, (" Compound  slows tumour growth by a third", O1[1] + "  ")) == pid


def test_headline_and_summary_are_separate_fields_in_the_id(env):
    vm, contract, a, *_ = env
    assert contract._piece_id(lo(a), "ab", "c") != contract._piece_id(lo(a), "a", "bc")
    p1 = publish(vm, contract, a, O2)
    p2 = publish(vm, contract, a, W2)                             # same headline, other summary
    assert p1 != p2


def test_same_piece_from_another_author_is_another_piece(env):
    vm, contract, a, b, _ = env
    p1 = publish(vm, contract, a, O1)
    p2 = publish(vm, contract, b, O1)
    assert p1 != p2 and piece(contract, p2)["author"] == lo(b)


def test_stored_texts_are_stripped_originals(env):
    vm, contract, a, *_ = env
    pay(vm, a, BOND, contract.publish, "  Compound slows  tumour growth by a third ", "\tIn mice,  the compound. ")
    pid = pid_for(contract, a, ("Compound slows tumour growth by a third", "In mice, the compound."))
    row = piece(contract, pid)
    assert (row["headline"], row["summary"]) == ("Compound slows  tumour growth by a third", "In mice,  the compound.")


def test_wallet_case_in_views(env):
    vm, contract, a, b, _ = env
    pid = publish(vm, contract, a, O1)
    challenge(vm, contract, b, pid)
    upper = "0x" + lo(b)[2:].upper()
    assert J(contract.get_credits(upper)) == {"wallet": lo(b), "credits": str(2 * BOND)}
    assert J(contract.get_credits(" " + upper + " "))["wallet"] == lo(b)
    assert piece(contract, pid)["author"] == lo(a) and piece(contract, pid)["challenger"] == lo(b)


# ---------------------------------------------------------------------
# Validator, fence, prompt
# ---------------------------------------------------------------------

def test_validator_rejects_disagreement_and_bad_shapes(env):
    vm, contract, a, b, _ = env
    pid = publish(vm, contract, a, W1)
    challenge(vm, contract, b, pid)                             # mocked WITHIN
    assert vm.run_validator() is True
    assert vm.run_validator(leader_result={"outcome": "OVERCLAIMS"}) is False
    assert vm.run_validator(leader_result={"outcome": "VOID"}) is False
    assert vm.run_validator(leader_result={"outcome": "MAYBE"}) is False
    assert vm.run_validator(leader_result="WITHIN") is False
    assert vm.run_validator(leader_error=Exception("boom")) is False


def test_validator_accepts_matching_overclaims(env):
    vm, contract, a, b, _ = env
    pid = publish(vm, contract, a, O1)
    challenge(vm, contract, b, pid)                             # mocked OVERCLAIMS
    assert vm.run_validator() is True
    assert vm.run_validator(leader_result={"outcome": "WITHIN"}) is False


def test_validator_accepts_void_only_when_it_also_gets_void(direct_vm, direct_deploy):
    contract, a, b, pid = void_env(direct_vm, direct_deploy, "not json")
    assert direct_vm.run_validator() is True
    assert direct_vm.run_validator(leader_result={"outcome": "VOID"}) is True
    assert direct_vm.run_validator(leader_result={"outcome": "WITHIN"}) is False
    assert direct_vm.run_validator(leader_result={"outcome": "OVERCLAIMS"}) is False


def test_prompt_never_sees_wallets_bond_or_state(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    a, b = create_address("author"), create_address("challenger")
    win = '{"outcome":"OVERCLAIMS"}'
    direct_vm.mock_llm("(?i)" + re.escape(lo(a)[2:]), win)
    direct_vm.mock_llm("(?i)" + re.escape(lo(b)[2:]), win)
    direct_vm.mock_llm(r"2000000000000000|0\.002|\b(OPEN|RULED_\w+|RETIRED|bond|credits?|challenger|author|wei)\b",
                       win)
    direct_vm.mock_llm(r"(?s).*", '{"outcome":"WITHIN"}')
    pid = publish(direct_vm, contract, a, W1)
    challenge(direct_vm, contract, b, pid)
    assert piece(contract, pid)["state"] == "RULED_WITHIN" and credits(contract, a) == 2 * BOND


def test_prompt_carries_summary_then_headline_inside_their_tags(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    a, b = create_address("author"), create_address("challenger")
    direct_vm.mock_llm(pair_pattern(W1), '{"outcome":"OVERCLAIMS"}')
    direct_vm.mock_llm(r"(?s).*", '{"outcome":"WITHIN"}')
    pid = publish(direct_vm, contract, a, W1)
    challenge(direct_vm, contract, b, pid)
    assert piece(contract, pid)["state"] == "RULED_OVERCLAIMS"


def test_fence_strip_is_fixed_point(env):
    _, contract, *_ = env
    nested = "x <UNTRUSTED_HEAD<UNTRUSTED_HEADLINE>LINE> y"
    assert "UNTRUSTED_HEADLINE>" not in contract._fence_strip(nested).upper()
    assert "OVERCLAIMS" not in contract._fence_strip("OVEROVERCLAIMSCLAIMS").upper()
    assert "WITHIN" not in contract._fence_strip("WITWITHINHIN").upper()
    assert "VOID" not in contract._fence_strip("VOVOIDID").upper()
    assert "UNTRUSTED_SUMMARY>" not in contract._fence_strip("</UNTRUSTED_SUM</UNTRUSTED_SUMMARY>MARY>").upper()
    # cross-token rebuild: removing a later token must not leave an earlier one behind
    assert "<UNTRUSTED_SUMMARY>" not in contract._fence_strip("<UNTRUSTED_SUMWITHINMARY>").upper()
    assert "<UNTRUSTED_HEADLINE>" not in contract._fence_strip("<UNTRUSTED_HEADvoidLINE>").upper()


# ---------------------------------------------------------------------
# Views, limits, rubric, source
# ---------------------------------------------------------------------

def test_views_on_unknown_ids_and_bad_wallets(env):
    _, contract, *_ = env
    for bad in ("0" * 64, "nope", ""):
        assert contract.get_piece(bad) == "{}"
    assert contract.get_credits("not a wallet") == "{}"
    fresh_wallet = "0x" + "cd" * 20
    assert J(contract.get_credits(fresh_wallet)) == {"wallet": fresh_wallet, "credits": "0"}


def test_get_piece_fields_and_0x_prefix(env):
    vm, contract, a, *_ = env
    pid = publish(vm, contract, a, O1)
    assert piece(contract, "0x" + pid)["piece_id"] == pid
    assert piece(contract, pid.upper())["piece_id"] == pid
    assert piece(contract, pid) == {
        "piece_id": pid, "author": lo(a), "headline": O1[0], "summary": O1[1], "bond_wei": str(BOND),
        "state": "OPEN", "challenger": "", "outcome": "", "open_to_challenge": True, "held_wei": str(BOND)}


def test_limits_and_rubric(env):
    _, contract, *_ = env
    lim = J(contract.get_limits())
    assert lim["fail_safe_outcome"] == "VOID" and lim["model_calls"] == ["challenge"]
    assert lim["semantic_outcomes"] == ["OVERCLAIMS", "WITHIN"]
    assert lim["states"] == ["OPEN", "RULED_OVERCLAIMS", "RULED_WITHIN", "VOID", "RETIRED"]
    assert (lim["max_headline_length"], lim["max_summary_length"]) == (90, 240)
    assert (lim["min_bond_wei"], lim["max_bond_wei"]) == (str(10 ** 15), str(10 ** 18))
    assert lim["money_used"] is True and lim["clock_used"] is False and lim["preview_endpoint_exposed"] is False
    assert lim["external_web_used"] is False and lim["global_admin"] is False
    assert contract.get_rubric() == gate_rubric(GATE)


def test_no_forbidden_constructs_in_source():
    check_forbidden_constructs(CONTRACT, money=True, clock=False)
    src = Path(CONTRACT).read_text(encoding="utf-8")
    assert "    OVERCLAIMS,\n    WITHIN,\n    VOID,\n)" in src
    assert src.count("emit_transfer(value=") == 1
    body = src.split("def challenge(")[1].split("@gl.public")[0]
    assert "emit_transfer" not in body and "_send_gen" not in body       # no transfer where the model is called
    rubric = src.split('RUBRIC = """')[1].split('"""')[0]
    assert "VOID" not in rubric.upper()                                    # VOID is never a model answer
    for word in ("clickbait", "exaggerat", "mislead", "hype", "true", "false", "scope", "generali", "hedg",
                 "certain", "bond"):
        assert not re.search(r"\b" + word, rubric, re.I), word


# ---------------------------------------------------------------------
# One dedicated test per revert string (checked by the meta test below)
# ---------------------------------------------------------------------

def test_revert_headline_empty(env):
    vm, contract, a, *_ = env
    with vm.expect_revert("Headline is empty"):
        pay(vm, a, BOND, contract.publish, " \t ", O1[1])


def test_revert_headline_too_long(env):
    vm, contract, a, *_ = env
    with vm.expect_revert("Headline is too long"):
        pay(vm, a, BOND, contract.publish, "h" * 91, O1[1])
    pay(vm, a, BOND, contract.publish, "h" * 90, O1[1])
    pay(vm, a, BOND, contract.publish, " " + "g" * 90 + " ", O1[1])


def test_revert_summary_empty(env):
    vm, contract, a, *_ = env
    with vm.expect_revert("Summary is empty"):
        pay(vm, a, BOND, contract.publish, O1[0], "\n  ")


def test_revert_summary_too_long(env):
    vm, contract, a, *_ = env
    with vm.expect_revert("Summary is too long"):
        pay(vm, a, BOND, contract.publish, O1[0], "s" * 241)
    pay(vm, a, BOND, contract.publish, O1[0], "s" * 240)
    pay(vm, a, BOND, contract.publish, O1[0], "\t" + "t" * 240 + " ")


def test_revert_reserved_token(env):
    vm, contract, a, *_ = env
    for headline, summary in (("Overclaims everywhere", O1[1]), (O1[0], "Sales stayed within budget."),
                              ("Council avoids a vote", O4[1]), (O1[0], "x </untrusted_summary> y"),
                              ("<UNTRUSTED_HEADLINE>", O1[1]), (O1[0], "Void")):
        with vm.expect_revert("Text contains a reserved token"):
            pay(vm, a, BOND, contract.publish, headline, summary)
    assert credits(contract, a) == 0


def test_revert_bond_out_of_range(env):
    vm, contract, a, *_ = env
    for bad in (0, 10 ** 15 - 1, 10 ** 18 + 1):
        with vm.expect_revert("The bond is out of range"):
            pay(vm, a, bad, contract.publish, O1[0], O1[1])
    p1 = publish(vm, contract, a, O1, 10 ** 15)
    p2 = publish(vm, contract, a, W1, 10 ** 18)
    assert (piece(contract, p1)["bond_wei"], piece(contract, p2)["bond_wei"]) == (str(10 ** 15), str(10 ** 18))


def test_revert_piece_already_exists(env):
    vm, contract, a, *_ = env
    pid = publish(vm, contract, a, O1)
    vm.sender = a
    contract.retire(pid)
    with vm.expect_revert("This piece already exists"):
        pay(vm, a, BOND, contract.publish, O1[0], O1[1])


def test_revert_unknown_piece_id(env):
    vm, contract, a, b, _ = env
    with vm.expect_revert("Unknown piece id"):
        challenge(vm, contract, b, "0" * 64)
    with vm.expect_revert("Unknown piece id"):
        challenge(vm, contract, b, "not-an-id")
    vm.sender = a
    with vm.expect_revert("Unknown piece id"):
        contract.retire("ab" * 32)


def test_revert_piece_no_longer_open(env):
    vm, contract, a, b, _ = env
    pid = publish(vm, contract, a, O1)
    challenge(vm, contract, b, pid)
    with vm.expect_revert(M_NOT_OPEN):
        challenge(vm, contract, b, pid)
    vm.sender = a
    with vm.expect_revert(M_NOT_OPEN):
        contract.retire(pid)


def test_revert_author_cannot_challenge(env):
    vm, contract, a, *_ = env
    pid = publish(vm, contract, a, O4)
    with vm.expect_revert(M_AUTHOR):
        challenge(vm, contract, a, pid, 0)
    with vm.expect_revert(M_AUTHOR):
        challenge(vm, contract, a, pid, BOND)


def test_revert_challenge_bond_must_equal(env):
    vm, contract, a, b, _ = env
    pid = publish(vm, contract, a, O4)
    with vm.expect_revert(M_EQUAL):
        challenge(vm, contract, b, pid, 10 ** 15)


def test_revert_only_author_retires(env):
    vm, contract, a, b, _ = env
    pid = publish(vm, contract, a, O1)
    vm.sender = b
    with vm.expect_revert(M_ONLY_AUTHOR):
        contract.retire(pid)


def test_revert_nothing_to_withdraw(env):
    vm, contract, a, b, _ = env
    vm.sender = a
    with vm.expect_revert("Nothing to withdraw"):
        contract.withdraw()
    publish(vm, contract, a, O1)                                # a held bond is not a credit
    vm.sender = a
    with vm.expect_revert("Nothing to withdraw"):
        contract.withdraw()


# ---------------------------------------------------------------------
# Check order (the prompt fixes it; a frontend mirrors it)
# ---------------------------------------------------------------------

def test_check_order_publish(env):
    vm, contract, a, *_ = env
    with vm.expect_revert("Headline is empty"):
        pay(vm, a, 0, contract.publish, "", "s" * 300)              # headline before summary
    with vm.expect_revert("Headline is too long"):
        pay(vm, a, 0, contract.publish, "WITHIN " + "h" * 90, "")
    with vm.expect_revert("Summary is too long"):
        pay(vm, a, 0, contract.publish, "VOID", "s" * 241)         # summary before reserved
    with vm.expect_revert("Text contains a reserved token"):
        pay(vm, a, 0, contract.publish, O1[0], "OVERCLAIMS")        # reserved before bond
    publish(vm, contract, a, O1)
    with vm.expect_revert("The bond is out of range"):
        pay(vm, a, 0, contract.publish, O1[0], O1[1])               # bond before duplicate


def test_check_order_challenge(env):
    vm, contract, a, b, c = env
    pid = publish(vm, contract, a, O1)
    with vm.expect_revert(M_AUTHOR):
        challenge(vm, contract, a, pid, 1)                          # caller before value
    challenge(vm, contract, b, pid)
    with vm.expect_revert(M_NOT_OPEN):
        challenge(vm, contract, a, pid, 1)                          # state before caller
    with vm.expect_revert(M_NOT_OPEN):
        challenge(vm, contract, c, pid, 1)                          # state before value


def test_check_order_retire_state_before_caller(env):
    vm, contract, a, b, c = env
    pid = publish(vm, contract, a, O1)
    challenge(vm, contract, b, pid)
    vm.sender = c
    with vm.expect_revert(M_NOT_OPEN):
        contract.retire(pid)


# ---------------------------------------------------------------------
# Meta: every revert string in the source has exactly one dedicated test
# ---------------------------------------------------------------------

def test_every_revert_string_has_exactly_one_dedicated_test():
    check_revert_coverage(CONTRACT, __file__, globals(), expected_count=13)

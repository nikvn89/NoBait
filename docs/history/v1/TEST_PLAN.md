# TEST_PLAN

## Cases (each pair shares its surface and carries opposite labels)

| Case | Summary ‖ Headline | Expected |
|---|---|---|
| O1 | In mice, the compound slowed tumour growth by a third. ‖ Compound slows tumour growth by a third | OVERCLAIMS |
| O2 | Sales rose in two of the five regions last quarter. ‖ Sales rose last quarter | OVERCLAIMS |
| O3 | Some users reported the battery lasted longer after the update. ‖ Update makes the battery last longer | OVERCLAIMS |
| O4 | The council discussed closing the library on Sundays. ‖ Council closes the library on Sundays | OVERCLAIMS |
| O5 | The trial found the drug may reduce migraines for some adults. ‖ Drug cures migraines in adults | OVERCLAIMS |
| W1 | In mice, the compound slowed tumour growth by a third. ‖ Compound slows tumour growth in mice | WITHIN |
| W2 | Sales rose in all five regions last quarter. ‖ Sales rose last quarter | WITHIN |
| W3 | Every phone in the test kept its charge longer after the update. ‖ Update makes the battery last longer | WITHIN |
| W4 | The council voted to close the library on Sundays. ‖ Council closes the library on Sundays | WITHIN |
| W5 | The trial found the drug reduced migraines for most adults. ‖ Drug reduces migraines for most adults | WITHIN |

- **Kill tests:** O1/W1 (same summary, two headlines), O4/W4 (same headline, two summaries), O2/W2, O3/W3 — the rubric
  does not hint at the mechanism.
- **Definition check:** O5/W5.
- `HEADLINEBOUND_KILLSET_CHECK.py` proves no word or word pair separates the classes, and that the rubric shares no
  content word with any case.

## Deterministic behaviour → test (`tests/contract/test_headlinebound.py`, Direct Mode, model mocked)

| Behaviour | Test |
|---|---|
| The tooth: one summary, one challenger, two headlines, opposite payouts | `test_tooth_same_summary_same_challenger_two_headlines` |
| One headline over two summaries | `test_same_headline_two_summaries` |
| OVERCLAIMS → both bonds to the challenger | `test_overclaims_credits_both_bonds_to_the_challenger` |
| WITHIN → both bonds to the author | `test_within_credits_both_bonds_to_the_author` |
| VOID → each side refunded, piece closed | `test_void_refunds_each_side_and_closes_the_piece` |
| Fail-safe on unknown label, non-object JSON, a model that answers VOID | `test_fail_safe_on_unknown_label`, `test_fail_safe_on_non_object_json`, `test_a_model_that_answers_void_is_treated_as_unusable` |
| Retire returns the bond | `test_retire_returns_the_bond_and_ends_the_piece` |
| One challenge per piece | `test_a_piece_is_challenged_at_most_once` |
| Exact bond, checked before the model | `test_challenge_bond_must_match_exactly`, `test_bond_is_checked_before_the_model` |
| Accounting invariant through every ending | `test_accounting_invariant_through_every_ending` |
| Withdraw pays only the caller and zeroes first | `test_withdraw_pays_only_the_caller_and_zeroes_first` |
| Validator function | `test_validator_rejects_disagreement_and_bad_shapes`, `test_validator_accepts_matching_overclaims`, `test_validator_accepts_void_only_when_it_also_gets_void` |
| Prompt never sees wallet, bond or state; fence is a fixed point | `test_prompt_never_sees_wallets_bond_or_state`, `test_fence_strip_is_fixed_point` |
| Ids: whitespace variants, separate fields, per author | `test_whitespace_variants_share_one_piece_id`, `test_headline_and_summary_are_separate_fields_in_the_id`, `test_same_piece_from_another_author_is_another_piece` |
| Every revert string has a dedicated test; check order | `test_every_revert_string_has_exactly_one_dedicated_test`, `test_check_order_publish`, `test_check_order_challenge`, `test_check_order_retire_state_before_caller` |
| The planned on-chain table, replayed in order | `test_runtime_table_in_order` |
| Piece ids shared with the frontend | `test_vectors_match_contract` |

Frontend (`tests/js/*.test.ts`): Python-string parity, piece ids against the contract vectors, GEN/wei with bigint,
view parsing, every revert sentence equal to the source and fired in the source's order, the payout table as written
in the source, postconditions for every write, receipt classification, calldata sizes, source hash, repository rules.

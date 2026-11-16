"""Shim tests: logic only; never evidence of live network consensus."""
import importlib.util
import json
import sys
import types
import unittest
from copy import deepcopy
from pathlib import Path

class UserError(Exception): pass
class Address:
    def __init__(self,addr):self.as_hex=addr
class TreeMap(dict):
    @classmethod
    def __class_getitem__(cls,_):return cls
identity=lambda fn:fn
gl=types.SimpleNamespace(Contract=object,public=types.SimpleNamespace(write=identity,view=identity),
    vm=types.SimpleNamespace(UserError=UserError),message=types.SimpleNamespace(sender_address=Address('0x'+'a'*40)),
    nondet=types.SimpleNamespace(),eq_principle=types.SimpleNamespace())
sys.modules['genlayer']=types.SimpleNamespace(gl=gl,Address=Address,TreeMap=TreeMap,u256=int)
spec=importlib.util.spec_from_file_location('liftwatch',Path(__file__).resolve().parents[1]/'contracts/liftwatch_v11.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
OWNER='0x'+'a'*40
ANALYST='0x'+'b'*40
OUTSIDER='0x'+'c'*40
NOTES=('Experiment assignment used a persistent user-ID hash with a frozen 50/50 split. '
       'All eligible visitors were counted once during the same two-week window; '
       'the primary event was completed checkout. Errors were tracked consistently '
       'in both arms and no eligibility rule was changed after preregistration.')

class LiftwatchTests(unittest.TestCase):
    def setUp(self):
        self.g=m.LiftWatch();self.g.trials=TreeMap()
        self.sign(OWNER)
        self.trial=self.g.preregister('Checkout A/B protection',
            'A more legible checkout step should increase completed checkout conversion from eligible sessions.',
            'Primary endpoint: unique completed checkouts per eligible unique visitor, measured in the same attribution window.',
            'New and returning visitors randomly assigned by persistent stable user ID during the frozen fortnight.',
            'Stable user-ID hashing into mutually exclusive 50/50 groups before first checkout exposure; no manual reassignment or crossover.',
            ANALYST,500,150,100)
        self.correct()
        gl.eq_principle.prompt_comparative=lambda fn,principle:fn()
        def reply(prompt,response_format=None):
            self.assertEqual(response_format,'json')
            self.assertIn('FROZEN_EVIDENCE=',prompt)
            return deepcopy(self.answer)
        gl.nondet.exec_prompt=reply
    def sign(self,account):gl.message.sender_address=Address(account)
    def correct(self,result='PASS'):
        self.answer={'checks':[
            {'criterion':criterion,'result':result,'reason':'The frozen signed notes are compared to this preregistered trial requirement.',
             } for criterion in ['pre_registration','randomization','measurement']]}
    def report(self,c=2500,cc=300,t=2500,tc=400,ce=22,te=24,notes=NOTES):
        self.sign(ANALYST)
        return self.g.submit_results(self.trial,c,cc,t,tc,ce,te,notes,m.digest(notes))
    def trial_state(self):return json.loads(self.g.get_trial(self.trial))

    def test_preregister_submit_assess_authorize_full_flow(self):
        self.assertEqual(self.report(),'EVIDENCE_LOCKED')
        self.assertEqual(self.g.assess_trial(self.trial),'ELIGIBLE')
        self.sign(OWNER)
        self.assertEqual(self.g.authorize_rollout(self.trial),'AUTHORIZED')
        d=self.trial_state()
        self.assertEqual(d['authorization']['scope'],'NON_EXECUTING_RELEASE_DECISION')
        self.assertEqual(d['authorization']['plan_sha256'],d['plan_sha256'])
        self.assertEqual(d['authorization']['report_sha256'],d['report_sha256'])
    def test_deterministic_math(self):
        self.report();mtr=self.trial_state()['metrics']
        self.assertEqual((mtr['control_bps'],mtr['treatment_bps'],mtr['absolute_lift_bps']),(1200,1600,400))
        self.assertTrue(mtr['approx_95pct_z_test_pass'])
        self.assertTrue(mtr['error_guardrail_pass'])
        self.assertTrue(mtr['deterministic_gate'])
    def test_small_sample_no_approval_even_if_ai_pass(self):
        self.report(c=250,cc=30,t=250,tc=60)
        self.assertEqual(self.g.assess_trial(self.trial),'HOLD')
        self.assertFalse(self.trial_state()['metrics']['sample_floor_pass'])
    def test_negative_lift_is_hold(self):
        self.report(cc=450,tc=250)
        self.assertEqual(self.g.assess_trial(self.trial),'HOLD')
        self.assertFalse(self.trial_state()['metrics']['uplift_floor_pass'])
    def test_guardrail_failure_is_hold(self):
        self.report(ce=12,te=210)
        self.assertEqual(self.g.assess_trial(self.trial),'HOLD')
        self.assertFalse(self.trial_state()['metrics']['error_guardrail_pass'])
    def test_normal_approximation_rejects_rare_events(self):
        self.report(cc=1,tc=4)
        self.assertFalse(self.trial_state()['metrics']['normal_approx_valid'])
        self.assertEqual(self.g.assess_trial(self.trial),'HOLD')
    def test_math_not_significant_is_hold(self):
        self.report(cc=300,tc=315)
        self.assertEqual(self.g.assess_trial(self.trial),'HOLD')
        self.assertFalse(self.trial_state()['metrics']['approx_95pct_z_test_pass'])
    def test_review_does_not_authorize(self):
        self.report();self.answer['checks'][0]['result']='REVIEW'
        self.assertEqual(self.g.assess_trial(self.trial),'REVIEW')
        self.sign(OWNER)
        with self.assertRaisesRegex(UserError,'all gates'):self.g.authorize_rollout(self.trial)
    def test_ai_fail_is_hold_even_if_math_good(self):
        self.report();self.answer['checks'][1]['result']='FAIL'
        self.assertEqual(self.g.assess_trial(self.trial),'HOLD')
    def test_contract_attaches_exact_citations_without_model_ref_ids(self):
        self.report()
        self.assertEqual(self.g.assess_trial(self.trial), 'ELIGIBLE')
        t = self.trial_state()
        self.assertEqual(len(t['assessment']['checks']), 3)
        bank = m.reference_bank(t['plan'], t['report'], t['metrics'])
        for check in t['assessment']['checks']:
            self.assertGreaterEqual(len(check['references']), 2)
            for ref in check['references']:
                self.assertEqual(ref['field'], bank[ref['ref_id']]['field'])
                self.assertEqual(ref['quote'], bank[ref['ref_id']]['quote'])
        self.assertFalse(t['assessment']['format_fallback'])

    def test_invalid_category_fails_closed(self):
        self.report()
        self.answer['checks'][0]['criterion']='INVENTED_CRITERION'
        self.assertEqual(self.g.assess_trial(self.trial), 'REVIEW')
        t=self.trial_state()
        self.assertEqual(t['assessment']['checks'],[])
        self.assertTrue(t['assessment']['format_fallback'])

    def test_duplicate_criterion_fails_closed(self):
        self.report()
        self.answer['checks'][1]['criterion']='pre_registration'
        self.assertEqual(self.g.assess_trial(self.trial), 'REVIEW')

    def test_untrusted_external_ref_ids_cannot_create_forged_citations(self):
        self.report()
        self.answer['checks'][0]['ref_ids']=['FAKE:99','note:missing']
        self.assertEqual(self.g.assess_trial(self.trial),'ELIGIBLE')
        t=self.trial_state()
        actual=t['assessment']['checks'][0]['references']
        self.assertTrue(all(ref['ref_id'] in ('notes:1','notes:2','hypothesis:1') for ref in actual))
        self.assertNotIn('FAKE:99',[r['ref_id'] for r in actual])

    def test_model_supplied_quote_is_not_used(self):
        self.report()
        self.answer['checks'][0]['references']=[{'ref_id':'hypothesis:1','quote':'FABRICATED','field':'hypothesis'}]
        self.assertEqual(self.g.assess_trial(self.trial),'ELIGIBLE')
        a=self.trial_state()['assessment']['checks'][0]['references']
        self.assertTrue(all(r['quote']!='FABRICATED' for r in a))

    def test_only_analyst_can_submit(self):
        self.sign(OUTSIDER)
        with self.assertRaisesRegex(UserError,'assigned analyst'):self.g.submit_results(self.trial,2500,300,2500,400,22,24,NOTES,m.digest(NOTES))
    def test_only_analyst_can_assess(self):
        self.report();self.sign(OUTSIDER)
        with self.assertRaisesRegex(UserError,'assigned analyst'):self.g.assess_trial(self.trial)
    def test_only_owner_can_authorize(self):
        self.report();self.g.assess_trial(self.trial);self.sign(ANALYST)
        with self.assertRaisesRegex(UserError,'trial owner'):self.g.authorize_rollout(self.trial)
    def test_cannot_self_analyze(self):
        self.sign(OWNER)
        with self.assertRaisesRegex(UserError,'independent analyst'):self.g.preregister(
            'Another title','A hypothesis longer than thirty five characters is required.',
            'One metric definition longer than thirty five characters is expected.',
            'An experimental population specified here.',
            'Assignment is deterministic by unique visitor IDs before exposure.',OWNER,500,150,100)
    def test_refuse_hash_mismatch(self):
        self.sign(ANALYST)
        with self.assertRaisesRegex(UserError,'hash mismatch'):self.g.submit_results(self.trial,2500,300,2500,400,22,24,NOTES,'0'*64)
    def test_negative_counts_and_overflow_rejected(self):
        self.sign(ANALYST)
        with self.assertRaisesRegex(UserError,'success outside'):self.g.submit_results(self.trial,2500,3000,2500,400,22,24,NOTES,m.digest(NOTES))
        with self.assertRaisesRegex(UserError,'errors outside'):self.g.submit_results(self.trial,2500,300,2500,400,-1,24,NOTES,m.digest(NOTES))
    def test_repeated_report_or_assess_blocked(self):
        self.report()
        with self.assertRaisesRegex(UserError,'already been reported'):self.report()
        self.sign(ANALYST);self.g.assess_trial(self.trial)
        with self.assertRaisesRegex(UserError,'unassessed'):self.g.assess_trial(self.trial)
    def test_close_review_after_assessment(self):
        self.report();self.answer['checks'][0]['result']='REVIEW';self.g.assess_trial(self.trial)
        self.sign(OWNER)
        self.assertEqual(self.g.close_trial(self.trial,'Insufficient evidence for randomization review.'),'CLOSED')
        with self.assertRaises(UserError):self.g.authorize_rollout(self.trial)
    def test_math_prevents_llm_override(self):
        self.report(c=250,cc=30,t=250,tc=60)
        self.assertEqual(self.g.assess_trial(self.trial),'HOLD')
        self.assertEqual(self.trial_state()['assessment']['verdict'],'PASS')
    def test_report_snapshot_has_immutable_commitment(self):
        self.report();trial=self.trial_state()
        self.assertEqual(trial['report_sha256'],m.digest(m.canonical(trial['report'])))
        trial['report']['treatment_success']=999
        self.g.trials[self.trial]=m.canonical(trial)
        with self.assertRaisesRegex(UserError,'hashes changed'):self.g.assess_trial(self.trial)
    def test_unknown_trial_and_policy(self):
        with self.assertRaisesRegex(UserError,'unknown trial'):self.g.get_trial(99)
        st=json.loads(self.g.stats())
        self.assertEqual(st['version'],'1.1.0')
        self.assertEqual(st['rollout'],'NON_EXECUTING_AUTHORIZATION')


    def test_v11_format_only_retry_to_eligible(self):
        self.report()
        self.answer={'checks':[]}
        self.assertEqual(self.g.assess_trial(self.trial),'REVIEW')
        t=self.trial_state()
        self.assertTrue(t['assessment']['format_fallback'])
        self.assertEqual(t['assessment_runs'],1)
        self.correct()
        self.assertEqual(self.g.retry_format_review(self.trial),'ELIGIBLE')
        t=self.trial_state()
        self.assertEqual(t['assessment_runs'],2)
        self.assertEqual([x['verdict'] for x in t['assessment_history']], ['REVIEW','PASS'])
        self.assertEqual([x['format_fallback'] for x in t['assessment_history']], [True,False])
        self.sign(OWNER)
        self.assertEqual(self.g.authorize_rollout(self.trial),'AUTHORIZED')

    def test_v11_no_retry_after_substantive_review(self):
        self.report()
        self.answer['checks'][0]['result']='REVIEW'
        self.assertEqual(self.g.assess_trial(self.trial),'REVIEW')
        self.assertFalse(self.trial_state()['assessment']['format_fallback'])
        with self.assertRaisesRegex(UserError,'technical format REVIEW'):
            self.g.retry_format_review(self.trial)

    def test_v11_format_retry_limit_at_three(self):
        self.report()
        self.answer={'checks':[]}
        self.assertEqual(self.g.assess_trial(self.trial),'REVIEW')
        self.assertEqual(self.g.retry_format_review(self.trial),'REVIEW')
        self.assertEqual(self.g.retry_format_review(self.trial),'REVIEW')
        t=self.trial_state()
        self.assertEqual(t['assessment_runs'],3)
        self.assertEqual(len(t['assessment_history']),3)
        with self.assertRaisesRegex(UserError,'retry limit'):self.g.retry_format_review(self.trial)

    def test_v11_wrong_signer_cannot_retry(self):
        self.report()
        self.answer={'checks':[]}
        self.g.assess_trial(self.trial)
        self.sign(OWNER)
        with self.assertRaisesRegex(UserError,'assigned analyst'):self.g.retry_format_review(self.trial)

    def test_v11_hash_tampering_blocks_retry(self):
        self.report()
        self.answer={'checks':[]}
        self.g.assess_trial(self.trial)
        d=self.trial_state()
        d['report']['treatment_success']=1234
        self.g.trials[self.trial]=m.canonical(d)
        with self.assertRaisesRegex(UserError,'hashes changed'):self.g.retry_format_review(self.trial)

    def test_v11_invalid_json_format_records_history(self):
        self.report()
        gl.nondet.exec_prompt=lambda prompt,response_format=None: 'definitely not JSON'
        self.assertEqual(self.g.assess_trial(self.trial),'REVIEW')
        t=self.trial_state()
        self.assertEqual(t['assessment_runs'],1)
        self.assertTrue(t['assessment_history'][0]['format_fallback'])
        self.assertEqual(t['assessment']['checks'],[])
        self.assertEqual(t['assessment']['reason'],m.FORMAT_REASON)

    def test_v11_no_retry_on_hold_due_to_math(self):
        self.report(cc=300,tc=315)
        self.answer={'checks':[]}
        self.assertEqual(self.g.assess_trial(self.trial),'HOLD')
        with self.assertRaisesRegex(UserError,'technical format REVIEW'):
            self.g.retry_format_review(self.trial)

    def test_v11_partial_model_response_fails_closed(self):
        self.report()
        self.answer['checks'].pop()
        self.assertEqual(self.g.assess_trial(self.trial),'REVIEW')
        self.assertTrue(self.trial_state()['assessment']['format_fallback'])

    def test_v11_duplicate_assessment_after_eligible_blocked(self):
        self.report()
        self.g.assess_trial(self.trial)
        with self.assertRaisesRegex(UserError,'technical format REVIEW'):
            self.g.retry_format_review(self.trial)

    def test_v11_history_digest_is_bound_to_assessment(self):
        self.report()
        self.assertEqual(self.g.assess_trial(self.trial),'ELIGIBLE')
        t=self.trial_state()
        self.assertEqual(t['assessment_runs'],1)
        self.assertEqual(t['assessment_history'][0]['assessment_sha256'],
            m.digest(m.canonical(t['assessment'])))

    def test_v11_verified_policy(self):
        st=json.loads(self.g.stats())
        self.assertEqual(st['version'],'1.1.0')
        self.assertEqual(st['max_assessment_runs'],3)
        self.assertEqual(st['retry_policy'],'FORMAT_REVIEW_ONLY')
        self.assertEqual(st['citation_mode'],'CONTRACT_ASSIGNED_LITERAL_REFERENCES')


if __name__=='__main__': unittest.main()

"""Directed regression mutations. Only collected assertion failures count as kills."""
import json, os, subprocess, sys, tempfile, xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'contracts/HeadlineBound.py'
MUTATIONS=[
 ('source_validator_blind', 'fetch_source() == leader_result.calldata','True'),
 ('source_hash_constant', 'digest = Keccak256(text.encode("utf-8")).hexdigest()', 'digest = "0" * 64'),
 ('only_selected_context', 'for i, text in enumerate(passages)],','for i, text in enumerate(passages[:1])],'),
 ('missing_basis_is_conclusive', 'if len(indices) < 1 or len(indices) > 3:', 'if len(indices) > 3:'),
 ('unclear_favors_author', 'if outcome == "UNCLEAR" and indices == []:\n                return void','if outcome == "UNCLEAR" and indices == []:\n                return {"outcome": "WITHIN", "passages": [0]}'),
 ('validator_label_only', 'return evaluate_once() == data','return evaluate_once()["outcome"] == data["outcome"]'),
 ('overclaim_wrong_payee','self._credit(caller, 2 * bond)','self._credit(str(p.author).lower(), 2 * bond)'),
 ('within_wrong_amount','self._credit(str(p.author).lower(), 2 * bond)','self._credit(str(p.author).lower(), bond)'),
 ('void_does_not_refund_challenger','self._credit(caller, bond)','self._credit(caller, 0)'),
 ('withdraw_replay','self.credits[caller] = u256(0)','self.credits[caller] = u256(amount)'),
 ('wrong_selected_quote','p.challenged_passage = i32(passage_index)','p.challenged_passage = i32(0)'),
 ('missing_http_gate','if response.status != 200:','if False:'),
]

def run(path,xml):
 env={**os.environ,'NOBAIT_CONTRACT':str(path)}
 p=subprocess.run([sys.executable,'-m','pytest','tests/contract/test_source_backed.py','-q','-p','no:cacheprovider',f'--junitxml={xml}','--tb=no'],cwd=ROOT,env=env,capture_output=True,text=True)
 if not xml.exists():return p.returncode,0,1,0
 tree=ET.parse(xml);suites=list(tree.getroot().iter('testsuite'))
 return p.returncode,sum(int(s.get('failures',0)) for s in suites),sum(int(s.get('errors',0)) for s in suites),sum(int(s.get('tests',0)) for s in suites)

with tempfile.TemporaryDirectory(prefix='nobait-mutations-') as d:
 tmp=Path(d);rc,fail,errors,tests=run(SOURCE,tmp/'baseline.xml')
 if rc or fail or errors or tests<60:raise SystemExit('Baseline failed or missing tests; no mutation claims')
 original=SOURCE.read_text();rows=[]
 for name,old,new in MUTATIONS:
  if original.count(old)!=1:raise SystemExit(f'Ambiguous mutation anchor: {name}')
  path=tmp/'HeadlineBound.py';path.write_text(original.replace(old,new,1))
  rc,fail,errors,count=run(path,tmp/(name+'.xml'))
  killed=rc==1 and fail>0 and errors==0 and count==tests
  rows.append({'mutation':name,'killed':killed,'collected':count,'failures':fail,'errors':errors});print(name, 'KILLED' if killed else 'NOT VERIFIED',flush=True)
 result={'baseline_cases':tests,'killed':sum(r['killed'] for r in rows),'total':len(rows),'results':rows}
 target=ROOT/'tests/evidence/mutations.json';target.parent.mkdir(exist_ok=True);target.write_text(json.dumps(result,indent=2)+'\n')
 if not all(r['killed'] for r in rows):raise SystemExit(1)

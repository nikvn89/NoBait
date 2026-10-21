import json
import re
import sys
import os
from pathlib import Path
import pytest
from gltest.direct.loader import create_address

ROOT = Path(__file__).resolve().parents[2]
URL = 'https://example.org/research'
SOURCE = ('Research bulletin: a mouse study\n'
          'In a study of 40 mice, compound X reduced tumour growth by one third.\n'
          'The researchers have not conducted trials in humans. Human efficacy is unknown.')
BOND = 10**15

def hx(a):
    return (a.as_hex if hasattr(a, 'as_hex') else str(a)).lower()

class World:
    def __init__(self, vm, c, module):
        self.vm,self.c,self.module=vm,c,module
        self.a,self.b,self.other=[create_address(n) for n in ['author','challenger','other']]
        self.sent=[];self.funded=0;self.prompts=[]
        self.original_prompt=module.gl.nondet.exec_prompt
        def record(prompt,*args,**kwargs):
            self.prompts.append(prompt)
            return self.original_prompt(prompt,*args,**kwargs)
        module.gl.nondet.exec_prompt=record
        world=self
        class Recipient:
            def __init__(self,a):self.address=a
            def emit_transfer(self,value):world.sent.append((hx(self.address),int(value)))
        self.original_recipient=module._NativeRecipient
        module._NativeRecipient=Recipient
        self.mocks()

    def mocks(self,source=SOURCE,label='OVERCLAIMS',basis=None,status=200,url=URL,raw=None):
        self.vm.clear_mocks()
        self.vm.mock_web(re.escape(url),{'status':status,'body':source})
        self.vm.mock_llm(r'(?s).*',json.dumps({'outcome':label,'passages':([] if label=='UNCLEAR' else [1]) if basis is None else basis}) if raw is None else raw)

    def call(self,who,name,*args,value=0):
        self.vm.sender=who;self.vm.value=value
        try:
            result=getattr(self.c,name)(*args)
            self.funded+=value
            return result
        finally:self.vm.value=0

    def publish(self,headline='Compound X cures cancer in humans',url=URL,bond=BOND,who=None):
        who=self.a if who is None else who
        self.call(who,'publish',headline,url,value=bond)
        return self.c._piece_id(hx(who),headline,url)

    def piece(self,pid):return json.loads(self.c.get_piece(pid))
    def source(self,pid):return json.loads(self.c.get_source(pid))
    def credits(self,who):return int(json.loads(self.c.get_credits(hx(who)))['credits'])
    def challenge(self,pid,index=2,who=None,value=BOND):return self.call(self.b if who is None else who,'challenge',pid,index,value=value)
    def conserve(self,ids):
        held=sum(int(self.piece(pid)['held_wei']) for pid in ids)
        credits=sum(self.credits(w) for w in [self.a,self.b,self.other])
        assert held+credits+sum(n for _,n in self.sent)==self.funded

@pytest.fixture
def w(direct_vm,direct_deploy):
    c=direct_deploy(os.environ.get('NOBAIT_CONTRACT',str(ROOT/'contracts/HeadlineBound.py')),sdk_version='v0.2.16')
    instance=object.__getattribute__(c,'_instance');module=sys.modules[type(instance).__module__]
    world=World(direct_vm,c,module)
    yield world
    module.gl.nondet.exec_prompt=world.original_prompt
    module._NativeRecipient=world.original_recipient

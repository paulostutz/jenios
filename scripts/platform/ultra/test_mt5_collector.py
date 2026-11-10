import unittest,os,importlib.util,time
from types import SimpleNamespace as N
from pathlib import Path
spec=importlib.util.spec_from_file_location('collector',Path(__file__).with_name('mt5_worker.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class Terminal:
    ACCOUNT_TRADE_MODE_DEMO=0;ACCOUNT_TRADE_MODE_REAL=2
    ORDER_TYPE_BUY=0;ORDER_TYPE_SELL=1;ORDER_TYPE_BUY_LIMIT=2;ORDER_TYPE_SELL_LIMIT=3;ORDER_TYPE_BUY_STOP=4;ORDER_TYPE_SELL_STOP=5;ORDER_TYPE_BUY_STOP_LIMIT=6;ORDER_TYPE_SELL_STOP_LIMIT=7
    DEAL_ENTRY_IN=0;DEAL_ENTRY_OUT=1;DEAL_ENTRY_INOUT=2;DEAL_ENTRY_OUT_BY=3;DEAL_TYPE_BUY=0;DEAL_TYPE_SELL=1
    ORDER_STATE_CANCELED=2;ORDER_STATE_EXPIRED=6;ORDER_STATE_REJECTED=5
    def __init__(self):
        self.clock=int(time.time()*1000)-10000;self.order=9007199254740995;self.position=9007199254740997
        self.login=123;self.orders=[N(ticket=self.order,magic=117,type=0,time_setup_msc=self.clock,symbol='EURUSD',volume_initial=1,state=4)]
        self.deals=[N(ticket=9007199254740999,order=self.order,position_id=self.position,entry=0,type=0,volume=1,price=1.1,time_msc=self.clock+1,profit=0,commission=-1,fee=-.1,swap=0),N(ticket=9007199254741001,order=self.order+100,position_id=self.position,entry=1,type=1,volume=1,price=1.2,time_msc=self.clock+1000,profit=10,commission=-1,fee=-.1,swap=-.2)]
        self.positions=[]
    def initialize(self,**kwargs):return True
    def account_info(self):return N(login=self.login,server='Fixture',trade_mode=0,currency='USD')
    def terminal_info(self):return N(connected=True)
    def history_orders_get(self,*args,**kwargs):return self.orders
    def orders_get(self):return []
    def positions_get(self):return self.positions
    def history_deals_get(self,**kwargs):return [d for d in self.deals if d.order==kwargs['ticket']] if 'ticket' in kwargs else self.deals
    def shutdown(self):pass
class Tests(unittest.TestCase):
    def setUp(self):
        os.environ['JENIOS_MT5_ACCOUNT']='123';os.environ['JENIOS_MT5_SERVER']='Fixture'
        self.t=Terminal();self.profile={'environment':'demo','market':'forex','magic':117,'positionCostsComplete':True};self.c=module.MT5Collector(self.t,self.profile)
    def test_closed_results_and_exact_ids(self):
        r=self.c.collect({})['operations'][0];self.assertEqual(r['id'],'mt5_order_9007199254740995');self.assertEqual(r['state'],'closed');self.assertEqual(r['gross'],'10.00000000');self.assertEqual(r['fees'],'2.20000000');self.assertEqual(r['financing'],'0.20000000');self.assertTrue(r['costsComplete']);self.assertIn('9007199254741001',r['brokerRefs'])
    def test_partial_exit_is_not_consolidated(self):
        self.t.deals[1].volume=.4;self.t.positions=[N(identifier=self.t.position,magic=117,volume=.6,profit=4,swap=-.1)]
        r=self.c.collect({})['operations'][0];self.assertEqual(r['state'],'partially_closed');self.assertEqual(r['exitQuantity'],'0.400000000000');self.assertFalse(r['costsComplete']);self.assertEqual(r['unrealized'],'3.90000000')
    def test_incomplete_cost_policy_keeps_net_pending(self):
        self.profile['positionCostsComplete']=False;self.assertFalse(self.c.collect({})['operations'][0]['costsComplete'])
    def test_unrelated_robot_is_excluded(self):
        self.t.orders[0].magic=118;self.assertEqual(self.c.collect({})['operations'],[])
    def test_cancelled_order_still_has_a_record(self):
        self.t.deals=[];self.t.orders[0].state=2;r=self.c.collect({})['operations'][0];self.assertEqual(r['state'],'cancelled');self.assertEqual(r['entryQuantity'],'0')
    def test_account_change_fails_before_collection(self):
        self.t.login=456
        with self.assertRaisesRegex(ValueError,'MT5_ACCOUNT_CHANGED'):self.c.collect({})
    def test_mixed_netting_position_is_explicitly_unreconciled(self):
        extra=N(**vars(self.t.deals[0]));extra.order=987;self.t.deals.append(extra)
        r=self.c.collect({})['operations'][0];self.assertEqual(r['state'],'unknown');self.assertEqual(r['reason'],'MT5_MIXED_POSITION_REQUIRES_RECONCILIATION')
    def test_position_snapshot_race_does_not_publish_false_closed_result(self):
        self.t.positions=[N(identifier=self.t.position,magic=117,volume=.2,profit=4,swap=0)]
        with self.assertRaisesRegex(ValueError,'MT5_POSITION_RECONCILIATION_PENDING'):self.c.collect({})
    def test_no_order_write_capability(self):
        self.assertFalse(hasattr(self.c,'submit'));self.assertFalse(hasattr(self.c,'close'));self.assertTrue(self.c.inspect({})['readOnly'])
if __name__=='__main__':unittest.main()

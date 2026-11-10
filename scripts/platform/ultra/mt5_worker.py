"""Read-only MetaTrader 5 collector. No order submission, cancellation or account login."""
import json,sys,os,hashlib,time,math
from datetime import datetime,timezone,timedelta
from decimal import Decimal

def dec(value,places=8):
    value=Decimal(str(value))
    if not value.is_finite(): raise ValueError('MT5_INVALID_NUMBER')
    return format(value.quantize(Decimal(1).scaleb(-places)),'f')
def iso(ms): return datetime.fromtimestamp(ms/1000,timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def stamp(row): return int(getattr(row,'time_msc',0) or getattr(row,'time_setup_msc',0))
class MT5Collector:
    def __init__(self,terminal,profile):
        self.mt=terminal;self.profile=profile
        if profile.get('environment') not in ('demo','live') or profile.get('market') not in ('forex','b3'): raise ValueError('INVALID_PROFILE')
        self.magic=profile.get('magic')
        if type(self.magic)!=int or not 1<=self.magic<=2147483647: raise ValueError('INVALID_MAGIC')
        self.account=os.environ.get('JENIOS_MT5_ACCOUNT');self.server=os.environ.get('JENIOS_MT5_SERVER')
        if not self.account or not self.server: raise ValueError('MT5_LOCAL_BINDING_REQUIRED')
        path=os.environ.get('JENIOS_MT5_TERMINAL_PATH')
        if not (self.mt.initialize(path=path) if path else self.mt.initialize()): raise ValueError('MT5_TERMINAL_UNAVAILABLE')
        self.check();self.fingerprint=hashlib.sha256(('mt5:'+self.account+':'+self.server+':'+profile['environment']).encode()).hexdigest()
    def check(self):
        a,t=self.mt.account_info(),self.mt.terminal_info()
        if a is None or t is None or not t.connected: raise ValueError('MT5_DISCONNECTED')
        if str(a.login)!=self.account or a.server!=self.server: raise ValueError('MT5_ACCOUNT_CHANGED')
        mode=self.mt.ACCOUNT_TRADE_MODE_DEMO if self.profile['environment']=='demo' else self.mt.ACCOUNT_TRADE_MODE_REAL
        if a.trade_mode!=mode: raise ValueError('MT5_ENVIRONMENT_MISMATCH')
        if a.currency not in ('USD','EUR','BRL','USDT'): raise ValueError('MT5_CURRENCY_UNSUPPORTED')
        return a
    def inspect(self,args):
        a=self.check()
        return {'provider':'mt5','environment':self.profile['environment'],'currency':a.currency,'accountFingerprint':self.fingerprint,'connected':True,'readOnly':True}
    def collect(self,args):
        a=self.check();days=args.get('days',30)
        if type(days)!=int or not 1<=days<=365: raise ValueError('INVALID_LOOKBACK')
        now=datetime.now(timezone.utc);begin=now-timedelta(days=days)
        orders=self.mt.history_orders_get(begin,now);active=self.mt.orders_get();positions=self.mt.positions_get()
        if orders is None or active is None or positions is None: raise ValueError('MT5_HISTORY_UNAVAILABLE')
        if len(orders)+len(active)>20000: raise ValueError('MT5_HISTORY_LIMIT')
        # Historical live positions may have opened before the selected history window.
        all_orders={str(o.ticket):o for o in tuple(orders)+tuple(active)}
        for p in positions:
            if p.magic!=self.magic: continue
            history=self.mt.history_orders_get(position=int(p.identifier))
            if history is None: raise ValueError('MT5_HISTORY_UNAVAILABLE')
            for o in history: all_orders[str(o.ticket)]=o
        result=[];seen_positions=set();now_ms=int(time.time()*1000)
        for o in sorted(all_orders.values(),key=lambda r:(r.time_setup_msc,r.ticket)):
            if o.magic!=self.magic or o.type not in (self.mt.ORDER_TYPE_BUY,self.mt.ORDER_TYPE_SELL,self.mt.ORDER_TYPE_BUY_LIMIT,self.mt.ORDER_TYPE_SELL_LIMIT,self.mt.ORDER_TYPE_BUY_STOP,self.mt.ORDER_TYPE_SELL_STOP,self.mt.ORDER_TYPE_BUY_STOP_LIMIT,self.mt.ORDER_TYPE_SELL_STOP_LIMIT): continue
            # Official ticket filter is the order ticket, not the deal ticket.
            order_deals=self.mt.history_deals_get(ticket=int(o.ticket))
            if order_deals is None: raise ValueError('MT5_HISTORY_UNAVAILABLE')
            entries=[x for x in order_deals if x.entry==self.mt.DEAL_ENTRY_IN and x.type in (self.mt.DEAL_TYPE_BUY,self.mt.DEAL_TYPE_SELL)]
            # A closing order is part of the existing operation, not another entry.
            if order_deals and not entries: continue
            buy=o.type in (self.mt.ORDER_TYPE_BUY,self.mt.ORDER_TYPE_BUY_LIMIT,self.mt.ORDER_TYPE_BUY_STOP,self.mt.ORDER_TYPE_BUY_STOP_LIMIT)
            created=iso(o.time_setup_msc)
            row={'id':'mt5_order_'+str(o.ticket),'revision':1,'market':self.profile['market'],'symbol':o.symbol,'currency':a.currency,'side':'buy' if buy else 'sell',
                 'state':'sending','createdAt':created,'updatedAt':iso(now_ms),'openedAt':None,'closedAt':None,'requestedQuantity':dec(o.volume_initial,12),
                 'entryQuantity':'0','exitQuantity':'0','entryPrice':None,'exitPrice':None,'gross':None,'fees':None,'financing':None,'unrealized':None,'costsComplete':False,'brokerRefs':[str(o.ticket)],'reason':None}
            if not entries:
                if o.state in (self.mt.ORDER_STATE_CANCELED,self.mt.ORDER_STATE_EXPIRED): row['state']='cancelled'
                elif o.state==self.mt.ORDER_STATE_REJECTED: row['state']='rejected'
                result.append(row);continue
            ids={int(x.position_id) for x in entries}
            if len(ids)!=1: row.update(state='unknown',reason='MT5_MULTIPLE_POSITION_IDENTITIES');result.append(row);continue
            position_id=next(iter(ids));deals=self.mt.history_deals_get(position=position_id)
            if deals is None: raise ValueError('MT5_HISTORY_UNAVAILABLE')
            ins=[x for x in deals if x.entry==self.mt.DEAL_ENTRY_IN and x.type in (self.mt.DEAL_TYPE_BUY,self.mt.DEAL_TYPE_SELL)]
            outs=[x for x in deals if x.entry in (self.mt.DEAL_ENTRY_OUT,self.mt.DEAL_ENTRY_OUT_BY) and x.type in (self.mt.DEAL_TYPE_BUY,self.mt.DEAL_TYPE_SELL)]
            # Do not allocate mixed manual or netting entries to this robot by guessing.
            if any(x.order!=o.ticket for x in ins) or any(x.entry==self.mt.DEAL_ENTRY_INOUT for x in deals):
                row.update(state='unknown',reason='MT5_MIXED_POSITION_REQUIRES_RECONCILIATION');result.append(row);continue
            qty=sum((Decimal(str(x.volume)) for x in ins),Decimal(0));out=sum((Decimal(str(x.volume)) for x in outs),Decimal(0))
            remaining=[p for p in positions if p.identifier==position_id]
            balance=sum((Decimal(str(p.volume)) for p in remaining),Decimal(0))
            if qty<=0 or out>qty or balance!=qty-out: raise ValueError('MT5_POSITION_RECONCILIATION_PENDING')
            flat=out==qty and not remaining
            def vwap(items,total): return dec(sum((Decimal(str(x.volume))*Decimal(str(x.price)) for x in items),Decimal(0))/total,12) if total else None
            row.update(state='closed' if flat else 'partially_closed' if out else 'open',entryQuantity=dec(qty,12),exitQuantity=dec(out,12),
                       entryPrice=vwap(ins,qty),exitPrice=vwap(outs,out),openedAt=iso(min(x.time_msc for x in ins)),closedAt=iso(max(x.time_msc for x in outs)) if flat else None,
                       gross=dec(sum((Decimal(str(x.profit)) for x in deals),Decimal(0))),fees=dec(-sum((Decimal(str(x.commission))+Decimal(str(x.fee)) for x in deals),Decimal(0))),
                       financing=dec(-sum((Decimal(str(x.swap)) for x in deals),Decimal(0))),unrealized=None if flat else dec(sum((Decimal(str(p.profit))+Decimal(str(p.swap)) for p in remaining),Decimal(0))),
                       costsComplete=flat and self.profile.get('positionCostsComplete') is True,
                       brokerRefs=list(dict.fromkeys([str(o.ticket),str(position_id)]+[str(x.ticket) for x in deals][-28:])))
            result.append(row);seen_positions.add(position_id)
        self.check()
        return {'operations':result,'generatedAt':iso(now_ms),'scope':'configured_magic','magic':self.magic}
    def stop(self): self.mt.shutdown()

def main():
    import MetaTrader5 as mt5
    profile=json.loads(sys.stdin.readline());bridge=MT5Collector(mt5,profile)
    try:
        for line in sys.stdin:
            req=None
            try:
                req=json.loads(line)
                if req.get('method') not in ('inspect','collect'): raise ValueError('INVALID_METHOD')
                response={'id':req['id'],'ok':True,'result':getattr(bridge,req['method'])(req.get('args',{}))}
            except Exception as e:
                code=str(e) if isinstance(e,ValueError) and str(e).replace('_','').isalnum() and str(e).isupper() else 'MT5_COLLECTION_FAILED'
                response={'id':req.get('id') if isinstance(req,dict) else None,'ok':False,'error':code}
            print(json.dumps(response,separators=(',',':')),flush=True)
    finally: bridge.stop()
if __name__=='__main__':
    try: main()
    except Exception: print(json.dumps({'ok':False,'error':'MT5_STARTUP_FAILED'}),flush=True);sys.exit(1)

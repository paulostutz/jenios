import test from 'node:test';
import assert from 'node:assert/strict';
import {requirePayUser} from '../lib/pay/auth.mjs';
const request=new Request('https://qa.invalid',{headers:{authorization:'Bearer fixture'}});
test('invalid API key is a service problem, not an expired user session',async()=>{
 await assert.rejects(requirePayUser(request,{auth:{getUser:async()=>({data:{user:null},error:{message:'Invalid API key'}})}}),{status:503});
});
test('expired or anonymous session remains unauthorized',async()=>{
 for(const result of [{data:{user:null},error:{message:'JWT expired'}},{data:{user:{id:'qa',is_anonymous:true}},error:null}])await assert.rejects(requirePayUser(request,{auth:{getUser:async()=>result}}),{status:401});
});

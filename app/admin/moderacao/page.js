'use client';
import Link from 'next/link';
import AdminAccess from '../../components/AdminAccess';
import SocialModeration from '../../components/SocialModeration';
export default function ModerationPage(){
 return <AdminAccess permission="permissions.manage" loginRedirect="/admin/login">
  <main style={{maxWidth:1000,margin:'0 auto',padding:'clamp(12px,3vw,24px)',background:'#f3f5fa',minHeight:'100vh'}}>
   <Link href="/admin">← Central Master</Link><SocialModeration/>
  </main>
 </AdminAccess>;
}
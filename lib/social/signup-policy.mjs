import {validateHandle} from './handle-policy.mjs';

const error=(message,code)=>Object.assign(new Error(message),{code,status:400});
/** Canonical Social signup input. Never copy arbitrary browser fields into Supabase metadata. */
export function prepareSocialSignup({name,email,password,handle}={}){
  const nameValue=typeof name==='string'?name.replace(/\s+/g,' ').trim():'';
  if(nameValue.length<2||nameValue.length>120||/[\u0000-\u001f\u007f]/.test(nameValue))throw error('Informe um nome válido de 2 a 120 caracteres.','NAME_INVALID');
  const emailValue=typeof email==='string'?email.trim().toLowerCase():'';
  if(emailValue.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue))throw error('Informe um endereço de e-mail válido.','EMAIL_INVALID');
  if(typeof password!=='string'||password.length<12||password.length>128||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password))throw error('Use uma senha de 12 a 128 caracteres com maiúscula, minúscula, número e símbolo.','PASSWORD_WEAK');
  const check=validateHandle(handle);
  if(!check.ok)throw error(check.error,'HANDLE_INVALID');
  return {
    email:emailValue,
    password,
    options:{data:{full_name:nameValue,handle:check.handle,registration_source:'social'}}
  };
}
/** No entitlement, role, verified flag or trial claim is accepted from the browser. */
export function isCanonicalSocialSignupMetadata(metadata){
  return Boolean(metadata&&Object.keys(metadata).sort().join(',')==='full_name,handle,registration_source'&&metadata.registration_source==='social'&&validateHandle(metadata.handle).ok);
}

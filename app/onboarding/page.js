import {redirect} from 'next/navigation';

/** Legacy URL kept for compatibility. The durable onboarding/diagnostic lives in /diagnostico. */
export default function OnboardingLegacyRedirect(){
  redirect('/diagnostico');
}

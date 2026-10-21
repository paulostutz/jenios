import {redirect} from 'next/navigation';
/** B284: prohibit legacy hardcoded Pix codes. Use the existing server-priced JENIOS checkout. */
export default function PlanosLegacyRedirect(){redirect('/checkout');}

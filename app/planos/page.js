import {redirect} from 'next/navigation';

// Legacy links, including existing emails, share the verified catalog/checkout.
export default function PlanosPage(){
 redirect('/checkout');
}

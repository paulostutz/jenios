export const STATE_SCHEMA:string;
export const SECTION_NAMES:readonly string[];
export interface OwnerState {schema:string;owner:{platform:string;subject:string};generatedAt:string;sections:Record<string,{status:string;mode:string|null;observedAt:string|null;reason?:string;data:unknown}>;capabilities:{liveExecutionVerified:boolean;realBillingVerified:boolean};}
export function emptyOwnerState(options:{platform:string;subject:string;now?:number}):OwnerState;
export function validateOwnerState(raw:unknown,options:{platform:string;subject:string;now?:number;maxAgeMs?:number}):OwnerState;
export function unavailable(reason?:string):unknown;
export function available(data:unknown,options?:{mode?:string;observedAt?:string}):unknown;

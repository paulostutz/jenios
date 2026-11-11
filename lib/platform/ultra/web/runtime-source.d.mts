export function createRuntimeSource(options?:{env?:unknown;fetchImpl?:typeof fetch;now?:()=>number}):(identity:{platform:string;subject:string})=>Promise<unknown>;
export function createRuntimeStateService(options:{serviceKey:string;resolve:(identity:{platform:string;subject:string})=>Promise<{readState:()=>Promise<unknown>}|null>;now?:()=>number}):(request:Request)=>Promise<Response>;

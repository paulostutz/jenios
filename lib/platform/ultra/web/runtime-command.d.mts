export function createRuntimeCommandSource(options?:{env?:Record<string,string|undefined>;fetchImpl?:typeof fetch;now?:()=>number;timeoutMs?:number}):(input:{platform:'jenios'|'flow';subject:string;command:any})=>Promise<any>;
export function createRuntimeCommandService(options:any):(request:Request)=>Promise<Response>;

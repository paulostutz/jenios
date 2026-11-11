export type StateUser={id:string;is_anonymous?:boolean};
export interface OwnerStateDependencies {platform:'jenios'|'flow';getUser:(request:Request)=>Promise<StateUser|null>;readState?:(user:StateUser)=>Promise<unknown>;now?:()=>number;}
export function ownerStateHttp(request:Request,dependencies:OwnerStateDependencies):Promise<Response>;
export function readJeniosState(db:unknown,user:StateUser,options?:{now?:number;remoteState?:unknown}):Promise<unknown>;

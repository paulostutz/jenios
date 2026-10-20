/** Only the chosen character is persisted, never conversation contents or credentials. */
export const PERSONA_PREFERENCE_EVENT='jenios:persona-preference';
export const validPersona=value=>value==='genio'||value==='genia'?value:null;
export function personaPreferenceKey(owner){return 'jenios:assistant:persona:v1:'+(owner&&/^[a-zA-Z0-9_-]{1,100}$/.test(owner)?owner:'visitor');}
export function readPersonaPreference(storage,owner){try{return validPersona(storage.getItem(personaPreferenceKey(owner)));}catch{return null;}}
export function savePersonaPreference(storage,owner,persona){const value=validPersona(persona);if(!value)return false;try{storage.setItem(personaPreferenceKey(owner),value);return true;}catch{return false;}}

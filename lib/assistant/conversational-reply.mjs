import {replySales} from './sales-provider.mjs';

/** The route supplies bounded conversation state and authorized server contexts.
 * No account lookup, tool execution or memory mutation occurs in this function. */
export function replyWithContext(input,options={}){
 return replySales(input?.message,input?.persona,{...options,context:input||{}});
}
export {prepareConversationContext,updateConversationSummary} from './context-resolution.mjs';

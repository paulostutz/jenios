import {parseWorkspaceReport,workspaceReportView} from './workspace-report.mjs';
import {parseLocalReport,buildLocalDashboard,reportCsv} from './reporting.mjs';
/** Reuse established report accounting. MT5 is a transport, not proof of Forex.
 * Only an explicitly homogeneous B3 report can use the B3 validation path.
 * No symbol guessing, mixed-market consolidation or accounting calculation added. */
function b3Mt5(input){return input?.provider==='mt5'&&Array.isArray(input.operations)&&input.operations.length>0&&input.operations.every(o=>o?.market==='b3');}
function validationInput(input){return b3Mt5(input)?{...input,provider:'profit'}:input;}
export function parseWorkspaceReportR125(input,now){const parsed=parseWorkspaceReport(validationInput(input),now);return {...parsed,provider:input.provider};}
export function workspaceReportViewR125(input,options){const result=workspaceReportView(validationInput(input),options);return {...result,provider:input.provider};}
export function parseLocalReportR125(input){const parsed=parseLocalReport(validationInput(input));return {...parsed,provider:input.provider};}
export function buildLocalDashboardR125(input,options){return buildLocalDashboard(validationInput(input),options);}
export function reportCsvR125(input,options){return reportCsv(validationInput(input),options);}

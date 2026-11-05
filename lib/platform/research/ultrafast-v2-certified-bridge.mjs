/** Explicitly reuse original R18/R23/R28/R53 certified research primitives. */
import {scoreUltrafastAsset,sessionKillSwitch}
 from './robot-r18-ultrafast-foundation.mjs';
import {availabilityGate} from './robot-r23-multiwindow-ultrafast.mjs';
import {adaptiveBreakevenGate} from './robot-r28-breakeven-recall.mjs';
import {scoreR53Asset} from './robot-r53-dynamic-asset-selection.mjs';
import {createUltraV2ResearchPipeline} from './ultrafast-v2-pipeline.mjs';
export const analyzeUltraV2WithCertifiedHistory=createUltraV2ResearchPipeline({
 scoreUltrafastAsset,sessionKillSwitch,availabilityGate,
 adaptiveBreakevenGate,scoreR53Asset
});
import {getJeniosPlatformAdmin} from '../../../../../lib/platform/admin-db.mjs';
import {createR63AdminReportHandler} from '../../../../../lib/platform/research/robot-r63-admin-access.mjs';
import {readR63Journal} from '../../../../../lib/platform/research/robot-r63-durable-journal.mjs';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const GET=createR63AdminReportHandler({getDb:getJeniosPlatformAdmin,readJournal:readR63Journal});
